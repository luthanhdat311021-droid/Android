import dotenv from 'dotenv';
import { GeminiProvider } from './GeminiProvider.js';
import { GroqProvider } from './GroqProvider.js';
import { aiCache, AICache } from './AICache.js';
import { PROMPT_VERSIONS } from './PromptManager.js';
dotenv.config();

export class AIRouter {
  constructor() {
    this.gemini = new GeminiProvider();
    this.groq = new GroqProvider();
    this.mode = process.env.AI_PROVIDER || 'auto';
  }

  /**
   * Determine primary provider based on task and document type
   */
  selectPrimaryProvider(task, options = {}) {
    if (this.mode === 'gemini') return this.gemini;
    if (this.mode === 'groq') return this.groq;

    // Auto Routing rules
    if (task === 'image_analysis' || task === 'long_document_analysis' || options.isVision) {
      return this.gemini;
    }

    if (task === 'quick_summary' || task === 'flashcards' || task === 'quiz' || task === 'chat') {
      return this.groq;
    }

    return this.groq;
  }

  getSecondaryProvider(primaryProvider) {
    return primaryProvider === this.gemini ? this.groq : this.gemini;
  }

  /**
   * Generic execution wrapper with Multi-Provider Fallback
   */
  async executeWithFallback(task, executionFn, options = {}) {
    const primary = this.selectPrimaryProvider(task, options);
    const secondary = this.getSecondaryProvider(primary);

    console.log(`🧭 [AI Router] Routing task "${task}" -> Primary: ${primary.name}`);

    // Try Primary Provider with retry
    try {
      return await executionFn(primary);
    } catch (primaryErr) {
      console.warn(`⚠️ [AI Router] Primary provider ${primary.name} failed for task "${task}": ${primaryErr.message}`);
      console.log(`🔄 [AI Router] Falling back to Secondary Provider: ${secondary.name}`);
      
      // Try Secondary Provider
      try {
        return await executionFn(secondary);
      } catch (secondaryErr) {
        console.error(`❌ [AI Router] Secondary provider ${secondary.name} also failed: ${secondaryErr.message}`);
        throw secondaryErr;
      }
    }
  }

  /**
   * Analyze document with caching & fallback
   */
  async analyzeDocument(content, metadata = {}) {
    const cacheKey = AICache.generateKey(content, 'document_analysis', this.mode, PROMPT_VERSIONS.DOCUMENT_ANALYSIS);
    const cached = aiCache.get(cacheKey);
    if (cached) return cached;

    const taskType = metadata.isVision ? 'image_analysis' : (content.length > 8000 ? 'long_document_analysis' : 'quick_summary');

    try {
      const result = await this.executeWithFallback(taskType, (provider) => provider.analyzeDocument(content, metadata), metadata);
      aiCache.set(cacheKey, result);
      return result;
    } catch (err) {
      console.warn("⚠️ [AI Router] All AI Providers failed. Generating Intelligent Domain Knowledge Base.");
      return this.generateDomainFallbackKnowledge(metadata.title || "Tài liệu học tập", content);
    }
  }

  /**
   * Generate Notes from Knowledge Base JSON
   */
  async generateNotes(knowledgeJson) {
    const cacheKey = AICache.generateKey(JSON.stringify(knowledgeJson), 'notes', this.mode, PROMPT_VERSIONS.NOTES_GENERATION);
    const cached = aiCache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.executeWithFallback('quick_summary', (provider) => provider.generateNotes(knowledgeJson));
      aiCache.set(cacheKey, result);
      return result;
    } catch (err) {
      return {
        summaryTitle: knowledgeJson.title || "Tóm tắt bài học",
        summary: knowledgeJson.summary || "Nội dung tóm tắt cốt lõi.",
        keyTakeaways: knowledgeJson.keyTakeaways || ["Nội dung học tập trọng tâm"],
        sections: (knowledgeJson.sections || []).map(s => ({
          heading: (s.title || "MỤC BÀI HỌC").toUpperCase(),
          items: (s.keyPoints || ["Chi tiết bài học"]).map(pt => ({ label: "Ý chính", text: pt }))
        }))
      };
    }
  }

  /**
   * Generate Mindmap from Knowledge Base JSON
   */
  async generateMindmap(knowledgeJson) {
    const cacheKey = AICache.generateKey(JSON.stringify(knowledgeJson), 'mindmap', this.mode, PROMPT_VERSIONS.MINDMAP_GENERATION);
    const cached = aiCache.get(cacheKey);
    if (cached) return this.normalizeAndValidateMindmap(cached, knowledgeJson.title);

    try {
      const rawResult = await this.executeWithFallback('long_document_analysis', (provider) => provider.generateMindmap(knowledgeJson));
      const validatedResult = this.normalizeAndValidateMindmap(rawResult, knowledgeJson.title);
      aiCache.set(cacheKey, validatedResult);
      return validatedResult;
    } catch (err) {
      console.warn("⚠️ [AI Router] Deep Mindmap generation fallback activated:", err.message);
      return this.generateDomainFallbackMindmap(knowledgeJson);
    }
  }

  /**
   * Incremental AI Node Expansion
   */
  async expandNode(targetNode, docContext = "") {
    try {
      const prompt = PromptManager.getNodeExpansionPrompt(targetNode, docContext);
      const resText = await this.executeWithFallback('quick_summary', (provider) => provider.generateText(prompt));
      const parsed = typeof resText === 'string' ? JSON.parse(resText.replace(/```json|```/g, '').trim()) : resText;
      return parsed;
    } catch (err) {
      console.warn("⚠️ [AI Router] Node expansion fallback activated:", err.message);
      return {
        expandedNodes: [
          {
            id: `sub-${Date.now()}-1`,
            parentId: targetNode.id,
            label: `Chi tiết 1 về ${targetNode.label}`,
            shortLabel: "Chi tiết 1",
            type: "concept",
            summary: `Giải thích chi tiết kiến thức liên quan đến ${targetNode.label}.`,
            importance: 3,
            level: (targetNode.level || 2) + 1,
            children: []
          },
          {
            id: `sub-${Date.now()}-2`,
            parentId: targetNode.id,
            label: `Ứng dụng thực tế của ${targetNode.label}`,
            shortLabel: "Ứng dụng",
            type: "application",
            summary: `Ví dụ và ứng dụng thực tiễn trong bài học.`,
            importance: 2,
            level: (targetNode.level || 2) + 1,
            children: []
          }
        ],
        expandedEdges: [
          { id: `edge-exp-${Date.now()}-1`, source: targetNode.id, target: `sub-${Date.now()}-1`, type: "contains" },
          { id: `edge-exp-${Date.now()}-2`, source: targetNode.id, target: `sub-${Date.now()}-2`, type: "contains" }
        ]
      };
    }
  }

  /**
   * Mindmap Schema Validator, Repair & Deduplication Engine
   */
  normalizeAndValidateMindmap(rawMindmap, defaultTitle = "TÀI LIỆU HỌC TẬP") {
    if (!rawMindmap) return this.generateDomainFallbackMindmap({ title: defaultTitle });

    const rootLabel = rawMindmap.root?.label || rawMindmap.rootLabel || defaultTitle.toUpperCase();
    const root = {
      id: rawMindmap.root?.id || 'root-node',
      label: rootLabel,
      shortLabel: rawMindmap.root?.shortLabel || rootLabel.slice(0, 20),
      type: 'topic',
      summary: rawMindmap.root?.summary || `Sơ đồ tư duy tổng quan bài học: ${rootLabel}`,
      importance: 5,
      level: 0
    };

    const rawNodes = Array.isArray(rawMindmap.nodes) ? rawMindmap.nodes : [];
    const validNodesMap = new Map();
    const uniqueLabels = new Set();
    let maxDepth = 1;

    // First Pass: Clean and deduplicate nodes
    rawNodes.forEach((n, idx) => {
      if (!n || !n.label) return;
      const cleanLabel = n.label.trim();
      const labelKey = cleanLabel.toLowerCase();
      
      // Skip exact duplicates
      if (uniqueLabels.has(labelKey)) return;
      uniqueLabels.add(labelKey);

      const nodeId = n.id || `node-${idx + 1}`;
      const parentId = n.parentId || 'root-node';
      const level = typeof n.level === 'number' ? n.level : (parentId === 'root-node' ? 1 : 2);
      if (level > maxDepth) maxDepth = level;

      validNodesMap.set(nodeId, {
        id: nodeId,
        parentId,
        label: cleanLabel,
        shortLabel: n.shortLabel || cleanLabel.slice(0, 25),
        type: n.type || (level === 1 ? 'subtopic' : 'concept'),
        summary: n.summary || n.detail || `Khái niệm kiến thức: ${cleanLabel}`,
        importance: typeof n.importance === 'number' ? Math.min(5, Math.max(1, n.importance)) : (level === 1 ? 4 : 3),
        level,
        children: Array.isArray(n.children) ? n.children : [],
        source: n.source || { section: "Bài học" }
      });
    });

    const nodesList = [root, ...Array.from(validNodesMap.values()).filter(n => n.id !== 'root-node')];
    const validNodeIds = new Set(nodesList.map(n => n.id));

    // Reconstruct children pointers
    nodesList.forEach(n => {
      if (n.parentId && validNodesMap.has(n.parentId)) {
        const parent = validNodesMap.get(n.parentId);
        if (parent && !parent.children.includes(n.id)) {
          parent.children.push(n.id);
        }
      }
    });

    // Build Edges
    const edgesList = [];
    const edgeSet = new Set();

    nodesList.forEach(n => {
      if (n.id === 'root-node') return;
      const pId = (n.parentId && validNodeIds.has(n.parentId)) ? n.parentId : 'root-node';
      const edgeKey = `${pId}->${n.id}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edgesList.push({
          id: `edge-${pId}-${n.id}`,
          source: pId,
          target: n.id,
          type: 'contains'
        });
      }
    });

    // Include cross-link edges if present in rawMindmap
    if (Array.isArray(rawMindmap.edges)) {
      rawMindmap.edges.forEach(e => {
        if (e && validNodeIds.has(e.source) && validNodeIds.has(e.target)) {
          const crossKey = `${e.source}->${e.target}`;
          if (!edgeSet.has(crossKey)) {
            edgeSet.add(crossKey);
            edgesList.push({
              id: e.id || `edge-${e.source}-${e.target}`,
              source: e.source,
              target: e.target,
              type: e.type || 'related_to'
            });
          }
        }
      });
    }

    return {
      rootLabel: root.label,
      root,
      nodes: nodesList,
      edges: edgesList,
      metadata: {
        totalNodes: nodesList.length,
        maxDepth
      }
    };
  }

  /**
   * Fallback Deep Mindmap generator
   */
  generateDomainFallbackMindmap(knowledgeJson = {}) {
    const title = (knowledgeJson.title || "BÀI HỌC TỔNG HỢP").toUpperCase();
    const concepts = Array.isArray(knowledgeJson.concepts) ? knowledgeJson.concepts : [];

    const root = {
      id: 'root-node',
      label: title,
      shortLabel: title.slice(0, 20),
      type: 'topic',
      summary: knowledgeJson.summary || `Sơ đồ tư duy bài học ${title}`,
      importance: 5,
      level: 0
    };

    const topics = knowledgeJson.topics || ["Khái niệm chính", "Cấu trúc & Nguyên lý", "Ứng dụng & Bài tập"];
    const nodes = [root];
    const edges = [];

    topics.forEach((topName, tIdx) => {
      const topId = `top-${tIdx + 1}`;
      nodes.push({
        id: topId,
        parentId: 'root-node',
        label: topName,
        shortLabel: topName,
        type: 'subtopic',
        summary: `Chủ đề chính ${tIdx + 1}: ${topName}`,
        importance: 4,
        level: 1,
        children: [],
        source: { section: topName }
      });

      edges.push({ id: `edge-root-${topId}`, source: 'root-node', target: topId, type: 'contains' });

      // Add 2-3 concept sub-nodes per topic
      const subConcepts = concepts.slice(tIdx * 2, tIdx * 2 + 2);
      if (subConcepts.length > 0) {
        subConcepts.forEach((c, cIdx) => {
          const cId = `c-${tIdx + 1}-${cIdx + 1}`;
          nodes.push({
            id: cId,
            parentId: topId,
            label: c.name || `Ý chính ${cIdx + 1}`,
            shortLabel: (c.name || `Ý ${cIdx + 1}`).slice(0, 20),
            type: c.type || 'concept',
            summary: c.description || `Mô tả chi tiết bài học.`,
            importance: c.importance || 3,
            level: 2,
            children: [],
            source: c.source || { section: topName }
          });
          edges.push({ id: `edge-${topId}-${cId}`, source: topId, target: cId, type: 'contains' });
        });
      } else {
        const cId = `c-${tIdx + 1}-1`;
        nodes.push({
          id: cId,
          parentId: topId,
          label: `Chi tiết kiến thức ${topName}`,
          shortLabel: `Chi tiết ${tIdx + 1}`,
          type: 'concept',
          summary: `Nội dung cốt lõi của ${topName}`,
          importance: 3,
          level: 2,
          children: [],
          source: { section: topName }
        });
        edges.push({ id: `edge-${topId}-${cId}`, source: topId, target: cId, type: 'contains' });
      }
    });

    return {
      rootLabel: title,
      root,
      nodes,
      edges,
      metadata: { totalNodes: nodes.length + 1, maxDepth: 2 }
    };
  }

  /**
  /**
   * Generate Flashcards from Knowledge Base JSON (Supporting User Controls & Source Grounding)
   */
  async generateFlashcards(knowledgeJson, userSettings = {}) {
    const targetCount = userSettings.flashcardCount || 12;
    const cacheKey = AICache.generateKey(JSON.stringify(knowledgeJson) + JSON.stringify(userSettings), 'flashcards', this.mode, PROMPT_VERSIONS.FLASHCARD_GENERATION);
    const cached = aiCache.get(cacheKey);
    if (cached && Array.isArray(cached) && cached.length >= 5) return cached;

    try {
      const result = await this.executeWithFallback('flashcards', (provider) => provider.generateFlashcards(knowledgeJson, userSettings));
      if (Array.isArray(result) && result.length >= 5) {
        aiCache.set(cacheKey, result);
        return result;
      }
    } catch (err) {
      console.warn("⚠️ [AI Router] Flashcards generation AI fallback activated:", err.message);
    }

    // Dynamic Source-Grounded Fallback Generator (Ensuring Front & Back are distinct and not redundant)
    const concepts = knowledgeJson.concepts || [];
    const title = knowledgeJson.title || "Tài liệu học tập";
    const cards = [];

    concepts.slice(0, targetCount).forEach((c, i) => {
      const name = (c.name || `Thuật ngữ ${i + 1}`).trim();
      const desc = (c.description || name).trim();
      
      // Determine if name is just a substring of desc
      const isSubstring = desc.toLowerCase().startsWith(name.toLowerCase());
      const remainingDesc = isSubstring ? desc.slice(name.length).replace(/^[\s\:\-\=]+/, '').trim() : desc;

      let frontText = "";
      let backText = "";

      if (i % 3 === 0 && desc.length > 20) {
        // Cloze / Fill-in-the-blank type card
        const words = desc.split(' ');
        const pickIdx = Math.floor(words.length / 2);
        const targetWord = words[pickIdx] || "replace me";
        const clozeSentence = words.map((w, idx) => idx === pickIdx ? "______" : w).join(' ');

        frontText = `Điền từ thích hợp vào chỗ trống trong bài học:\n"${clozeSentence}"`;
        backText = `Từ cần điền: "${targetWord}"\n\nNội dung đầy đủ: ${desc}`;
      } else if (remainingDesc.length > 10) {
        // Definition / Explanation card
        frontText = `Khái niệm / Quy định: "${name}"`;
        backText = remainingDesc.charAt(0).toUpperCase() + remainingDesc.slice(1);
      } else {
        // General Concept Question
        frontText = `Ý nghĩa và ứng dụng của "${name}" trong tài liệu "${title}" là gì?`;
        backText = desc;
      }

      cards.push({
        id: `fc_${String(i + 1).padStart(3, '0')}`,
        type: i % 3 === 0 ? "cloze" : (i % 2 === 0 ? "definition" : "concept"),
        topicId: knowledgeJson.topics?.[0] || "topic_001",
        conceptId: c.id || `concept_${i + 1}`,
        front: frontText,
        back: backText,
        hint: c.type || "Kiến thức trọng tâm",
        difficulty: userSettings.difficulty && userSettings.difficulty !== 'mixed' ? userSettings.difficulty : (i % 3 === 0 ? "hard" : (i % 2 === 0 ? "medium" : "easy")),
        importance: c.importance || 3,
        tags: [title.toLowerCase().slice(0, 15), "study-mind"],
        source: c.source || { documentId: knowledgeJson.id || 'doc-1', page: 1, section: title }
      });
    });

    while (cards.length < Math.min(10, targetCount)) {
      const idx = cards.length + 1;
      cards.push({
        id: `fc_${String(idx).padStart(3, '0')}`,
        type: "concept",
        topicId: "topic_001",
        conceptId: `concept_${idx}`,
        front: `Điểm trọng tâm số ${idx} cần lưu ý trong tài liệu "${title}" là gì?`,
        back: `Kiến thức cốt lõi mục ${idx} hỗ trợ củng cố sự hiểu biết tổng quan về bài học.`,
        hint: "Gợi ý ôn tập",
        difficulty: "medium",
        importance: 3,
        tags: ["study-mind"],
        source: { documentId: knowledgeJson.id || 'doc-1', page: 1, section: "Tổng quan" }
      });
    }

    aiCache.set(cacheKey, cards);
    return cards;
  }

  /**
   * Generate Quiz from Knowledge Base JSON (Supporting User Controls & Source Grounding)
   */
  async generateQuiz(knowledgeJson, userSettings = {}) {
    const targetCount = userSettings.quizCount || 12;
    const cacheKey = AICache.generateKey(JSON.stringify(knowledgeJson) + JSON.stringify(userSettings), 'quiz', this.mode, PROMPT_VERSIONS.QUIZ_GENERATION);
    const cached = aiCache.get(cacheKey);
    if (cached && cached.questions && cached.questions.length >= 5) return cached;

    try {
      const result = await this.executeWithFallback('quiz', (provider) => provider.generateQuiz(knowledgeJson, userSettings));
      if (result && Array.isArray(result.questions) && result.questions.length >= 5) {
        aiCache.set(cacheKey, result);
        return result;
      }
    } catch (err) {
      console.warn("⚠️ [AI Router] Quiz generation AI fallback activated:", err.message);
    }

    // Dynamic Source-Grounded Quiz Fallback Generator
    const concepts = knowledgeJson.concepts || [];
    const title = knowledgeJson.title || "Tài liệu học tập";
    const questions = [];

    concepts.slice(0, targetCount).forEach((c, i) => {
      const name = (c.name || `Khái niệm ${i + 1}`).trim();
      const desc = (c.description || name).trim();
      questions.push({
        id: `q_${String(i + 1).padStart(3, '0')}`,
        type: "multiple_choice",
        topicId: knowledgeJson.topics?.[0] || "topic_001",
        conceptId: c.id || `concept_${i + 1}`,
        questionNumber: i + 1,
        questionText: `Nhận định nào sau đây mô tả ĐÚNG nhất về "${name}" trong bài học?`,
        options: [
          `A. ${desc.length > 110 ? desc.slice(0, 107) + '...' : desc}`,
          `B. ${name} không có vai trò nào được đề cập trong nội dung tài liệu.`,
          `C. ${name} thuộc về một cấu trúc/quy trình thử nghiệm khác.`,
          `D. Tất cả các phương án trên đều sai.`
        ],
        correctIndex: 0,
        explanation: `Đáp án A chính xác! Dựa trên tài liệu "${title}": ${desc}`,
        difficulty: userSettings.difficulty && userSettings.difficulty !== 'mixed' ? userSettings.difficulty : (i % 3 === 0 ? "hard" : (i % 2 === 0 ? "medium" : "easy")),
        importance: c.importance || 3,
        source: c.source || { documentId: knowledgeJson.id || 'doc-1', page: 1, section: title }
      });
    });

    while (questions.length < Math.min(10, targetCount)) {
      const idx = questions.length + 1;
      questions.push({
        id: `q_${String(idx).padStart(3, '0')}`,
        type: "multiple_choice",
        topicId: "topic_001",
        conceptId: `concept_${idx}`,
        questionNumber: idx,
        questionText: `Trong bài học "${title}", nhận định nào sau đây là ĐÚNG về mục ${idx}?`,
        options: [
          `A. Kiến thức mục ${idx} đóng vai trò cốt lõi trong việc hình thành hiểu biết tổng quan bài học.`,
          `B. Mục ${idx} không được đề cập trong nội dung tài liệu.`,
          `C. Mục ${idx} chỉ áp dụng cho bài tập lý thuyết đơn giản.`,
          `D. Cả B và C đều đúng.`
        ],
        correctIndex: 0,
        explanation: `Đáp án A chính xác! Đây là phần kiến thức quan trọng trích xuất từ tài liệu học tập.`,
        difficulty: "medium",
        importance: 3,
        source: { documentId: knowledgeJson.id || 'doc-1', page: 1, section: "Tổng quan" }
      });
    }

    const quizObj = {
      title: `Đề kiểm tra trắc nghiệm AI: ${title}`,
      subject: knowledgeJson.topics?.[0] || title,
      timeLimitMinutes: Math.min(60, Math.max(5, Math.ceil(questions.length * 1.2))),
      questions
    };

    aiCache.set(cacheKey, quizObj);
    return quizObj;
  }

  /**
   * Chat assistant query
   */
  async chat(docTitle, docContext, userQuestion, chatHistory = []) {
    return await this.executeWithFallback('chat', (provider) => provider.chat(docTitle, docContext, userQuestion, chatHistory));
  }

  /**
   * Intelligent fallback knowledge generation when offline or rate-limited
   */
  generateDomainFallbackKnowledge(title, content) {
    const rawLines = content
      ? content.split('\n').map(l => l.trim()).filter(l => l.length > 5 && !l.startsWith('PK') && !l.startsWith('[Tài liệu'))
      : [];

    const topicHeading = rawLines.find(l => l.length > 5 && l.length < 90) || title;

    // Extract dynamic concepts directly from the document lines with smart title parsing
    const concepts = rawLines.slice(0, 15).map((line, idx) => {
      let conceptType = 'concept';
      if (line.toLowerCase().includes('định nghĩa') || line.toLowerCase().includes('khái niệm')) conceptType = 'definition';
      else if (line.toLowerCase().includes('ví dụ') || line.toLowerCase().includes('minh họa')) conceptType = 'example';
      else if (line.toLowerCase().includes('công thức') || line.includes('=')) conceptType = 'formula';
      else if (line.toLowerCase().includes('quy trình') || line.toLowerCase().includes('bước')) conceptType = 'process';

      let label = "";
      let description = line;

      // Smart title extraction: split on colon or dash if present
      if (line.includes(':')) {
        const parts = line.split(':');
        label = parts[0].replace(/^[\d\.\-\*\#\s\:\•\–]+/, '').trim();
        description = parts.slice(1).join(':').trim() || line;
      } else if (line.includes(' - ')) {
        const parts = line.split(' - ');
        label = parts[0].replace(/^[\d\.\-\*\#\s\:\•\–]+/, '').trim();
        description = parts.slice(1).join(' - ').trim() || line;
      } else {
        // Extract clean noun phrase or key title
        label = line.replace(/^[\d\.\-\*\#\s\:\•\–]+/, '').trim();
        if (label.length > 35) {
          // Take first 5 words as concept name
          const words = label.split(' ');
          label = words.slice(0, 5).join(' ');
        }
      }

      if (!label || label.length < 3) label = `Nội dung bài học ${idx + 1}`;

      return {
        id: `c-${idx + 1}`,
        name: label,
        type: conceptType,
        description,
        importance: idx < 3 ? 5 : (idx < 7 ? 4 : 3),
        source: { section: topicHeading }
      };
    });

    if (concepts.length === 0) {
      concepts.push({
        id: 'c-1',
        name: title,
        type: 'concept',
        description: `Tài liệu ${title} chứa thông tin bài học cốt lõi.`,
        importance: 5,
        source: { section: title }
      });
    }

    // Extract potential subtopics from headings
    const headings = Array.from(new Set(
      rawLines
        .filter(l => (l.length < 60 && (l.match(/^[\d\.\#\–\-]/) || l.includes(':') || l.toUpperCase() === l)))
        .map(l => l.replace(/^[\d\.\#\–\-\:\s]+/, '').trim())
        .filter(l => l.length > 3)
    )).slice(0, 5);

    const topics = headings.length > 0 ? headings : [topicHeading, "Kiến thức trọng tâm"];

    const relationships = concepts.slice(1).map((c, idx) => ({
      source: concepts[idx].id,
      target: c.id,
      type: 'depends_on'
    }));

    return {
      title,
      language: "Tiếng Việt",
      summary: `Tóm tắt nội dung trích xuất từ tài liệu "${title}": ${topicHeading}`,
      difficulty: "medium",
      topics,
      concepts,
      relationships,
      sections: topics.map(t => ({
        title: t,
        summary: `Tóm tắt chi tiết cho mục ${t}`,
        keyPoints: concepts.filter(c => c.description.toLowerCase().includes(t.toLowerCase())).map(c => c.description).slice(0, 3)
      })),
      keyTakeaways: concepts.slice(0, 5).map(c => c.description.slice(0, 90)),
      sources: [{ documentId: "doc-1", page: 1, section: "Trích xuất tài liệu" }]
    };
  }
}

export const aiRouter = new AIRouter();

