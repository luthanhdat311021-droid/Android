import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import { processFileAndGenerate, answerStudyQuery } from './services/aiEngine.js';
import { aiRouter } from './services/ai/AIRouter.js';
import { aiLogger } from './services/ai/AILogger.js';
import { extractFromVideoUrlOrFile, extractFromWebUrl } from './services/textExtractor.js';
import { supabaseService } from './services/supabaseService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Storage setup for uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Jobs Progress Memory Store
const jobs = new Map();

// In-Memory Database Store
const db = {
  user: {
    id: "usr-1",
    fullName: "Nguyễn Minh Trí",
    email: "minhtri@studymind.ai",
    membershipTier: "Premium",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    studyGoalHours: 5.0,
    currentStudyHours: 3.5,
    quizTargetCount: 50,
    currentQuizCount: 45
  },
  documents: [
    {
      id: "doc-1",
      title: "Sinh học Tế bào - Ty thể và Hô hấp Tế bào",
      fileType: "PDF",
      fileSize: "1.8 MB",
      pageCount: 12,
      updatedAt: "2 giờ trước",
      status: "COMPLETED",
      tags: ["Mindmap", "40 Cards"],
      rawText: `3. Cấu trúc siêu vi thể của Ty thể (Mitochondria)\n\nTy thể là một bào quan có màng kép bao bọc, đóng vai trò chính trong việc tạo năng lượng ATP cho tế bào hoạt động.\n\n"Màng trong gấp nếp sâu tạo thành các mào (cristae), nơi chứa chuỗi truyền electron để tổng hợp năng lượng."\n\nChất nền (matrix) là khoảng không gian bên trong màng trong, chứa DNA vòng của ty thể, ribosome 70S nhân sơ và các enzyme tham gia chu trình Krebs.`
    }
  ],
  spacedRepetition: [
    {
      id: "sr-1",
      title: "Thuyết tiến hóa nội cộng sinh (Ty thể)",
      memoryLevel: "Yếu",
      actionNeeded: "Cần ôn lại thẻ ghi nhớ",
      buttonText: "Ôn ngay",
      docId: "doc-1"
    }
  ],
  activities: [
    { id: "act-1", text: "Đã tạo Mindmap Sinh học tế bào", time: "Hôm nay • 09:30" }
  ],
  studyPacks: {}
};

// Initialize default Knowledge Base & StudyPack
(async () => {
  try {
    const defaultDoc = db.documents[0];
    const knowledgeBase = await aiRouter.analyzeDocument(defaultDoc.rawText, { title: defaultDoc.title });
    const notes = await aiRouter.generateNotes(knowledgeBase);
    const mindmap = await aiRouter.generateMindmap(knowledgeBase);
    const flashcards = await aiRouter.generateFlashcards(knowledgeBase);
    const quiz = await aiRouter.generateQuiz(knowledgeBase);

    db.studyPacks["doc-1"] = {
      knowledgeBase,
      notes,
      mindmap,
      flashcards,
      quiz
    };
  } catch (err) {
    console.warn("Initial StudyPack generation warning:", err.message);
  }
})();

// ==================== REST API ENDPOINTS ==================== //

// Healthcheck
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'online',
    aiEngines: {
      providerMode: process.env.AI_PROVIDER || 'auto',
      geminiMultimodal: process.env.GEMINI_API_KEY ? 'Active (Connected)' : 'Fallback Mode (No Key)',
      groqFastReasoning: process.env.GROQ_API_KEY ? 'Active (Connected)' : 'Fallback Mode (No Key)'
    }
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  res.json({ success: true, token: "jwt-token-demo", user: db.user });
});

app.get('/api/v1/auth/me', (req, res) => {
  res.json({ success: true, user: db.user });
});

app.get('/api/v1/user/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totalDocuments: db.documents.length + 22,
      weeklyDocAdded: 3,
      flashcardProgress: "152/240",
      retentionRatePercentage: 78,
      averageQuizScore: "8.5/10",
      quizScoreDiff: "+0.4 điểm so với tháng trước",
      weeklyHours: { current: db.user.currentStudyHours, target: db.user.studyGoalHours },
      weeklyQuizCount: { current: db.user.currentQuizCount, target: db.user.quizTargetCount },
      recentDocuments: db.documents,
      spacedRepetitionItems: db.spacedRepetition,
      recentActivities: db.activities
    }
  });
});

app.get('/api/v1/documents', (req, res) => {
  res.json({ success: true, documents: db.documents });
});

app.get('/api/v1/documents/:id', (req, res) => {
  const doc = db.documents.find(d => d.id === req.params.id) || db.documents[0];
  const studyPack = db.studyPacks[doc.id] || db.studyPacks["doc-1"];
  res.json({ success: true, document: doc, studyPack });
});

// Specified Standard AI Endpoints:
app.get('/api/documents/:id/analysis', (req, res) => {
  const pack = db.studyPacks[req.params.id] || db.studyPacks["doc-1"];
  res.json({ success: true, knowledgeBase: pack.knowledgeBase });
});

app.get('/api/documents/:id/notes', (req, res) => {
  const pack = db.studyPacks[req.params.id] || db.studyPacks["doc-1"];
  res.json({ success: true, notes: pack.notes });
});

app.get('/api/documents/:id/mindmap', (req, res) => {
  const pack = db.studyPacks[req.params.id] || db.studyPacks["doc-1"];
  res.json({ success: true, mindmap: pack.mindmap });
});

app.get('/api/documents/:id/flashcards', (req, res) => {
  const pack = db.studyPacks[req.params.id] || db.studyPacks["doc-1"];
  res.json({ success: true, flashcards: pack.flashcards });
});

app.get('/api/documents/:id/quiz', (req, res) => {
  const pack = db.studyPacks[req.params.id] || db.studyPacks["doc-1"];
  res.json({ success: true, quiz: pack.quiz });
});

// Async Job Status Progress endpoint
app.get('/api/ai/job-status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: "Job not found" });
  res.json({ success: true, job });
});

// Direct AI Endpoints
app.post('/api/ai/analyze', async (req, res) => {
  const { content, title = "Tài liệu học tập" } = req.body;
  const knowledgeBase = await aiRouter.analyzeDocument(content, { title });
  res.json({ success: true, knowledgeBase });
});

app.post('/api/ai/notes', async (req, res) => {
  const { knowledgeBase } = req.body;
  const notes = await aiRouter.generateNotes(knowledgeBase);
  res.json({ success: true, notes });
});

app.post('/api/ai/mindmap', async (req, res) => {
  const { knowledgeBase } = req.body;
  const mindmap = await aiRouter.generateMindmap(knowledgeBase);
  res.json({ success: true, mindmap });
});

app.post('/api/ai/flashcards', async (req, res) => {
  const { knowledgeBase, userSettings = {} } = req.body;
  const flashcards = await aiRouter.generateFlashcards(knowledgeBase, userSettings);
  res.json({ success: true, flashcards });
});

app.post('/api/ai/quiz', async (req, res) => {
  const { knowledgeBase, userSettings = {} } = req.body;
  const quiz = await aiRouter.generateQuiz(knowledgeBase, userSettings);
  res.json({ success: true, quiz });
});

app.post('/api/v1/documents/:id/regenerate-quiz', async (req, res) => {
  try {
    const docId = req.params.id;
    const { userSettings = {} } = req.body;
    const pack = db.studyPacks[docId] || db.studyPacks["doc-1"];
    let knowledgeBase = pack?.knowledgeBase;
    if (!knowledgeBase) {
      const doc = db.documents.find(d => d.id === docId) || db.documents[0];
      knowledgeBase = await aiRouter.analyzeDocument(doc.rawText || doc.title, { title: doc.title });
    }
    const quiz = await aiRouter.generateQuiz(knowledgeBase, userSettings);
    if (db.studyPacks[docId]) {
      db.studyPacks[docId].quiz = quiz;
    }
    res.json({ success: true, quiz });
  } catch (err) {
    console.error("Regenerate quiz error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/v1/documents/:id/regenerate-flashcards', async (req, res) => {
  try {
    const docId = req.params.id;
    const { userSettings = {} } = req.body;
    const pack = db.studyPacks[docId] || db.studyPacks["doc-1"];
    let knowledgeBase = pack?.knowledgeBase;
    if (!knowledgeBase) {
      const doc = db.documents.find(d => d.id === docId) || db.documents[0];
      knowledgeBase = await aiRouter.analyzeDocument(doc.rawText || doc.title, { title: doc.title });
    }
    const flashcards = await aiRouter.generateFlashcards(knowledgeBase, userSettings);
    if (db.studyPacks[docId]) {
      db.studyPacks[docId].flashcards = flashcards;
    }
    res.json({ success: true, flashcards });
  } catch (err) {
    console.error("Regenerate flashcards error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const { documentId, question, chatHistory = [] } = req.body;
  const doc = db.documents.find(d => d.id === documentId) || db.documents[0];
  const reply = await aiRouter.chat(doc.title, doc.rawText || '', question, chatHistory);
  res.json({ success: true, answer: reply });
});

// Upload Document with Async Job & Progress Streaming Support
app.post('/api/v1/documents/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { options } = req.body;
    const parsedOptions = options ? JSON.parse(options) : {};
    
    const newDocId = `doc-${Date.now()}`;
    const docTitle = file ? file.originalname.replace(/\.[^/.]+$/, "") : "Tài liệu mới";
    const jobId = `job-${Date.now()}`;

    // Create Job entry
    jobs.set(jobId, { status: 'PROCESSING', progressPct: 10, step: 'Extracting content' });

    const updateJob = (pct, step) => {
      jobs.set(jobId, { status: pct === 100 ? 'COMPLETED' : 'PROCESSING', progressPct: pct, step });
    };

    let result;
    if (file) {
      result = await processFileAndGenerate(file.path, file.originalname, file.mimetype, parsedOptions, updateJob);
    } else {
      const defaultText = "Tài liệu học tập tổng hợp từ người dùng.";
      const knowledgeBase = await aiRouter.analyzeDocument(defaultText, { title: docTitle });
      const notes = await aiRouter.generateNotes(knowledgeBase);
      const mindmap = await aiRouter.generateMindmap(knowledgeBase);
      const flashcards = await aiRouter.generateFlashcards(knowledgeBase);
      const quiz = await aiRouter.generateQuiz(knowledgeBase);
      
      result = {
        extractedText: defaultText,
        studyPack: { knowledgeBase, notes, mindmap, flashcards, quiz }
      };
      updateJob(100, 'Completed');
    }

    const newDoc = {
      id: newDocId,
      title: docTitle,
      fileType: file ? file.originalname.split('.').pop().toUpperCase() : 'PDF',
      fileSize: file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : '2.0 MB',
      pageCount: 10,
      updatedAt: 'Vừa xong',
      status: 'COMPLETED',
      tags: ['AI Analysis Engine'],
      rawText: result.extractedText
    };

    db.documents.unshift(newDoc);
    db.studyPacks[newDocId] = result.studyPack;

    // Sync to Supabase Lesson History
    await supabaseService.saveLessonHistory(newDoc, result.studyPack);

    res.json({
      success: true,
      jobId,
      message: "Chuyển hóa tài liệu thành công!",
      document: newDoc,
      studyPack: result.studyPack
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, error: "Lỗi xử lý tài liệu" });
  }
});

// Process Video
app.post('/api/v1/documents/process-video', async (req, res) => {
  const { videoUrl } = req.body;
  const docTitle = videoUrl ? `Bài giảng Video (${videoUrl.slice(0, 25)}...)` : "Video học tập";
  const transcript = await extractFromVideoUrlOrFile(videoUrl);
  
  const newDocId = `doc-${Date.now()}`;
  const knowledgeBase = await aiRouter.analyzeDocument(transcript, { title: docTitle });
  const notes = await aiRouter.generateNotes(knowledgeBase);
  const mindmap = await aiRouter.generateMindmap(knowledgeBase);
  const flashcards = await aiRouter.generateFlashcards(knowledgeBase);
  const quiz = await aiRouter.generateQuiz(knowledgeBase);

  const newDoc = {
    id: newDocId,
    title: docTitle,
    fileType: 'VIDEO',
    duration: '30 phút',
    updatedAt: 'Vừa xong',
    status: 'COMPLETED',
    tags: ['Speech-to-Text'],
    rawText: transcript
  };

  db.documents.unshift(newDoc);
  db.studyPacks[newDocId] = { knowledgeBase, notes, mindmap, flashcards, quiz };

  // Sync to Supabase Lesson History
  await supabaseService.saveLessonHistory(newDoc, db.studyPacks[newDocId]);

  res.json({ success: true, document: newDoc, studyPack: db.studyPacks[newDocId] });
});

// Process Web URL
app.post('/api/v1/documents/process-url', async (req, res) => {
  const { url } = req.body;
  const content = await extractFromWebUrl(url);
  const docTitle = `Bài viết Web: ${url ? url.replace(/^https?:\/\//, '').slice(0, 25) : 'Nghiên cứu'}`;
  
  const newDocId = `doc-${Date.now()}`;
  const knowledgeBase = await aiRouter.analyzeDocument(content, { title: docTitle });
  const notes = await aiRouter.generateNotes(knowledgeBase);
  const mindmap = await aiRouter.generateMindmap(knowledgeBase);
  const flashcards = await aiRouter.generateFlashcards(knowledgeBase);
  const quiz = await aiRouter.generateQuiz(knowledgeBase);

  const newDoc = {
    id: newDocId,
    title: docTitle,
    fileType: 'URL',
    updatedAt: 'Vừa xong',
    status: 'COMPLETED',
    tags: ['Web Article'],
    rawText: content
  };

  db.documents.unshift(newDoc);
  db.studyPacks[newDocId] = { knowledgeBase, notes, mindmap, flashcards, quiz };

  // Sync to Supabase Lesson History
  await supabaseService.saveLessonHistory(newDoc, db.studyPacks[newDocId]);

  res.json({ success: true, document: newDoc, studyPack: db.studyPacks[newDocId] });
});

// Admin AI Logs & Metrics Dashboard Endpoints
app.get('/api/ai/logs', (req, res) => {
  res.json({ success: true, logs: aiLogger.getLogs(50) });
});

app.get('/api/ai/stats', (req, res) => {
  res.json({ success: true, stats: aiLogger.getStats() });
});

// ==================== MINDMAP / FLASHCARD / QUIZ CRUD ==================== //

app.post('/api/v1/documents/:id/mindmap/expand', async (req, res) => {
  const docId = req.params.id;
  const doc = db.documents.find(d => d.id === docId) || db.documents[0];
  const pack = db.studyPacks[docId] || db.studyPacks["doc-1"];
  const { node } = req.body;

  if (!node) {
    return res.status(400).json({ success: false, error: "Missing node parameter" });
  }

  try {
    const expansion = await aiRouter.expandNode(node, doc.rawText || "");
    const newNodes = expansion.expandedNodes || [];
    const newEdges = expansion.expandedEdges || [];

    if (!pack.mindmap) {
      pack.mindmap = { rootLabel: doc.title, nodes: [], edges: [] };
    }
    if (!Array.isArray(pack.mindmap.nodes)) pack.mindmap.nodes = [];
    if (!Array.isArray(pack.mindmap.edges)) pack.mindmap.edges = [];

    pack.mindmap.nodes.push(...newNodes);
    pack.mindmap.edges.push(...newEdges);

    res.json({ success: true, expansion, mindmap: pack.mindmap });
  } catch (err) {
    console.error("AI Node Expansion error:", err);
    res.status(500).json({ success: false, error: "Failed to expand node via AI" });
  }
});

app.post('/api/v1/documents/:id/mindmap/nodes', (req, res) => {
  const docId = req.params.id;
  const pack = db.studyPacks[docId] || db.studyPacks["doc-1"];
  const { label, detail, subDetails = [], parentId } = req.body;

  const newNode = {
    id: `node-${Date.now()}`,
    label: label || 'Nút nhánh mới',
    detail: detail || 'Chi tiết nút mới tạo',
    subDetails: subDetails || [],
    parentId: parentId || 'root'
  };

  if (!pack.mindmap) {
    pack.mindmap = { rootLabel: 'NÚT GỐC TRUNG TÂM', nodes: [] };
  }
  pack.mindmap.nodes.push(newNode);

  res.json({ success: true, node: newNode, mindmap: pack.mindmap });
});

app.put('/api/v1/documents/:id/mindmap/nodes/:nodeId', (req, res) => {
  const { id: docId, nodeId } = req.params;
  const pack = db.studyPacks[docId] || db.studyPacks["doc-1"];
  const { label, detail, subDetails } = req.body;

  if (pack.mindmap && pack.mindmap.nodes) {
    const node = pack.mindmap.nodes.find(n => n.id === nodeId);
    if (node) {
      if (label !== undefined) node.label = label;
      if (detail !== undefined) node.detail = detail;
      if (subDetails !== undefined) node.subDetails = subDetails;
    }
  }

  res.json({ success: true, mindmap: pack.mindmap });
});

app.delete('/api/v1/documents/:id/mindmap/nodes/:nodeId', (req, res) => {
  const { id: docId, nodeId } = req.params;
  const pack = db.studyPacks[docId] || db.studyPacks["doc-1"];

  if (pack.mindmap && pack.mindmap.nodes) {
    pack.mindmap.nodes = pack.mindmap.nodes.filter(n => n.id !== nodeId);
  }

  res.json({ success: true, mindmap: pack.mindmap });
});

app.post('/api/v1/documents/:id/flashcards', (req, res) => {
  const docId = req.params.id;
  const pack = db.studyPacks[docId] || db.studyPacks["doc-1"];
  const { front, back, difficulty = 'medium' } = req.body;

  const newCard = {
    id: `fc-${Date.now()}`,
    front: front || 'Câu hỏi ghi nhớ mới?',
    back: back || 'Đáp án trả lời.',
    difficulty,
    lastReviewed: null,
    nextReview: new Date().toISOString()
  };

  if (!pack.flashcards) pack.flashcards = [];
  pack.flashcards.push(newCard);

  res.json({ success: true, card: newCard, flashcards: pack.flashcards });
});

app.post('/api/v1/flashcards/:id/review', (req, res) => {
  const { rating } = req.body;
  const intervals = { hard: '1 phút', medium: '10 phút', easy: '4 ngày' };
  res.json({
    success: true,
    message: `Đã cập nhật trạng thái thẻ ôn tập: ${rating.toUpperCase()} (Lần ôn tiếp theo: sau ${intervals[rating] || '10 phút'})`
  });
});

app.delete('/api/v1/flashcards/:id', (req, res) => {
  const cardId = req.params.id;
  Object.values(db.studyPacks).forEach(pack => {
    if (pack.flashcards) {
      pack.flashcards = pack.flashcards.filter(c => c.id !== cardId);
    }
  });
  res.json({ success: true, message: "Đã xóa thẻ ghi nhớ thành công" });
});

app.post('/api/v1/documents/:id/quiz/questions', (req, res) => {
  const docId = req.params.id;
  const pack = db.studyPacks[docId] || db.studyPacks["doc-1"];
  const { questionText, options, correctIndex, explanation } = req.body;

  if (!pack.quiz) {
    pack.quiz = { title: "Đề trắc nghiệm AI", subject: "Tổng hợp", timeLimitMinutes: 15, questions: [] };
  }

  const qNumber = pack.quiz.questions.length + 1;
  const newQ = {
    id: `q-${Date.now()}`,
    questionNumber: qNumber,
    questionText: questionText || `Câu hỏi ${qNumber}?`,
    options: options || ["A. Phương án 1", "B. Phương án 2", "C. Phương án 3", "D. Phương án 4"],
    correctIndex: correctIndex !== undefined ? correctIndex : 0,
    explanation: explanation || "Giải thích chi tiết từ AI."
  };

  pack.quiz.questions.push(newQ);

  res.json({ success: true, question: newQ, quiz: pack.quiz });
});

app.post('/api/v1/quiz/:id/submit', (req, res) => {
  const { answers } = req.body;
  const docId = req.params.id;
  const pack = db.studyPacks[docId] || db.studyPacks["doc-1"];
  const quiz = pack.quiz;

  let correctCount = 0;
  if (quiz && quiz.questions) {
    quiz.questions.forEach(q => {
      if (answers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });
  }

  const total = quiz?.questions?.length || 3;
  const scorePct = Math.round((correctCount / total) * 100);
  const feedback = scorePct >= 80 ? "Xuất sắc! Bạn đã nắm rất vững kiến thức bài học." : "Khá tốt! Hãy ôn lại các thẻ ghi nhớ màu đỏ nhé.";

  // Record quiz result into Supabase / History
  supabaseService.recordQuizResult(docId, scorePct, correctCount, total, feedback);

  res.json({
    success: true,
    score: scorePct,
    correctCount,
    totalQuestions: total,
    feedback
  });
});

// ==========================================
// 📚 LESSON HISTORY & SUPABASE ENDPOINTS
// ==========================================

// Get all lesson history
app.get('/api/v1/history', async (req, res) => {
  try {
    const historyList = await supabaseService.getAllLessonHistory();
    res.json({
      success: true,
      isSupabaseActive: supabaseService.isConfigured(),
      data: historyList
    });
  } catch (err) {
    console.error("Fetch history error:", err);
    res.status(500).json({ success: false, error: "Lỗi tải lịch sử bài học" });
  }
});

// Get detailed lesson history item
app.get('/api/v1/history/:id', async (req, res) => {
  try {
    const lesson = await supabaseService.getLessonHistoryById(req.params.id);
    if (!lesson) {
      return res.status(404).json({ success: false, error: "Không tìm thấy bài học trong lịch sử" });
    }
    res.json({ success: true, data: lesson });
  } catch (err) {
    console.error("Fetch history detail error:", err);
    res.status(500).json({ success: false, error: "Lỗi tải chi tiết bài học" });
  }
});

// Delete lesson history item
app.delete('/api/v1/history/:id', async (req, res) => {
  try {
    const docId = req.params.id;
    await supabaseService.deleteLessonHistory(docId);
    
    // Remove from in-memory db as well
    db.documents = db.documents.filter(d => d.id !== docId);
    delete db.studyPacks[docId];

    res.json({ success: true, message: "Đã xóa bài học khỏi lịch sử thành công!" });
  } catch (err) {
    console.error("Delete history error:", err);
    res.status(500).json({ success: false, error: "Lỗi xóa bài học" });
  }
});

app.post('/api/v1/chat/message', async (req, res) => {
  const { documentId, question, chatHistory } = req.body;
  const doc = db.documents.find(d => d.id === documentId) || db.documents[0];
  
  const reply = await answerStudyQuery(doc.title, doc.rawText || '', question, chatHistory);
  
  res.json({ success: true, answer: reply });
});

// ==========================================
// 🔑 AUTHENTICATION & USER PROFILE ENDPOINTS
// ==========================================

// Login Route
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Vui lòng nhập Email và Mật khẩu" });
    }

    const authResult = await supabaseService.signInUser(email, password);
    res.json({
      success: true,
      message: "Đăng nhập thành công!",
      user: authResult.user,
      session: authResult.session
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(401).json({ success: false, error: err.message || "Đăng nhập thất bại" });
  }
});

// Signup Route
app.post('/api/v1/auth/signup', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Vui lòng điền đầy đủ Email và Mật khẩu" });
    }

    const authResult = await supabaseService.signUpUser(email, password, fullName);
    res.json({
      success: true,
      message: "Đăng ký tài khoản thành công!",
      user: authResult.user,
      session: authResult.session
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(400).json({ success: false, error: err.message || "Đăng ký không thành công" });
  }
});

// Logout Route
app.post('/api/v1/auth/logout', async (req, res) => {
  try {
    await supabaseService.signOutUser();
    res.json({ success: true, message: "Đã đăng xuất phiên làm việc!" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ success: false, error: "Lỗi đăng xuất" });
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 StudyMind AI Multi-Provider Engine running on port ${PORT}`);
  console.log(`🤖 Gemini Multimodal: Active for Long Docs, Vision & Structure`);
  console.log(`⚡ Groq LPU Engine: Active for Fast Reasoning & Chat`);
  console.log(`📡 Healthcheck: http://localhost:${PORT}/api/v1/health`);
  console.log(`====================================================`);
});
