interface CurrencyIconProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  class?: string;
  animate?: boolean;
}

const sizes = {
  xs: { 
    box: 'w-[1.0rem] h-[1.0rem]', 
    gold: 'w-[1.0rem] h-[0.56rem]', 
    credit: 'w-[0.8rem] h-[0.8rem]', 
    card: 'w-[0.75rem] h-[1.0rem]', 
    booster: 'w-[0.7rem] h-[0.7rem]', 
    omega: 'w-[1.0rem] h-[1.0rem]',
    token: 'w-[1.0rem] h-[1.0rem]' 
  },
  
  sm: { 
    box: 'w-[1.4rem] h-[1.4rem]', 
    gold: 'w-[1.3rem] h-[0.72rem]', 
    credit: 'w-[1.0rem] h-[1.0rem]', 
    card: 'w-[0.95rem] h-[1.35rem]', 
    booster: 'w-[1.1rem] h-[1.1rem]', 
    omega: 'w-[1.4rem] h-[1.4rem]',
    token: 'w-[1.4rem] h-[1.4rem]' 
  },
  
  md: { 
    box: 'w-[2.25rem] h-[2.25rem]', 
    gold: 'w-[2.25rem] h-[1.375rem]', 
    credit: 'w-[1.875rem] h-[1.875rem]', 
    card: 'w-[1.56rem] h-[2.18rem]', 
    booster: 'w-[1.5rem] h-[1.5rem]', 
    omega: 'w-[2.25rem] h-[2.25rem]',
    token: 'w-[2.25rem] h-[2.25rem]' 
  },
  
  lg: { 
    box: 'w-[4rem] h-[4rem]', 
    gold: '3.5rem] h-[2.5rem]', 
    credit: 'w-[3rem] h-[3rem]', 
    card: 'w-[3rem] h-[4rem]', 
    booster: 'w-[2.4rem] h-[2.4rem]', 
    omega: 'w-[4rem] h-[4rem]',
    token: 'w-[4rem] h-[4rem]' 
  },

  xl: { 
    box: 'w-[6rem] h-[6rem]', 
    gold: 'w-[5.5rem] h-[3.8rem]', 
    credit: 'w-[5rem] h-[5rem]', 
    card: 'w-[5rem] h-[7rem]', 
    booster: 'w-[4rem] h-[4rem]', 
    omega: 'w-[6rem] h-[6rem]',
    token: 'w-[6rem] h-[6rem]' 
  }
};

export const CreditIcon = (props: CurrencyIconProps) => {
  const s = () => sizes[props.size || 'md'];
  return (
    <div class={`relative flex items-center justify-center ${s().box} ${props.class || ''}`}>
      <div 
        class={`
          ${s().credit} bg-gradient-to-tr from-blue-400 to-blue-600 rounded-sm 
          shadow-[0_0_15px_rgba(37,99,235,0.6)] border border-white/30 rotate-45
        `}
      />
    </div>
  );
};

export const GoldIcon = (props: CurrencyIconProps) => {
  const s = () => sizes[props.size || 'md'];
  return (
    <div class={`relative flex items-center justify-center ${s().box} ${props.class || ''}`}>
      <div 
        class={`
          ${s().gold} bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 rounded-[1px]
          shadow-[0_0_15px_rgba(217,119,6,0.6)] border border-white/30 -rotate-12
          ${props.animate ? 'animate-bounce-subtle' : ''}
        `}
      />
      <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0) rotate(-12deg); }
          50% { transform: translateY(-1.5px) rotate(-12deg); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export const TokenIcon = (props: CurrencyIconProps) => {
  const s = () => sizes[props.size || 'md'];
  return (
    <div class={`relative flex items-center justify-center ${s().box} ${props.class || ''}`}>
      <svg 
         viewBox="0 0 100 100" 
         class={`w-full h-full drop-shadow-[0_0_12px_rgba(239,68,68,0.8)] ${props.animate ? 'animate-pulse' : ''}`}
      >
        <defs>
          <linearGradient id="tokenGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
        </defs>
        <path 
           d="M50 5 L95 27.5 L95 72.5 L50 95 L5 72.5 L5 27.5 Z" 
           fill="url(#tokenGrad)" 
           stroke="#fecaca" 
           stroke-width="4"
        />
        <circle cx="50" cy="50" r="20" fill="none" stroke="#fecaca" stroke-width="6" stroke-dasharray="10 5" />
        <path d="M50 35 L50 65 M35 50 L65 50" stroke="#fecaca" stroke-width="8" stroke-linecap="round" />
      </svg>
    </div>
  );
};

export const GenomeIcon = (props: CurrencyIconProps) => {
  const s = () => sizes[props.size || 'md'];
  return (
    <div class={`relative flex items-center justify-center ${s().box} ${props.class || ''}`}>
       <svg 
         viewBox="0 0 24 24" 
         class={`${s().credit.replace('credit', 'genome')} text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]`} 
         fill="none" 
         stroke="currentColor" 
         stroke-width="3" 
         stroke-linecap="round"
       >
          <path d="M12 2v20M8 5c2 1 2 4 0 5s-2 4 0 5 2 4 0 5M16 5c-2 1-2 4 0 5s2 4 0 5-2 4 0 5" />
       </svg>
    </div>
  );
};

export const CardIcon = (props: CurrencyIconProps) => {
  const s = () => sizes[props.size || 'md'];
  return (
    <div class={`relative flex items-center justify-center ${s().box} ${props.class || ''}`}>
      <div class={`${s().card} border-2 border-slate-400 bg-slate-600/40 rounded-[1px] shadow-[0_0_10px_rgba(148,163,184,0.3)] relative overflow-hidden`}>
          <div class="absolute inset-x-0 bottom-0 h-1/3 bg-slate-400/30" />
      </div>
    </div>
  );
};

export const BoosterIcon = (props: CurrencyIconProps) => {
  const s = () => sizes[props.size || 'md'];
  return (
    <div class={`relative flex items-center justify-center ${s().box} ${props.class || ''}`}>
      <svg class={`${s().booster} text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
  );
};

export const OmegaBoxIcon = (props: CurrencyIconProps) => {
  const s = () => sizes[props.size || 'md'];
  return (
    <div class={`relative flex items-center justify-center ${s().box} ${props.class || ''}`}>
      <svg class={`w-full h-full drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
              <linearGradient id="omegaBoxGradIcon" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#c7d2fe" />
                  <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
          </defs>
          <path 
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" 
              stroke="url(#omegaBoxGradIcon)" 
              stroke-width={2.2} 
              stroke-linecap="round" 
              stroke-linejoin="round" 
          />
      </svg>
    </div>
  );
};
