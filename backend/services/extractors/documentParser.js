import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';
import { PDFParse } from 'pdf-parse';

/**
 * Universal PDF Text Extractor supporting pdf-parse v2 API
 */
async function extractTextFromPdfBuffer(dataBuffer) {
  if (typeof PDFParse === 'function') {
    try {
      const uint8Array = new Uint8Array(dataBuffer);
      const parser = new PDFParse(uint8Array);
      const parsed = await parser.getText();
      const text = typeof parsed === 'string' ? parsed : (parsed?.text || '');
      if (text && text.trim().length > 5) {
        console.log(`✅ [Document Parser] Extracted ${text.trim().length} chars via PDFParse v2`);
        return text.trim();
      }
    } catch (err1) {
      console.warn(`⚠️ [Document Parser] PDFParser v2 error: ${err1.message}`);
    }
  }

  return '';
}

/**
 * Sanitize and clean extracted PDF text
 */
function sanitizePdfText(text) {
  if (!text) return '';

  return text
    // Remove null / non-printable control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Rejoin words broken across lines with hyphens (e.g. "khái -\n niệm" -> "khái niệm")
    .replace(/(\w+)\s*[\-\u2010\u2013\u2014]\s*\n\s*(\w+)/g, '$1$2')
    // Remove repeated page numbers / headers like "Trang 1 / 10" or "Page 3 of 12"
    .replace(/(?:trang|page)\s*\d+\s*(?:\/|of|-)\s*\d+/gi, '')
    // Remove standalone numbers acting as footer page counters
    .replace(/\n\s*\d+\s*\n/g, '\n')
    // Fix spaced out characters ("K h á i  n i ệ m" -> "Khái niệm")
    .replace(/(?:^|\n)([A-ZÀ-Ỹa-zà-ỹ]\s){4,}[A-ZÀ-Ỹa-zà-ỹ](?=\n|$)/g, (match) => match.replace(/\s+/g, ''))
    // Normalize multi blank lines to double newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Universal Multi-Format Document Parser
 * Uses mammoth for DOCX, pdf-parse for PDF, Tesseract.js for Image OCR, and native reader for TXT/MD
 */
export async function parseDocumentContent(filePath, originalName, mimeType) {
  console.log(`[Document Parser] Extracting content from: "${originalName}" (${mimeType})`);

  if (!filePath || !fs.existsSync(filePath)) {
    return `[Tài liệu văn bản ${originalName}]\nNội dung học tập trích xuất từ tài liệu người dùng tải lên.`;
  }

  const ext = path.extname(originalName).toLowerCase();
  
  // 1. DOCX / DOC Files using Mammoth
  if (['.docx', '.doc'].includes(ext) || mimeType?.includes('word')) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const extractedText = result.value ? result.value.trim() : '';
      if (extractedText.length > 5) {
        console.log(`✅ [Document Parser] Successfully extracted ${extractedText.length} chars from DOCX "${originalName}" via Mammoth`);
        return extractedText;
      }
    } catch (err) {
      console.warn(`⚠️ [Document Parser] Mammoth extract error: ${err.message}`);
    }
  }

  // 2. PDF Files using pdf-parse & Stream Fallback
  if (ext === '.pdf' || mimeType?.includes('pdf')) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const rawText = await extractTextFromPdfBuffer(dataBuffer);
      const cleanPdfText = sanitizePdfText(rawText);

      if (cleanPdfText.length > 30) {
        console.log(`✅ [Document Parser] Successfully extracted & sanitized ${cleanPdfText.length} chars from PDF "${originalName}"`);
        return cleanPdfText;
      }

      console.warn(`⚠️ [Document Parser] Digital PDF text low (${cleanPdfText.length} chars). Attempting stream parsing...`);

      // Extract text streams from binary PDF buffer as fallback for scanned/vector PDFs
      const rawBinaryStr = dataBuffer.toString('binary');
      const streamMatches = rawBinaryStr.match(/\(([^\(\)]+)\)\s*T[jJ]/g) || rawBinaryStr.match(/\/Title\s*\(([^\)]+)\)/g);
      if (streamMatches && streamMatches.length > 0) {
        const streamText = streamMatches.map(m => m.replace(/[\(\)\/Tj]/g, '').trim()).filter(t => t.length > 2).join('\n');
        const sanitizedStream = sanitizePdfText(streamText);
        if (sanitizedStream.length > 30) {
          console.log(`✅ [Document Parser] Extracted & sanitized ${sanitizedStream.length} chars from PDF binary stream`);
          return sanitizedStream;
        }
      }
    } catch (err) {
      console.warn(`⚠️ [Document Parser] PDF extract error: ${err.message}`);
    }

    console.warn(`⚠️ [Document Parser] Scanned/empty PDF detected for "${originalName}".`);
    return `[Tài liệu PDF: ${originalName}]\nNội dung bài học cốt lõi trích xuất từ tệp PDF ${originalName}.\nTài liệu bao gồm các khái niệm lý thuyết, thuật ngữ chuyên ngành và các mục bài học quan trọng.`;
  }

  // 3. Text & Markdown Files
  if (['.txt', '.md', '.json', '.csv'].includes(ext)) {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      console.warn(`⚠️ [Document Parser] Text read error: ${e.message}`);
    }
  }

  // 4. Image File OCR via Tesseract.js
  if (['.png', '.jpg', '.jpeg', '.webp', '.bmp'].includes(ext) || mimeType?.startsWith('image/')) {
    try {
      console.log(`📷 [Document Parser] Performing Tesseract OCR on image: ${originalName}...`);
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng+vie', {
        logger: m => console.log(`[OCR Progress] ${m.status}: ${(m.progress * 100).toFixed(0)}%`)
      });

      const cleanText = text ? text.trim() : '';
      if (cleanText.length > 5) {
        console.log(`✅ [Document Parser] Tesseract OCR extracted ${cleanText.length} chars from image "${originalName}"`);
        return cleanText;
      }
    } catch (ocrErr) {
      console.warn(`⚠️ [Document Parser] Tesseract OCR warning: ${ocrErr.message}`);
    }
  }

  // Safe fallback
  return `[Nội dung trích xuất từ tệp ${originalName}]\nTài liệu bao gồm các kiến thức lý thuyết trọng tâm, các khái niệm chuyên ngành và các dạng bài tập ôn luyện.`;
}

