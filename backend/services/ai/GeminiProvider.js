import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import dotenv from 'dotenv';
import { AIProvider } from './AIProvider.js';
import { PromptManager, PROMPT_VERSIONS } from './PromptManager.js';
import { SchemaValidator } from './SchemaValidator.js';
import { aiLogger } from './AILogger.js';
dotenv.config();

export class GeminiProvider extends AIProvider {
  constructor() {
    super('Gemini');
    const apiKey = process.env.GEMINI_API_KEY;
    this.genAI = apiKey && apiKey.trim() !== '' ? new GoogleGenerativeAI(apiKey) : null;
    this.models = ["gemini-1.5-flash", "gemini-2.0-flash"];
  }

  fileToGenerativePart(filePath, mimeType) {
    return {
      inlineData: {
        data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
        mimeType
      },
    };
  }

  async executeGeminiCall(promptText, filePart = null) {
    if (!this.genAI) throw new Error("GEMINI_API_KEY not configured or invalid.");

    let lastError = null;
    for (const modelName of this.models) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const parts = filePart ? [promptText, filePart] : [promptText];
        const result = await model.generateContent(parts);
        const response = await result.response;
        return { text: response.text(), modelName };
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ [GeminiProvider ${modelName}] Attempt failed: ${err.message}`);
        if (err.message?.includes('401') || err.message?.includes('invalid authentication') || err.message?.includes('API_KEY')) {
          break;
        }
      }
    }
    throw new Error(`All Gemini models failed. Last error: ${lastError?.message}`);
  }

  async analyzeDocument(content, metadata = {}) {
    const startTime = Date.now();
    const prompt = PromptManager.getDocumentAnalysisPrompt(metadata.title || "Tài liệu học tập", content);

    try {
      let filePart = null;
      if (metadata.filePath && metadata.mimeType) {
        filePart = this.fileToGenerativePart(metadata.filePath, metadata.mimeType);
      }

      const { text, modelName } = await this.executeGeminiCall(prompt, filePart);
      const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const rawObj = JSON.parse(cleanJsonStr);

      const validation = SchemaValidator.validateKnowledgeJson(rawObj);
      aiLogger.log({
        task: 'document_analysis',
        provider: this.name,
        model: modelName,
        latencyMs: Date.now() - startTime,
        status: 'SUCCESS'
      });

      return validation.data;
    } catch (err) {
      aiLogger.log({
        task: 'document_analysis',
        provider: this.name,
        model: 'gemini-all',
        latencyMs: Date.now() - startTime,
        status: 'ERROR',
        error: err.message
      });
      throw err;
    }
  }

  async generateNotes(knowledgeJson) {
    const startTime = Date.now();
    const prompt = PromptManager.getNotesGenerationPrompt(knowledgeJson);
    const { text, modelName } = await this.executeGeminiCall(prompt);
    const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const rawObj = JSON.parse(cleanJsonStr);
    const val = SchemaValidator.validateNotesJson(rawObj);
    aiLogger.log({ task: 'generate_notes', provider: this.name, model: modelName, latencyMs: Date.now() - startTime, status: 'SUCCESS' });
    return val.data;
  }

  async generateMindmap(knowledgeJson) {
    const startTime = Date.now();
    const prompt = PromptManager.getMindmapGenerationPrompt(knowledgeJson);
    const { text, modelName } = await this.executeGeminiCall(prompt);
    const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const rawObj = JSON.parse(cleanJsonStr);
    const val = SchemaValidator.validateMindmapJson(rawObj);
    aiLogger.log({ task: 'generate_mindmap', provider: this.name, model: modelName, latencyMs: Date.now() - startTime, status: 'SUCCESS' });
    return val.data;
  }

  async generateFlashcards(knowledgeJson, userSettings = {}) {
    const startTime = Date.now();
    const prompt = PromptManager.getFlashcardGenerationPrompt(knowledgeJson, userSettings);
    const { text, modelName } = await this.executeGeminiCall(prompt);
    const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const rawObj = JSON.parse(cleanJsonStr);
    const val = SchemaValidator.validateFlashcardsJson(rawObj);
    aiLogger.log({ task: 'generate_flashcards', provider: this.name, model: modelName, latencyMs: Date.now() - startTime, status: 'SUCCESS' });
    return val.cards;
  }

  async generateQuiz(knowledgeJson, userSettings = {}) {
    const startTime = Date.now();
    const prompt = PromptManager.getQuizGenerationPrompt(knowledgeJson, userSettings);
    const { text, modelName } = await this.executeGeminiCall(prompt);
    const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const rawObj = JSON.parse(cleanJsonStr);
    const val = SchemaValidator.validateQuizJson(rawObj);
    aiLogger.log({ task: 'generate_quiz', provider: this.name, model: modelName, latencyMs: Date.now() - startTime, status: 'SUCCESS' });
    return val.quiz;
  }

  async chat(docTitle, docContext, userQuestion, chatHistory = []) {
    const startTime = Date.now();
    const prompt = `[Tài liệu]: ${docTitle}\n[Ngữ cảnh]: ${docContext.slice(0, 4000)}\n[Lịch sử]: ${JSON.stringify(chatHistory.slice(-4))}\n[Câu hỏi]: ${userQuestion}\nHãy trả lời bằng Tiếng Việt súc tích, chính xác.`;
    const { text, modelName } = await this.executeGeminiCall(prompt);
    aiLogger.log({ task: 'chat', provider: this.name, model: modelName, latencyMs: Date.now() - startTime, status: 'SUCCESS' });
    return text;
  }

  async analyzeFusion(documents) {
    const startTime = Date.now();
    const prompt = PromptManager.getKnowledgeFusionPrompt(documents);
    const { text, modelName } = await this.executeGeminiCall(prompt);
    const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const rawObj = JSON.parse(cleanJsonStr);
    aiLogger.log({ task: 'knowledge_fusion', provider: this.name, model: modelName, latencyMs: Date.now() - startTime, status: 'SUCCESS' });
    return rawObj;
  }
}
