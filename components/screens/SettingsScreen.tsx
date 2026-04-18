import { createSignal } from 'solid-js';
import { StandardHeader } from '../ui/StandardHeader';
import { ModalFooter } from '../ui/ModalFooter';
import { SlantedButton } from '../ui/SlantedButton';
import { t } from '../../services/localization';
import { useUser } from '../../contexts/UserContext';

interface SettingsScreenProps {
    onExit: () => void;
}

export const SettingsScreen = (props: SettingsScreenProps) => {
    const { user } = useUser();
    const [volumes, setVolumes] = createSignal({ music: 60, sfx: 80 });

    return (
        <div class="w-full h-full flex flex-col bg-transparent overflow-hidden text-white">
            <StandardHeader title={`\u00A0\u00A0${t('SETT_TITLE')}`} />
            
            <div class="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Audio Controls */}
                <section class="space-y-6">
                    <h3 class="text-[0.65rem] font-black text-indigo-400 uppercase tracking-[0.3em]">{t('SETT_AUDIO')}</h3>
                    
                    <div class="space-y-4">
                        <VolumeSlider 
                            label={t('SETT_MUSIC')} 
                            value={volumes().music} 
                            onChange={(v) => setVolumes(prev => ({ ...prev, music: v }))} 
                        />
                        <VolumeSlider 
                            label={t('SETT_SFX')} 
                            value={volumes().sfx} 
                            onChange={(v) => setVolumes(prev => ({ ...prev, sfx: v }))} 
                        />
                    </div>
                </section>

                {/* Account Info */}
                <section class="space-y-4">
                    <h3 class="text-[0.65rem] font-black text-indigo-400 uppercase tracking-[0.3em]">{t('SETT_STATUS')}</h3>
                    <div class="p-4 bg-slate-900/60 border border-white/5 rounded-xl space-y-3">
                        <div class="flex justify-between">
                            <span class="text-xs text-slate-400">{t('SETT_ID')}</span>
                            <span class="text-xs font-mono text-white/60 uppercase">USER-{user.id.toUpperCase()}-B22</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-xs text-slate-400">{t('SETT_SYNC')}</span>
                            <span class="text-xs font-black text-emerald-400 italic uppercase">{t('SETT_CONNECTED')}</span>
                        </div>
                    </div>
                </section>

                {/* Graphics */}
                <section class="space-y-4">
                    <h3 class="text-[0.65rem] font-black text-indigo-400 uppercase tracking-[0.3em]">{t('SETT_VISUAL')}</h3>
                    <div class="grid grid-cols-2 gap-2">
                        <SlantedButton variant="primary" size="sm" fullWidth>{t('SETT_60FPS')}</SlantedButton>
                        <SlantedButton variant="secondary" size="sm" fullWidth>{t('SETT_HIGHRES')}</SlantedButton>
                    </div>
                </section>

                <div class="pt-4 text-center">
                    <p class="text-[0.5rem] font-bold text-slate-600 uppercase tracking-[0.2em]">Build Version 1.4.0-Spatial</p>
                </div>
            </div>

            <ModalFooter onClose={props.onExit} />
        </div>
    );
};

const VolumeSlider = (props: { label: string; value: number; onChange: (v: number) => void }) => (
    <div class="space-y-2">
        <div class="flex justify-between items-center px-1">
            <span class="text-[0.7rem] font-black text-white italic uppercase tracking-tight">{props.label}</span>
            <span class="text-xs font-black text-indigo-400 italic tabular-nums">{props.value}%</span>
        </div>
        <div class="relative h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
            <div 
                class="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-300"
                style={{ width: `${props.value}%` }}
            />
            <input 
                type="range" 
                min="0" max="100" 
                value={props.value} 
                onInput={(e) => props.onChange(parseInt(e.currentTarget.value))}
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
        </div>
    </div>
);
