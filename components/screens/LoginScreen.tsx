import { createSignal } from 'solid-js';
import { SlantedButton } from '../ui/SlantedButton';
import { DynamicBackground } from '../ui/DynamicBackground';
import { t } from '../../services/localization';
import { audio } from '../../services/audio';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen = (props: LoginScreenProps) => {
  const [isAnimating, setIsAnimating] = createSignal(false);

  const handleLogin = () => {
      // Audio initialization MUST happen inside a user interaction callback
      audio.init();
      audio.playUiClick();
      
      setIsAnimating(true);
      // Fake network delay for realism
      setTimeout(props.onLogin, 800);
  };

  return (
    <div class={`w-full h-full flex flex-col items-center justify-center p-6 relative overflow-hidden transition-opacity duration-700 ${isAnimating() ? 'opacity-0' : 'opacity-100'}`}>
      
      {/* THE SNAZZY ENGINE: Dynamic Background Layer */}
      <DynamicBackground opacity={1} showContrastShield={false} />
      
      {/* ATMOSPHERIC DEPTH: Radial bloom and stardust patterns */}
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-black/60 pointer-events-none z-[1]" />
      <div class="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.15] animate-[pulse_6s_infinite] pointer-events-none z-[2]" />
      
      {/* Logo Section */}
      <div class="relative z-10 mb-10 flex flex-col items-center animate-pop">
        <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center font-black text-white text-3xl shadow-[0_0_2.5rem_rgba(79,70,229,0.5)] mb-4 ring-2 ring-white/20">
            <span class="tracking-tighter drop-shadow-md">CD</span>
        </div>
        <h1 class="text-3xl font-black text-white tracking-tighter italic drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] text-center mb-2 leading-none">
            CRUEL<br/>DEAL
        </h1>
        <div class="flex items-center gap-2">
            <div class="h-px w-6 bg-indigo-500/50" />
            <p class="text-indigo-300 font-bold tracking-[0.2em] text-[0.5rem] uppercase">
                {t('LOGIN_SUBTITLE')}
            </p>
            <div class="h-px w-6 bg-indigo-500/50" />
        </div>
      </div>

      {/* Login Options */}
      <div class="w-full max-w-[16rem] space-y-3 z-10 animate-slide-up">
          <SlantedButton variant="blue" onClick={handleLogin} fullWidth size="md" class="shadow-xl">
              Facebook
          </SlantedButton>
          
          <SlantedButton variant="secondary" onClick={handleLogin} fullWidth size="md" class="shadow-xl">
              Google
          </SlantedButton>

          <div class="relative py-1">
              <div class="absolute inset-0 flex items-center">
                  <div class="w-full border-t border-white/10" />
              </div>
              <div class="relative flex justify-center text-[0.5rem]">
                  <span class="bg-black/40 backdrop-blur-sm px-3 py-0.5 rounded-full text-slate-400 font-black uppercase border border-white/5">Or</span>
              </div>
          </div>

          <SlantedButton variant="warning" onClick={handleLogin} fullWidth size="sm" class="shadow-lg">
              {t('LOGIN_GUEST')}
          </SlantedButton>
      </div>

      <div class="mt-4 text-slate-400 text-[0.45rem] text-center leading-relaxed font-medium whitespace-nowrap z-10 animate-slide-up opacity-0" style={{ "animation-delay": "0.3s" }}>
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
