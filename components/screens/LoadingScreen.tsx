import { createMemo } from 'solid-js';
import { t } from '../../services/localization';

interface LoadingScreenProps {
  progress: number;
  isVisible: boolean;
}

export const LoadingScreen = (props: LoadingScreenProps) => {
  
  const statusMessage = createMemo(() => {
      const p = props.progress;
      if (p < 30) return t('LOAD_DOWNLOADING');
      if (p < 60) return t('LOAD_CALIBRATING');
      if (p < 90) return t('LOAD_SYNCING_TYPO');
      return t('LOAD_FINALIZING');
  });

  return (
    <div 
        style={{ "font-family": 'sans-serif' }}
        class={`
            fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-950 text-white p-8 
            transition-all duration-1000 ease-in-out
            ${props.isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none scale-105'}
        `}
    >
      
      {/* Logo Pulse */}
      <div class="mb-12 relative">
         <div class="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse rounded-full" />
         <div class="relative text-4xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-br from-indigo-300 to-indigo-600 pr-4">
             CRUEL DEAL
         </div>
      </div>

      {/* Progress Bar Container */}
      <div class="w-64 h-2 bg-slate-800 rounded-full overflow-hidden relative shadow-inner border border-slate-700">
        <div 
            class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out relative"
            style={{ width: `${props.progress}%` }}
        >
            <div class="absolute inset-0 bg-white/30 w-full -translate-x-full animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>

      {/* Text Stats */}
      <div class="mt-4 flex flex-col items-center gap-2 w-64">
          <div class="flex items-center justify-between w-full text-[0.6rem] font-bold tracking-widest text-slate-500 uppercase">
              <span>{t('LOAD_INITIALIZING')}</span>
              <span class="text-indigo-400 tabular-nums">{props.progress}%</span>
          </div>
          <div class="text-[0.45rem] font-black text-indigo-300/40 uppercase tracking-[0.3em] animate-pulse italic">
              {statusMessage()}
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
