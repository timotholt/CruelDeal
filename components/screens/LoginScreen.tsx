import React, { useState } from 'react';
import { SlantedButton } from '../ui/SlantedButton';
import { DynamicBackground } from '../ui/DynamicBackground';
import { t } from '../../services/localization';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleLogin = () => {
      setIsAnimating(true);
      // Fake network delay for realism
      setTimeout(onLogin, 800);
  };

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center p-6 relative overflow-hidden transition-opacity duration-700 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
      
      {/* THE SNAZZY ENGINE: Dynamic Background Layer */}
      <DynamicBackground opacity={1} showContrastShield={false} />
      
      {/* ATMOSPHERIC DEPTH: Radial bloom and stardust patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-black/60 pointer-events-none z-[1]"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.15] animate-[pulse_6s_infinite] pointer-events-none z-[2]"></div>
      
      {/* Logo Section */}
      <div className="relative z-10 mb-10 flex flex-col items-center animate-pop">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center font-black text-white text-3xl shadow-[0_0_2.5rem_rgba(79,70,229,0.5)] mb-4 ring-2 ring-white/20">
            <span className="tracking-tighter drop-shadow-md">GS</span>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tighter italic drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] text-center mb-2 leading-none">
            GALACTIC<br/>SNAP
        </h1>
        <div className="flex items-center gap-2">
            <div className="h-px w-6 bg-indigo-500/50"></div>
            <p className="text-indigo-300 font-bold tracking-[0.2em] text-[0.5rem] uppercase">
                {t('LOGIN_SUBTITLE')}
            </p>
            <div className="h-px w-6 bg-indigo-500/50"></div>
        </div>
      </div>

      {/* Login Options */}
      <div className="w-full max-w-[16rem] space-y-3 z-10 animate-slide-up">
          <SlantedButton variant="blue" onClick={handleLogin} fullWidth size="md" className="shadow-xl">
              Facebook
          </SlantedButton>
          
          <SlantedButton variant="secondary" onClick={handleLogin} fullWidth size="md" className="shadow-xl">
              Google
          </SlantedButton>

          <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-[0.5rem]">
                  <span className="bg-black/40 backdrop-blur-sm px-3 py-0.5 rounded-full text-slate-400 font-black uppercase border border-white/5">Or</span>
              </div>
          </div>

          <SlantedButton variant="warning" onClick={handleLogin} fullWidth size="sm" className="shadow-lg">
              {t('LOGIN_GUEST')}
          </SlantedButton>
      </div>
      
      <div className="absolute bottom-6 text-slate-400 text-[0.5rem] text-center px-8 leading-relaxed max-w-xs font-medium z-10">
          {t('LOGIN_FOOTER')}
      </div>
      
      <style>{`
        .animate-slide-up {
            animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            opacity: 0;
            transform: translateY(15px);
            animation-delay: 0.2s;
        }
        @keyframes slideUp {
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};