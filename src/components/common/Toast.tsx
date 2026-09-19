import React from 'react';
import { useStudy } from '../../context/StudyContext';
import { Sparkles } from 'lucide-react';

export function Toast() {
  const { toastMessage } = useStudy();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl z-50 flex items-center gap-3 border border-slate-700 animate-slideUp text-xs md:text-sm font-medium">
      <div className="w-6 h-6 rounded-full bg-[#0F766E] flex items-center justify-center text-teal-200 shrink-0">
        <Sparkles className="w-3.5 h-3.5" />
      </div>
      <span>{toastMessage}</span>
    </div>
  );
}
