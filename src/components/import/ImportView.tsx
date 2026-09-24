import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Link as LinkIcon, 
  Edit3, 
  UploadCloud, 
  Loader2,
  X,
  Sparkles
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import mammoth from 'mammoth';
import { useStudy } from '../../context/StudyContext';
import { OutputOptions } from '../../types';

export function ImportView() {
  const { user, isAuthenticated, openAuthModal, uploadDocument, processVideo, processUrl, activeDocData, showToast } = useStudy();

  const [activeSourceTab, setActiveSourceTab] = useState<'doc' | 'image' | 'video' | 'url' | 'text'>('doc');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [webUrlInput, setWebUrlInput] = useState<string>('');
  const [rawTextInput, setRawTextInput] = useState<string>('');

  const [language, setLanguage] = useState<string>('Tiếng Việt (Mặc định)');
  const [depth, setDepth] = useState<string>('Tiêu chuẩn');
  
  const [outputOptions, setOutputOptions] = useState<OutputOptions>({
    notes: true,
    mindmap: true,
    flashcards: true,
    quiz: true
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(65);

  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const detectDevice = () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const platform = Capacitor.getPlatform();
          if (platform === 'android' || platform === 'ios') {
            setDeviceType('mobile');
            return;
          }
        }
      } catch {
        // fallback
      }

      if (typeof window !== 'undefined') {
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
        if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/i.test(ua)) {
          setDeviceType('tablet');
        } else if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (window.innerWidth <= 768 && 'ontouchstart' in window)) {
          setDeviceType('mobile');
        } else {
          setDeviceType('desktop');
        }
      }
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    return () => window.removeEventListener('resize', detectDevice);
  }, []);

  const fileButtonText = deviceType === 'mobile'
    ? 'Chọn tệp tin từ điện thoại'
    : deviceType === 'tablet'
      ? 'Chọn tệp tin từ máy tính bảng'
      : 'Chọn tệp tin từ máy tính';

  const dropZoneTitle = selectedFile 
    ? selectedFile.name 
    : deviceType === 'desktop' 
      ? 'Kéo và thả tệp tin của bạn vào đây' 
      : 'Chạm để tải lên hoặc chọn tệp tin';

  const sourceTabs = [
    { id: 'doc', label: 'PDF / Word / PPT', icon: FileText },
    { id: 'image', label: 'Ảnh / Ảnh chụp sách', icon: ImageIcon },
    { id: 'video', label: 'Video / YouTube Link', icon: Video },
    { id: 'url', label: 'Liên kết Web / Bài báo', icon: LinkIcon },
    { id: 'text', label: 'Nhập Văn bản thô', icon: Edit3 },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleStartProcessing = async () => {
    if (activeSourceTab === 'video' && !videoUrlInput.trim()) {
      showToast("Vui lòng nhập đường dẫn Video / YouTube!");
      return;
    }
    if (activeSourceTab === 'url' && !webUrlInput.trim()) {
      showToast("Vui lòng nhập liên kết Web!");
      return;
    }
    if (activeSourceTab === 'text' && !rawTextInput.trim()) {
      showToast("Vui lòng dán hoặc nhập nội dung văn bản!");
      return;
    }
    if ((activeSourceTab === 'doc' || activeSourceTab === 'image') && !selectedFile) {
      showToast("Vui lòng chọn tệp tài liệu trước khi bấm chuyển hóa!");
      return;
    }

    setIsProcessing(true);
    setProgressPercent(10);

    const interval = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 20;
      });
    }, 400);

    try {
      if (activeSourceTab === 'video') {
        await processVideo(videoUrlInput);
      } else if (activeSourceTab === 'url') {
        await processUrl(webUrlInput);
      } else if (activeSourceTab === 'text') {
        await uploadDocument(null, language, depth, outputOptions, rawTextInput);
      } else if (selectedFile) {
        const ext = selectedFile.name.split('.').pop()?.toLowerCase();
        
        // 1. DOCX / DOC Files: Extract text client-side via mammoth to bypass 4.5MB Vercel upload limit
        if (ext === 'docx' || ext === 'doc') {
          try {
            const arrayBuffer = await selectedFile.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            const extractedText = result.value ? result.value.trim() : '';
            if (extractedText.length > 5) {
              await uploadDocument(null, language, depth, outputOptions, extractedText, selectedFile.name);
              return;
            }
          } catch (mErr) {
            console.warn("Client mammoth extraction fallback:", mErr);
          }
        }

        // 2. TXT / MD / CSV / JSON
        if (['txt', 'md', 'csv', 'json'].includes(ext || '')) {
          try {
            const text = await selectedFile.text();
            if (text.trim().length > 5) {
              await uploadDocument(null, language, depth, outputOptions, text.trim(), selectedFile.name);
              return;
            }
          } catch (tErr) {
            console.warn("Client text read fallback:", tErr);
          }
        }

        // 3. PDF Files: Extract text client-side via pdfjs-dist / stream decoder to bypass 4.5MB Vercel upload limit
        if (ext === 'pdf') {
          try {
            const arrayBuffer = await selectedFile.arrayBuffer();
            let extractedPdfText = '';

            // Try PDF.js parsing
            try {
              const pdfjsLib = await import('pdfjs-dist');
              pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.mjs`;
              const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
              const pdfDoc = await loadingTask.promise;
              let pagesText: string[] = [];
              for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                const pageStr = textContent.items.map((item: any) => item.str).join(' ');
                if (pageStr.trim()) pagesText.push(pageStr);
              }
              extractedPdfText = pagesText.join('\n\n');
            } catch (pErr) {
              console.warn("Client pdfjs-dist extraction error, using stream fallback:", pErr);
            }

            // Binary Stream Fallback if PDF.js returns short text
            if (extractedPdfText.trim().length <= 30) {
              const bytes = new Uint8Array(arrayBuffer);
              let binaryStr = '';
              const len = Math.min(bytes.length, 5 * 1024 * 1024);
              for (let i = 0; i < len; i++) {
                binaryStr += String.fromCharCode(bytes[i]);
              }
              const matches = binaryStr.match(/\(([^\(\)]+)\)\s*T[jJ]/g) || binaryStr.match(/\/Title\s*\(([^\)]+)\)/g);
              if (matches && matches.length > 0) {
                extractedPdfText = matches.map(m => m.replace(/[\(\)\/Tj]/g, '').trim()).filter(t => t.length > 2).join(' ');
              }
            }

            if (extractedPdfText.trim().length > 10) {
              await uploadDocument(null, language, depth, outputOptions, extractedPdfText.trim(), selectedFile.name);
              return;
            }
          } catch (pdfErr) {
            console.warn("Client PDF extraction fallback:", pdfErr);
          }
        }

        // 4. Image files or Fallback Binary Upload
        if (selectedFile.size > 4.5 * 1024 * 1024) {
          showToast(`Tệp "${selectedFile.name}" (${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB) vượt quá giới hạn 4.5MB của Vercel Cloud. Vui lòng chọn tệp nhỏ hơn.`);
          return;
        }

        await uploadDocument(selectedFile, language, depth, outputOptions);
      }
    } finally {
      clearInterval(interval);
      setIsProcessing(false);
      setProgressPercent(100);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto pb-24 md:pb-8">
      {/* Title Header */}
      <div className="space-y-1">
        <h2 className="text-xl md:text-2xl font-bold text-[#111827]">
          Nhập tài liệu học tập
        </h2>
        <p className="text-xs md:text-sm text-slate-500">
          Tải lên bất kỳ tài liệu nào để bắt đầu quá trình trích xuất kiến thức bằng AI
        </p>
      </div>

      {/* Account Personalization Status Banner */}
      {isAuthenticated ? (
        <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#0F766E] text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-teal-900">
                Kho học tập cá nhân của <span>{user.fullName || user.email}</span>
              </p>
              <p className="text-[11px] text-teal-700/80">
                Bài học, ghi chú AI, sơ đồ tư duy và flashcard sau khi tạo sẽ được đồng bộ vĩnh viễn trên Supabase Cloud.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">
                Bạn đang ở chế độ Khách (Chưa đăng nhập)
              </p>
              <p className="text-[11px] text-amber-700/90">
                Bạn có thể trải nghiệm chuyển hóa tài liệu, nhưng hãy đăng nhập để lưu trữ vĩnh viễn vào tài khoản cá nhân.
              </p>
            </div>
          </div>
          <button
            onClick={() => openAuthModal('login')}
            className="px-4 py-2 bg-[#0F766E] hover:bg-[#0D645E] text-white text-xs font-bold rounded-xl shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
          >
            Đăng nhập ngay
          </button>
        </div>
      )}

      {/* Top Source Tabs Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 scrollbar-none">
        {sourceTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSourceTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSourceTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all shrink-0 ${
                isActive
                  ? 'bg-[#CCFBF1] text-[#0F766E] border border-[#0F766E] shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Form Content (Grid 2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Upload / Input Zone (3 cols) */}
        <div className="lg:col-span-3 space-y-5">
          {activeSourceTab === 'doc' || activeSourceTab === 'image' ? (
            /* Drag & Drop Zone */
            <div className="bg-white border-2 border-dashed border-teal-600/40 hover:border-[#0F766E] transition-colors rounded-2xl p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-teal-50 text-[#0F766E] rounded-full flex items-center justify-center mx-auto shadow-inner">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-base text-[#111827]">
                  {dropZoneTitle}
                </h4>
                <p className="text-xs text-slate-500">
                  Hỗ trợ PDF, DOCX, PPTX, JPG/PNG lên tới 50MB
                </p>
              </div>

              <div>
                <label className="inline-block bg-[#0F766E] hover:bg-[#0D5C53] text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm cursor-pointer transition-all hover:scale-102">
                  <span>{fileButtonText}</span>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg"
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : activeSourceTab === 'video' ? (
            /* Video / YouTube URL Input */
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
              <label className="block text-xs font-bold text-[#111827]">
                Nhập liên kết Video / YouTube hoặc tải video bài giảng:
              </label>
              <input
                type="url"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E]"
              />
              <p className="text-[11px] text-slate-400">
                Hệ thống sẽ tự động tách âm thanh và chuyển thành Speech-to-Text chuẩn xác.
              </p>
            </div>
          ) : activeSourceTab === 'url' ? (
            /* Web URL Input */
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
              <label className="block text-xs font-bold text-[#111827]">
                Nhập URL Bài báo / Trang web nghiên cứu:
              </label>
              <input
                type="url"
                value={webUrlInput}
                onChange={(e) => setWebUrlInput(e.target.value)}
                placeholder="https://wikipedia.org/wiki/Mitochondrion"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>
          ) : (
            /* Raw Text Area */
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
              <label className="block text-xs font-bold text-[#111827]">
                Dán nội dung văn bản thô:
              </label>
              <textarea
                rows={6}
                value={rawTextInput}
                onChange={(e) => setRawTextInput(e.target.value)}
                placeholder="Dán bài giảng hoặc ghi chú của bạn vào đây..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E]"
              />
            </div>
          )}

          {/* Files Processing Item */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                  {selectedFile ? selectedFile.name.split('.').pop()?.toUpperCase() : 'PDF'}
                </div>
                <div className="overflow-hidden">
                  <h5 className="font-semibold text-xs md:text-sm text-[#111827] truncate">
                    {selectedFile ? selectedFile.name : (activeDocData?.document?.title || 'Tài liệu học tập mới.pdf')}
                  </h5>
                  <p className="text-[11px] text-slate-400 truncate">
                    {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : '1.8 MB'} • {isProcessing ? 'AI đang phân tích & trích xuất kiến thức...' : 'Đã hoàn tất trích xuất kiến thức'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-[#0F766E]">{progressPercent}%</span>
                {selectedFile && (
                  <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-rose-500" title="Bỏ chọn tệp">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#0F766E] h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: AI Output Configuration (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <h3 className="font-bold text-base text-[#111827] border-b border-slate-100 pb-3">
              Cấu hình đầu ra AI
            </h3>

            {/* Language Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Ngôn ngữ kết quả
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs md:text-sm text-[#111827] focus:outline-none focus:border-[#0F766E]"
              >
                <option>Tiếng Việt (Mặc định)</option>
                <option>Tiếng Anh (English)</option>
                <option>Song ngữ (Việt - Anh)</option>
              </select>
            </div>

            {/* Output Products Checkboxes */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Sản phẩm muốn tạo
              </label>
              <div className="space-y-2.5">
                {[
                  { key: 'notes' as keyof OutputOptions, label: 'Ghi chú tóm tắt có cấu trúc' },
                  { key: 'mindmap' as keyof OutputOptions, label: 'Sơ đồ tư duy trực quan (Mindmap)' },
                  { key: 'flashcards' as keyof OutputOptions, label: 'Thẻ ghi nhớ thông minh (Flashcards)' },
                  { key: 'quiz' as keyof OutputOptions, label: 'Đề kiểm tra trắc nghiệm AI (Quiz)' },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2.5 cursor-pointer text-xs md:text-sm font-medium text-[#111827]">
                    <input
                      type="checkbox"
                      checked={outputOptions[opt.key]}
                      onChange={(e) => setOutputOptions({ ...outputOptions, [opt.key]: e.target.checked })}
                      className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E]"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Detail Depth Pills */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Độ sâu & Chi tiết
              </label>
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                {['Tóm lược nhanh', 'Tiêu chuẩn', 'Chuyên sâu'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setDepth(item)}
                    className={`py-1.5 text-[11px] font-bold rounded-md transition-all ${
                      depth === item
                        ? 'bg-[#CCFBF1] text-[#0F766E] border border-[#0F766E] shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit Action Button */}
          <div className="pt-4">
            <button
              onClick={handleStartProcessing}
              disabled={isProcessing}
              className="w-full bg-[#0F766E] hover:bg-[#0D5C53] text-white font-bold text-sm py-3 rounded-lg shadow-md transition-all hover:scale-101 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý tài liệu...</span>
                </>
              ) : (
                <span>Bắt đầu chuyển hóa tài liệu</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
