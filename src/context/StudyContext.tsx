import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  TabType, 
  User, 
  UserStats, 
  DocumentItem, 
  ActiveDocumentData, 
  OutputOptions,
  MindmapNode,
  Flashcard,
  QuizQuestion,
  LessonHistoryItem
} from '../types';

interface StudyContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  user: User;
  stats: UserStats | null;
  documents: DocumentItem[];
  activeDocId: string;
  setActiveDocId: (id: string) => void;
  activeDocData: ActiveDocumentData | null;
  fetchDocumentDetail: (docId: string) => Promise<void>;
  loading: boolean;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  uploadDocument: (file: File | null, language: string, depth: string, options: OutputOptions) => Promise<any>;
  processVideo: (videoUrl: string) => Promise<void>;
  processUrl: (url: string) => Promise<void>;
  reviewFlashcard: (cardId: string, rating: string) => Promise<void>;
  submitQuiz: (quizId: string, answers: Record<string, number>) => Promise<any>;
  sendChatMessage: (documentId: string, question: string, history: any[]) => Promise<string>;
  
  // Mindmap Operations
  addMindmapNode: (nodeData: Partial<MindmapNode>) => Promise<void>;
  updateMindmapNode: (nodeId: string, nodeData: Partial<MindmapNode>) => Promise<void>;
  deleteMindmapNode: (nodeId: string) => Promise<void>;
  expandMindmapNodeAI: (node: MindmapNode) => Promise<void>;

  // Flashcard Operations
  addFlashcard: (cardData: Partial<Flashcard>) => Promise<void>;
  deleteFlashcard: (cardId: string) => Promise<void>;
  regenerateFlashcardsAI: (docId?: string) => Promise<void>;

  // Quiz Operations
  addQuizQuestion: (questionData: Partial<QuizQuestion>) => Promise<void>;
  regenerateQuizAI: (docId?: string) => Promise<void>;

  // Lesson History Operations (Supabase Integration)
  historyList: LessonHistoryItem[];
  isSupabaseActive: boolean;
  fetchHistory: () => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<void>;
  continueLessonFromHistory: (id: string) => Promise<void>;

  // Auth & User Personalization
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authMode: 'login' | 'signup';
  openAuthModal: (mode?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  login: (email?: string, password?: string) => Promise<any>;
  signup: (fullName: string, email: string, password?: string) => Promise<any>;
  logout: () => Promise<void>;
}

const StudyContext = createContext<StudyContextType | null>(null);

export function StudyProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  const [user, setUser] = useState<User>(() => {
    const saved = localStorage.getItem('studymind_user_session');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      fullName: "Học viên StudyMind",
      email: "student@studymind.ai",
      membershipTier: "Basic",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    };
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('studymind_user_session'));
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const openAuthModal = (mode: 'login' | 'signup' = 'login') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
    setActiveTab('auth');
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    if (activeTab === 'auth') {
      setActiveTab('dashboard');
    }
  };

  const login = async (email?: string, password?: string) => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        setIsAuthenticated(true);
        localStorage.setItem('studymind_user_session', JSON.stringify(data.user));
        showToast(`🎉 Chào mừng trở lại, ${data.user.fullName}!`);
        await fetchHistory();
      }
      return data;
    } catch (err: any) {
      console.error("Login error:", err);
      return { success: false, error: err.message };
    }
  };

  const signup = async (fullName: string, email: string, password?: string) => {
    try {
      const res = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        setIsAuthenticated(true);
        localStorage.setItem('studymind_user_session', JSON.stringify(data.user));
        showToast(`✨ Tạo tài khoản thành công! Chào mừng ${data.user.fullName}!`);
        await fetchHistory();
      }
      return data;
    } catch (err: any) {
      console.error("Signup error:", err);
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch (err) {}
    localStorage.removeItem('studymind_user_session');
    setIsAuthenticated(false);
    setUser({
      fullName: "Khách ghé thăm",
      membershipTier: "Basic",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"
    });
    showToast("👋 Đã đăng xuất tài khoản!");
  };

  const [stats, setStats] = useState<UserStats | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>('doc-1');
  const [activeDocData, setActiveDocData] = useState<ActiveDocumentData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [historyList, setHistoryList] = useState<LessonHistoryItem[]>([]);
  const [isSupabaseActive, setIsSupabaseActive] = useState<boolean>(false);

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/v1/user/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
        setDocuments(data.data.recentDocuments || []);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard stats:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/v1/history');
      const data = await res.json();
      if (data.success) {
        setHistoryList(data.data || []);
        setIsSupabaseActive(Boolean(data.isSupabaseActive));
      }
    } catch (err) {
      console.error("Failed to fetch lesson history:", err);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/history/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast("🗑️ Đã xóa bài học khỏi lịch sử!");
        await fetchHistory();
        await fetchDashboardStats();
      }
    } catch (err) {
      console.error("Delete history item error:", err);
    }
  };

  const continueLessonFromHistory = async (id: string) => {
    await fetchDocumentDetail(id);
    setActiveTab('workspace');
  };

  const fetchDocumentDetail = async (docId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/documents/${docId}`);
      const data = await res.json();
      if (data.success) {
        setActiveDocData(data);
        setActiveDocId(docId);
      }
    } catch (err) {
      console.error(`Failed to fetch doc ${docId}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    fetchHistory();
    fetchDocumentDetail('doc-1');
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const uploadDocument = async (file: File | null, language: string, depth: string, options: OutputOptions) => {
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      formData.append('language', language);
      formData.append('depth', depth);
      formData.append('options', JSON.stringify(options));

      const res = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        showToast("🚀 Đã chuyển hóa tài liệu thành công!");
        await fetchDashboardStats();
        await fetchHistory();
        setActiveDocData({ document: data.document, studyPack: data.studyPack });
        setActiveDocId(data.document.id);
        setActiveTab('workspace');
      }
      return data;
    } catch (err) {
      console.error("Upload document failed:", err);
      showToast("❌ Lỗi tải tài liệu!");
    }
  };

  const processVideo = async (videoUrl: string) => {
    try {
      const res = await fetch('/api/v1/documents/process-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl })
      });
      const data = await res.json();
      if (data.success) {
        showToast("📹 Đã trích xuất transcript từ Video!");
        await fetchDashboardStats();
        setActiveDocData({ document: data.document, studyPack: data.studyPack });
        setActiveDocId(data.document.id);
        setActiveTab('workspace');
      }
    } catch (err) {
      console.error("Process video failed:", err);
    }
  };

  const processUrl = async (url: string) => {
    try {
      const res = await fetch('/api/v1/documents/process-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.success) {
        showToast("🔗 Đã trích xuất bài viết Web thành công!");
        await fetchDashboardStats();
        setActiveDocData({ document: data.document, studyPack: data.studyPack });
        setActiveDocId(data.document.id);
        setActiveTab('workspace');
      }
    } catch (err) {
      console.error("Process URL failed:", err);
    }
  };

  // Mindmap Operations
  const addMindmapNode = async (nodeData: Partial<MindmapNode>) => {
    try {
      const res = await fetch(`/api/v1/documents/${activeDocId}/mindmap/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nodeData)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🌿 Đã thêm nút mới vào sơ đồ tư duy: "${nodeData.label}"`);
        await fetchDocumentDetail(activeDocId);
      }
    } catch (err) {
      console.error("Add mindmap node failed:", err);
    }
  };

  const updateMindmapNode = async (nodeId: string, nodeData: Partial<MindmapNode>) => {
    try {
      const res = await fetch(`/api/v1/documents/${activeDocId}/mindmap/nodes/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nodeData)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✏️ Đã cập nhật nút sơ đồ tư duy!`);
        await fetchDocumentDetail(activeDocId);
      }
    } catch (err) {
      console.error("Update mindmap node failed:", err);
    }
  };

  const deleteMindmapNode = async (nodeId: string) => {
    try {
      const res = await fetch(`/api/v1/documents/${activeDocId}/mindmap/nodes/${nodeId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🗑️ Đã xóa nút sơ đồ tư duy!`);
        await fetchDocumentDetail(activeDocId);
      }
    } catch (err) {
      console.error("Delete mindmap node failed:", err);
    }
  };

  // Flashcard Operations
  const addFlashcard = async (cardData: Partial<Flashcard>) => {
    try {
      const res = await fetch(`/api/v1/documents/${activeDocId}/flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardData)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`➕ Đã tạo thẻ ghi nhớ mới thành công!`);
        await fetchDocumentDetail(activeDocId);
      }
    } catch (err) {
      console.error("Add flashcard failed:", err);
    }
  };

  const reviewFlashcard = async (cardId: string, rating: string) => {
    try {
      const res = await fetch(`/api/v1/flashcards/${cardId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
      }
    } catch (err) {
      console.error("Review flashcard failed:", err);
    }
  };

  const deleteFlashcard = async (cardId: string) => {
    try {
      const res = await fetch(`/api/v1/flashcards/${cardId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🗑️ Đã xóa thẻ ghi nhớ!`);
        await fetchDocumentDetail(activeDocId);
      }
    } catch (err) {
      console.error("Delete flashcard failed:", err);
    }
  };

  // Quiz Operations
  const addQuizQuestion = async (questionData: Partial<QuizQuestion>) => {
    try {
      const res = await fetch(`/api/v1/documents/${activeDocId}/quiz/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questionData)
      });
      const data = await res.json();
      if (data.success) {
        showToast(`❓ Đã thêm câu hỏi trắc nghiệm mới vào bộ kiểm tra!`);
        await fetchDocumentDetail(activeDocId);
      }
    } catch (err) {
      console.error("Add quiz question failed:", err);
    }
  };

  const submitQuiz = async (quizId: string, answers: Record<string, number>) => {
    try {
      const res = await fetch(`/api/v1/quiz/${quizId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      if (data.success) {
        fetchDashboardStats();
        fetchHistory();
      }
      return data;
    } catch (err) {
      console.error("Submit quiz failed:", err);
    }
  };

  const sendChatMessage = async (documentId: string, question: string, history: any[]) => {
    try {
      const res = await fetch('/api/v1/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, question, chatHistory: history })
      });
      const data = await res.json();
      return data.answer;
    } catch (err) {
      console.error("Send chat message failed:", err);
      return "Rất tiếc, máy chủ AI đang bận. Bạn vui lòng thử lại sau giây lát.";
    }
  };

  const expandMindmapNodeAI = async (node: MindmapNode) => {
    try {
      showToast(`🤖 AI đang mở rộng và phân tích sâu nút "${node.label}"...`);
      const res = await fetch(`/api/v1/documents/${activeDocId}/mindmap/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✨ Đã đào sâu và tạo các nhánh con cho "${node.label}"!`);
        await fetchDocumentDetail(activeDocId);
      }
    } catch (err) {
      console.error("Expand mindmap node failed:", err);
      showToast("⚠️ Không thể mở rộng nút bằng AI. Vui lòng thử lại.");
    }
  };

  const regenerateQuizAI = async (docId?: string) => {
    const targetId = docId || activeDocId;
    try {
      showToast("🤖 AI đang biên soạn 10-12 câu hỏi trắc nghiệm mới...");
      const res = await fetch(`/api/v1/documents/${targetId}/regenerate-quiz`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success && data.quiz) {
        showToast("✨ Đã sinh mới 10-12 câu hỏi trắc nghiệm thành công!");
        if (activeDocData) {
          setActiveDocData({
            ...activeDocData,
            studyPack: {
              ...activeDocData.studyPack,
              quiz: data.quiz
            }
          });
        }
      }
    } catch (err) {
      console.error("Regenerate quiz failed:", err);
      showToast("❌ Không thể tạo câu hỏi trắc nghiệm lúc này!");
    }
  };

  const regenerateFlashcardsAI = async (docId?: string) => {
    const targetId = docId || activeDocId;
    try {
      showToast("🤖 AI đang khởi tạo 10-12 Thẻ ghi nhớ mới...");
      const res = await fetch(`/api/v1/documents/${targetId}/regenerate-flashcards`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success && data.flashcards) {
        showToast("✨ Đã sinh mới 10-12 Thẻ ghi nhớ thành công!");
        if (activeDocData) {
          setActiveDocData({
            ...activeDocData,
            studyPack: {
              ...activeDocData.studyPack,
              flashcards: data.flashcards
            }
          });
        }
      }
    } catch (err) {
      console.error("Regenerate flashcards failed:", err);
      showToast("❌ Không thể tạo thẻ ghi nhớ lúc này!");
    }
  };

  return (
    <StudyContext.Provider value={{
      activeTab,
      setActiveTab,
      user,
      stats,
      documents,
      activeDocId,
      setActiveDocId,
      activeDocData,
      fetchDocumentDetail,
      loading,
      toastMessage,
      showToast,
      uploadDocument,
      processVideo,
      processUrl,
      reviewFlashcard,
      submitQuiz,
      sendChatMessage,
      addMindmapNode,
      updateMindmapNode,
      deleteMindmapNode,
      expandMindmapNodeAI,
      addFlashcard,
      deleteFlashcard,
      regenerateFlashcardsAI,
      addQuizQuestion,
      regenerateQuizAI,
      historyList,
      isSupabaseActive,
      fetchHistory,
      deleteHistoryItem,
      continueLessonFromHistory,
      isAuthenticated,
      isAuthModalOpen,
      authMode,
      openAuthModal,
      closeAuthModal,
      login,
      signup,
      logout
    }}>
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) throw new Error("useStudy must be used within StudyProvider");
  return context;
}
