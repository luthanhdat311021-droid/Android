import { aiRouter } from './ai/AIRouter.js';
import { parseDocumentContent } from './extractors/documentParser.js';
import { DocumentChunker } from './extractors/chunker.js';

/**
 * Main Enterprise AI Pipeline
 * Workflow: Input -> Extract -> Clean -> Chunk -> AI Router -> Knowledge Base JSON -> Derived Notes/Mindmap/Flashcards/Quiz
 */
export async function processFileAndGenerate(filePath, originalName, mimeType, options = {}, progressCallback = null) {
  console.log(`[AI Pipeline] Starting processing for: "${originalName}"`);
  
  if (progressCallback) progressCallback(10, 'Extracting content');
  
  // 1. Content Extraction
  const rawText = await parseDocumentContent(filePath, originalName, mimeType);

  if (progressCallback) progressCallback(30, 'Chunking & Analyzing');

  // 2. Chunking if document is long (> 8000 chars)
  const isVision = mimeType?.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp'].some(ext => originalName.toLowerCase().endsWith(ext));
  const chunks = DocumentChunker.splitIntoChunks(rawText, 8000);

  // 3. AI Analysis via AI Router
  let knowledgeJson = null;
  if (chunks.length === 1) {
    knowledgeJson = await aiRouter.analyzeDocument(chunks[0], { title: originalName, isVision, filePath, mimeType });
  } else {
    const chunkResults = [];
    for (let i = 0; i < chunks.length; i++) {
      if (progressCallback) progressCallback(30 + Math.round((i / chunks.length) * 30), `Analyzing chunk ${i + 1}/${chunks.length}`);
      const res = await aiRouter.analyzeDocument(chunks[i], { title: `${originalName} (Part ${i + 1})` });
      chunkResults.push(res);
    }
    knowledgeJson = DocumentChunker.mergeKnowledgeBases(chunkResults, originalName);
  }

  if (progressCallback) progressCallback(70, 'Generating Derived Study Pack');

  // 4. Generate Derived AI Artifacts (Notes, Mindmap, Flashcards, Quiz) from Knowledge JSON
  const [notes, mindmap, flashcards, quiz] = await Promise.all([
    aiRouter.generateNotes(knowledgeJson),
    aiRouter.generateMindmap(knowledgeJson),
    aiRouter.generateFlashcards(knowledgeJson),
    aiRouter.generateQuiz(knowledgeJson)
  ]);

  if (progressCallback) progressCallback(100, 'Completed');

  const studyPack = {
    knowledgeBase: knowledgeJson,
    notes,
    mindmap,
    flashcards,
    quiz
  };

  return {
    extractedText: rawText,
    studyPack
  };
}

/**
 * Handle AI Chat queries
 */
export async function answerStudyQuery(docTitle, docText, userQuestion, chatHistory = []) {
  return await aiRouter.chat(docTitle, docText, userQuestion, chatHistory);
}
