import React from 'react';
import { Lock, LogIn, Plus, ShieldCheck, LucideIcon, Database, Award } from 'lucide-react';
import { useStudy } from '../../context/StudyContext';

interface GuestGuardProps {
  featureTitle: string;
  featureDescription: string;
  featureIcon: LucideIcon;
  benefit1?: { title: string; desc: string };
  benefit2?: { title: string; desc: string };
  benefit3?: { title: string; desc: string };
}

export function GuestGuard({
  featureTitle,
  featureDescription,
  featureIcon: FeatureIcon,
  benefit1 = {
    title: "Bảo mật tuyệt đối",
    desc: "Toàn bộ bài giảng, tài liệu PDF và kết quả phân tích AI chỉ hiển thị cho duy nhất bạn."
  },
  benefit2 = {
    title: "Đồng bộ Supabase Cloud",
    desc: "Lưu trữ bài học vĩnh viễn trên đám mây, tiếp tục ôn tập mọi lúc mọi nơi trên mọi thiết bị."
  },
  benefit3 = {
    title: "Lộ trình cá nhân hóa",
    desc: "Theo dõi chu kỳ ôn tập ngắt quãng Spaced Repetition và mức độ hiểu bài của riêng bạn."
  }
}: GuestGuardProps) {
  const { openAuthModal } = useStudy();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Main Guest Personalization Card */}
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-xs relative overflow-hidden text-center">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-teal-50/70 to-transparent pointer-events-none" />

        {/* Badge */}
        <div className="relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-[#0F766E] text-xs font-bold uppercase tracking-wider mb-6">
          <ShieldCheck className="w-4 h-4 text-[#0F766E]" />
          <span>Bảo vệ Quyền riêng tư & Cá nhân hóa</span>
        </div>

        {/* Combined Feature + Lock Icon */}
        <div className="relative w-16 h-16 rounded-2xl bg-teal-50 border border-teal-100/80 text-[#0F766E] flex items-center justify-center mx-auto shadow-xs mb-5">
          <FeatureIcon className="w-8 h-8 text-[#0F766E]" />
        </div>

        {/* Titles */}
        <div className="relative max-w-xl mx-auto space-y-3 mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {featureTitle}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
            {featureDescription}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="relative flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto mb-10">
          <button
            onClick={() => openAuthModal('login')}
            className="w-full sm:w-auto flex-1 px-6 py-3 bg-[#0F766E] hover:bg-[#0D645E] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-teal-700/15 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập tài khoản</span>
          </button>
          <button
            onClick={() => openAuthModal('signup')}
            className="w-full sm:w-auto flex-1 px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#0F766E]" />
            <span>Tạo tài khoản mới</span>
          </button>
        </div>

        {/* 3 Balanced Value Proposition Cards */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4 text-left border-t border-slate-100 pt-8">
          <div className="p-4 rounded-2xl bg-slate-50/70 hover:bg-teal-50/40 border border-slate-200/60 hover:border-teal-200/60 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-100/70 text-[#0F766E] flex items-center justify-center mb-2.5">
              <ShieldCheck className="w-4 h-4 text-[#0F766E]" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 mb-1">{benefit1.title}</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {benefit1.desc}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/70 hover:bg-teal-50/40 border border-slate-200/60 hover:border-teal-200/60 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center mb-2.5">
              <Database className="w-4 h-4 text-emerald-700" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 mb-1">{benefit2.title}</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {benefit2.desc}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/70 hover:bg-teal-50/40 border border-slate-200/60 hover:border-teal-200/60 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-amber-100/70 text-amber-700 flex items-center justify-center mb-2.5">
              <Award className="w-4 h-4 text-amber-700" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 mb-1">{benefit3.title}</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {benefit3.desc}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
