import React, { useMemo } from 'react';
import { t } from '../../services/localization';

interface LoadingScreenProps {
  progress: number;
  isVisible: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress, isVisible }) => {
  
  const statusMessage = useMemo(() => {
      if (progress < 30) return t('LOAD_DOWNLOADING');
      if (progress < 60) return t('LOAD_CALIBRATING');
      if (progress < 90) return t('LOAD_SYNCING_TYPO');
      return t('LOAD_FINALIZING');
  }, [progress]);

  return (
    <div 
        /* 
           Using generic sans-serif for the loading phase to avoid layout 
           instability while custom IBM fonts are being retrieved.
        */
        style={{ fontFamily: 'sans-serif' }}
        className={`
            fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-950 text-white p-8 
            transition-all duration-1000 ease-in-out
            ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none scale-105'}
        `}
    >
      
      {/* Logo Pulse */}
      <div className="mb-12 relative">
         <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse rounded-full"></div>
         <div className="relative text-4xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-br from-indigo-300 to-indigo-600 pr-4">
             GALACTIC SNAP
         </div>
      </div>

      {/* Progress Bar Container */}
      <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden relative shadow-inner border border-slate-700">
        <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out relative"
            style={{ width: `${progress}%` }}
        >
            <div className="absolute inset-0 bg-white/30 w-full -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
        </div>
      </div>

      {/* Text Stats */}
      <div className="mt-4 flex flex-col items-center gap-2 w-64">
          <div className="flex items-center justify-between w-full text-[0.6rem] font-bold tracking-widest text-slate-500 uppercase">
              <span>{t('LOAD_INITIALIZING')}</span>
              <span className="text-indigo-400 tabular-nums">{progress}%</span>
          </div>
          <div className="text-[0.45rem] font-black text-indigo-300/40 uppercase tracking-[0.3em] animate-pulse italic">
              {statusMessage}
          </div>
      </div>

      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};