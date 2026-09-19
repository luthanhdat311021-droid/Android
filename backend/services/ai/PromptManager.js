/**
 * Centralized Prompt Manager with Versioning
 * Stores System Prompts and Version Identifiers
 */
export const PROMPT_VERSIONS = {
  DOCUMENT_ANALYSIS: "DOCUMENT_ANALYSIS_V1",
  NOTES_GENERATION: "NOTES_GENERATION_V1",
  MINDMAP_GENERATION: "MINDMAP_GENERATION_V1",
  FLASHCARD_GENERATION: "FLASHCARD_GENERATION_V1",
  QUIZ_GENERATION: "QUIZ_GENERATION_V1",
  CHAT_ASSISTANT: "CHAT_ASSISTANT_V1"
};

export class PromptManager {
  static getDocumentAnalysisPrompt(title, rawContent) {
    return `
You are an expert educational document analysis engine.
Your task is to analyze learning material and convert it into a structured knowledge representation.
Do not invent information.
Only use information supported by the provided material.
Preserve important terminology.

Identify:
- Main topic
- Subtopics
- Key concepts
- Definitions
- Relationships
- Examples
- Processes
- Important facts
- Formulas
- Rules
- Comparisons
- Cause and effect
- Prerequisites
- Common misconceptions

Document Title: "${title}"
Document Content:
---
${rawContent}
---

The final output MUST follow the required JSON schema strictly.
Every generated concept should be traceable to the source material whenever possible.
Avoid unnecessary repetition.
Prioritize information that is useful for learning and examination.

Return ONLY a valid JSON object matching this exact schema:
{
  "title": "${title}",
  "language": "Tiếng Việt",
  "summary": "Tóm tắt tổng quan ngắn gọn về nội dung tài liệu",
  "difficulty": "medium",
  "topics": ["Tên chủ đề 1", "Tên chủ đề 2"],
  "concepts": [
    {
      "id": "concept-1",
      "name": "Tên khái niệm/công thức/định nghĩa",
      "type": "concept",
      "description": "Mô tả chi tiết và chính xác từ tài liệu",
      "importance": 5,
      "source": { "documentId": "doc-main", "page": 1, "section": "Chương 1" }
    }
  ],
  "relationships": [
    {
      "source": "concept-1",
      "target": "concept-2",
      "type": "depends_on"
    }
  ],
  "sections": [
    {
      "title": "Tên mục chính",
      "summary": "Nội dung tóm tắt mục",
      "keyPoints": ["Ý chính 1", "Ý chính 2"]
    }
  ],
  "keyTakeaways": ["Điểm cốt lõi 1", "Điểm cốt lõi 2"]
}
`;
  }

  static getNotesGenerationPrompt(knowledgeJson) {
    return `
You are an expert educational notes generator.
Generate clear, beautifully structured study notes directly from the provided Knowledge Base JSON.
Do not re-invent or hallucinate facts outside the Knowledge Base.

Knowledge Base JSON:
---
${JSON.stringify(knowledgeJson, null, 2)}
---

Output MUST be a valid JSON object following this exact schema:
{
  "summaryTitle": "Tiêu đề ghi chú tóm tắt bài học",
  "summary": "Tóm tắt tổng quan súc tích",
  "keyTakeaways": ["Điểm ghi nhớ trọng tâm 1", "Điểm ghi nhớ trọng tâm 2"],
  "sections": [
    {
      "heading": "TÊN MỤC CHÍNH (IN HOA)",
      "items": [
        {
          "label": "Tên thuật ngữ/ý chính",
          "text": "Nội dung giải thích chi tiết có ví dụ"
        }
      ]
    }
  ]
}
`;
  }

  static getMindmapGenerationPrompt(knowledgeJson) {
    return `
You are an enterprise-grade AI Deep Knowledge Mindmap Engine.
Your goal is to transform the provided Knowledge Base JSON into a deep, highly structured, multi-level Knowledge Mindmap (20 to 300+ nodes depending on document depth).
DO NOT create a superficial flat list of 5-10 nodes.
Build a comprehensive hierarchical breakdown from general overview -> major topics -> subtopics -> key concepts -> concept details -> formulas/processes -> examples/properties.

Knowledge Base JSON:
---
${JSON.stringify(knowledgeJson, null, 2)}
---

HIERARCHY RULES:
- Level 0: Root Node (Central subject)
- Level 1: Major Topics (Chapters / Main sections)
- Level 2: Subtopics (Sub-chapters / Main sub-themes)
- Level 3: Key Concepts & Definitions
- Level 4: Concept Details / Methods / Formulas / Processes
- Level 5+: Examples, Properties, Applications, Exceptions

NODE TYPES MUST BE ONE OF:
- "topic", "subtopic", "concept", "definition", "process", "method", "formula", "example", "fact", "comparison", "advantage", "disadvantage", "application", "warning", "important"

IMPORTANCE SCORE (1 to 5):
- 5: Core critical concepts (Highlight rank)
- 4: Major important topics
- 3: Standard concepts & definitions
- 2: Supporting details & methods
- 1: Minor examples & extra notes

EDGE RELATIONSHIP TYPES:
- "contains" (parent-child default)
- "depends_on", "related_to", "causes", "produces", "example_of", "type_of", "contrasts_with", "prerequisite_of", "used_for"

OUTPUT FORMAT REQUIREMENT:
Return ONLY a valid JSON object matching this exact schema:
{
  "root": {
    "id": "root-node",
    "label": "TÊN CHỦ ĐỀ CHÍNH",
    "shortLabel": "Tiêu đề ngắn",
    "type": "topic",
    "summary": "Tổng quan kiến thức toàn bộ bài học",
    "importance": 5,
    "level": 0
  },
  "nodes": [
    {
      "id": "node-1",
      "parentId": "root-node",
      "label": "Tên nhánh chính 1",
      "shortLabel": "Nhánh 1",
      "type": "subtopic",
      "summary": "Giải thích chi tiết về nhánh này",
      "importance": 4,
      "level": 1,
      "children": ["node-1-1", "node-1-2"],
      "source": { "section": "Chương 1", "page": 1 }
    },
    {
      "id": "node-1-1",
      "parentId": "node-1",
      "label": "Tên khái niệm 1.1",
      "shortLabel": "Khái niệm 1.1",
      "type": "concept",
      "summary": "Mô tả khái niệm chính xác từ tài liệu",
      "importance": 3,
      "level": 2,
      "children": [],
      "source": { "section": "Mục 1.1", "page": 2 }
    }
  ],
  "edges": [
    {
      "id": "edge-root-1",
      "source": "root-node",
      "target": "node-1",
      "type": "contains"
    },
    {
      "id": "edge-cross-1",
      "source": "node-1-1",
      "target": "node-2-1",
      "type": "depends_on"
    }
  ],
  "metadata": {
    "totalNodes": 25,
    "maxDepth": 4
  }
}
`;
  }

  static getNodeExpansionPrompt(targetNode, docContext = "") {
    return `
You are an expert educational AI Mindmap Expansion Engine.
Your task is to DEEPEN and EXPAND a specific target mindmap node into 3 to 8 sub-branches containing detailed concepts, processes, definitions, and examples derived from the context.

Target Node:
---
${JSON.stringify(targetNode, null, 2)}
---

Document Context:
---
${docContext.slice(0, 4000)}
---

Generate ONLY a valid JSON object containing new child nodes and edges to be attached to the target node:
{
  "expandedNodes": [
    {
      "id": "sub-${Date.now()}-1",
      "parentId": "${targetNode.id}",
      "label": "Tên khái niệm con mở rộng 1",
      "shortLabel": "Khái niệm 1",
      "type": "concept",
      "summary": "Giải thích sâu sắc và chi tiết",
      "importance": 3,
      "level": ${(targetNode.level || 2) + 1},
      "children": []
    }
  ],
  "expandedEdges": [
    {
      "id": "edge-exp-1",
      "source": "${targetNode.id}",
      "target": "sub-${Date.now()}-1",
      "type": "contains"
    }
  ]
}
`;
  }

  static getFlashcardGenerationPrompt(knowledgeJson, userSettings = {}) {
    const targetCount = userSettings.flashcardCount || 12;
    const requestedDifficulty = userSettings.difficulty || "mixed";
    return `
You are the AI Learning Content Generator for StudyMind AI.
Your task is to generate high-quality, SOURCE-GROUNDED Flashcards based STRICTLY on the provided Knowledge Base JSON.

CRITICAL RULES (SOURCE-GROUNDED GENERATION):
1. Use ONLY facts, definitions, formulas, and concepts present in the provided Knowledge Base JSON.
2. DO NOT hallucinate, invent, or bring in outside information not supported by the document.
3. Every flashcard MUST link to a specific conceptId and topicId from the knowledge base, with source references (page, section).
4. Do NOT create duplicate flashcards testing the same concept in the same way.
5. Support a diverse mix of flashcard types: "definition", "concept", "comparison", "process", "formula", "example", "application", "cause_effect", "cloze", "true_false".
6. Assign difficulty levels ("easy", "medium", "hard", "expert") appropriately based on cognitive depth.
7. Target count: EXACTLY ${targetCount} flashcards (or maximum possible high-quality items without hallucinating). Requested difficulty setting: "${requestedDifficulty}".

Knowledge Base JSON:
---
${JSON.stringify(knowledgeJson, null, 2)}
---

Output MUST be a valid JSON object matching this exact schema:
{
  "flashcards": [
    {
      "id": "fc_001",
      "type": "definition",
      "topicId": "topic_001",
      "conceptId": "concept_001",
      "front": "Primary Key là gì?",
      "back": "Primary Key là trường hoặc tập hợp trường dùng để xác định duy nhất mỗi bản ghi trong bảng.",
      "hint": "Gợi ý về đặc tính duy nhất",
      "difficulty": "easy",
      "importance": 5,
      "tags": ["database", "primary-key"],
      "source": {
        "documentId": "${knowledgeJson.id || 'doc-1'}",
        "page": 1,
        "section": "Chủ đề chính"
      }
    }
  ]
}
`;
  }

  static getQuizGenerationPrompt(knowledgeJson, userSettings = {}) {
    const targetCount = userSettings.quizCount || 12;
    const requestedDifficulty = userSettings.difficulty || "mixed";
    return `
You are the AI Learning Content Generator for StudyMind AI.
Your task is to generate a comprehensive, SOURCE-GROUNDED Quiz based STRICTLY on the provided Knowledge Base JSON.

CRITICAL RULES (SOURCE-GROUNDED GENERATION):
1. AI MUST ONLY use information present in the provided Knowledge Base JSON. No outside facts or unsupported claims.
2. Every quiz question MUST test real concepts from the document and link to a specific conceptId & topicId.
3. Every multiple choice question MUST have:
   - Exactly 1 clear question text
   - Exactly 4 options (labelled A, B, C, D)
   - Exactly 1 correct index (0 for A, 1 for B, 2 for C, 3 for D)
   - 3 plausible distractors (related to the topic, not absurd, but unambiguously incorrect based on the source)
   - Detailed educational explanation citing the exact concept/rule in the source document.
4. Support diverse question types: "multiple_choice", "true_false", "fill_blank", "short_answer", "scenario".
5. Distribute difficulty across "easy", "medium", "hard", and "expert" (Target requested difficulty: "${requestedDifficulty}").
6. Target count: EXACTLY ${targetCount} questions.

Knowledge Base JSON:
---
${JSON.stringify(knowledgeJson, null, 2)}
---

Output MUST be a valid JSON object matching this exact schema:
{
  "title": "Đề kiểm tra trắc nghiệm AI: ${knowledgeJson.title || 'Tài liệu học tập'}",
  "subject": "${knowledgeJson.title || 'Trắc nghiệm tổng hợp'}",
  "timeLimitMinutes": 15,
  "questions": [
    {
      "id": "q_001",
      "type": "multiple_choice",
      "topicId": "topic_001",
      "conceptId": "concept_001",
      "questionNumber": 1,
      "questionText": "Mục đích chính của Primary Key trong cơ sở dữ liệu là gì?",
      "options": [
        "A. Xác định duy nhất mỗi bản ghi trong bảng",
        "B. Lưu trữ tất cả dữ liệu dạng văn bản",
        "C. Tự động xóa bảng khi dữ liệu bị lỗi",
        "D. Tạo giao diện người dùng tự động"
      ],
      "correctIndex": 0,
      "explanation": "Primary Key được sử dụng để xác định duy nhất từng dòng/bản ghi trong bảng cơ sở dữ liệu.",
      "difficulty": "easy",
      "importance": 5,
      "source": {
        "documentId": "${knowledgeJson.id || 'doc-1'}",
        "page": 1,
        "section": "Chương 1"
      }
    }
  ]
}
`;
  }

  static getAdaptiveContentPrompt(knowledgeJson, weakConceptIds = []) {
    return `
You are the Adaptive Learning Generator for StudyMind AI.
The user has demonstrated WEAKNESS in specific concepts during recent quizzes/flashcard sessions.

Target Weak Concept IDs:
${JSON.stringify(weakConceptIds)}

Knowledge Base JSON:
---
${JSON.stringify(knowledgeJson, null, 2)}
---

Generate 5 reinforcement flashcards and 5 reinforcement quiz questions specifically targeting these weak concepts to accelerate mastery.
Output MUST be a valid JSON object:
{
  "reinforcementFlashcards": [
    {
      "id": "fc_reinforce_1",
      "conceptId": "concept-id-here",
      "type": "cloze",
      "front": "Nội dung câu hỏi củng cố...",
      "back": "Giải thích củng cố...",
      "difficulty": "medium",
      "hint": "Gợi ý củng cố"
    }
  ],
  "reinforcementQuestions": [
    {
      "id": "q_reinforce_1",
      "conceptId": "concept-id-here",
      "questionText": "Câu hỏi củng cố khái niệm yếu...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctIndex": 0,
      "explanation": "Lời giải chi tiết củng cố kiến thức...",
      "difficulty": "medium"
    }
  ]
}
`;
  }
}
