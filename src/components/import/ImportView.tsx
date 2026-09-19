import React, { useState } from 'react';
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
import { useStudy } from '../../context/StudyContext';
import { OutputOptions } from '../../types';

export function ImportView() {
  const { uploadDocument, processVideo, processUrl, activeDocData } = useStudy();

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
      } else {
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
                  {selectedFile ? selectedFile.name : 'Kéo và thả tệp tin của bạn vào đây'}
                </h4>
                <p className="text-xs text-slate-500">
                  Hỗ trợ PDF, DOCX, PPTX, JPG/PNG lên tới 50MB
                </p>
              </div>

              <div>
                <label className="inline-block bg-[#0F766E] hover:bg-[#0D5C53] text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm cursor-pointer transition-all hover:scale-102">
                  <span>Chọn tệp tin từ máy tính</span>
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
                  <span>Đang xử lý AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Bắt đầu chuyển hóa tài liệu</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
