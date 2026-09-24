import React from 'react';
import { LucideIcon, BookOpen, UploadCloud, History, ArrowRight } from 'lucide-react';
import { useStudy } from '../../context/StudyContext';

interface NoActiveDocCardProps {
  featureName: string;
  description: string;
  icon: LucideIcon;
}

export function NoActiveDocCard({
  featureName,
  description,
  icon: Icon
}: NoActiveDocCardProps) {
  const { user, setActiveTab } = useStudy();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-xs text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-100/80 text-[#0F766E] flex items-center justify-center mx-auto shadow-xs">
          <Icon className="w-8 h-8 text-[#0F766E]" />
        </div>

        <div className="max-w-md mx-auto space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Chưa có bài học nào được chọn cho {featureName}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Chào <strong>{user.fullName || user.email}</strong>! {description}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-sm mx-auto">
          <button
            onClick={() => setActiveTab('history')}
            className="w-full sm:w-auto flex-1 px-5 py-2.5 bg-[#0F766E] hover:bg-[#0D645E] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <History className="w-4 h-4" />
            <span>Mở từ Lịch sử của bạn</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className="w-full sm:w-auto flex-1 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-[#0F766E]" />
            <span>Tải bài học mới</span>
          </button>
        </div>
      </div>
    </div>
  );
}
