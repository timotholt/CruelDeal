import React, { useState } from 'react';
import { StandardHeader } from '../ui/StandardHeader';
import { ModalFooter } from '../ui/ModalFooter';
import { SlantedButton } from '../ui/SlantedButton';
import { t } from '../../services/localization';
import { useUser } from '../../contexts/UserContext';

interface SettingsScreenProps {
    onExit: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onExit }) => {
    const { user } = useUser();
    const [volumes, setVolumes] = useState({ music: 60, sfx: 80 });

    return (
        <div className="w-full h-full flex flex-col bg-transparent overflow-hidden">
            <StandardHeader title={`\u00A0\u00A0${t('SETT_TITLE')}`} />
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Audio Controls */}
                <section className="space-y-6">
                    <h3 className="text-[0.65rem] font-black text-indigo-400 uppercase tracking-[0.3em]">{t('SETT_AUDIO')}</h3>
                    
                    <div className="space-y-4">
                        <VolumeSlider 
                            label={t('SETT_MUSIC')} 
                            value={volumes.music} 
                            onChange={(v) => setVolumes(prev => ({ ...prev, music: v }))} 
                        />
                        <VolumeSlider 
                            label={t('SETT_SFX')} 
                            value={volumes.sfx} 
                            onChange={(v) => setVolumes(prev => ({ ...prev, sfx: v }))} 
                        />
                    </div>
                </section>

                {/* Account Info */}
                <section className="space-y-4">
                    <h3 className="text-[0.65rem] font-black text-indigo-400 uppercase tracking-[0.3em]">{t('SETT_STATUS')}</h3>
                    <div className="p-4 bg-slate-900/60 border border-white/5 rounded-xl space-y-3">
                        <div className="flex justify-between">
                            <span className="text-xs text-slate-400">{t('SETT_ID')}</span>
                            <span className="text-xs font-mono text-white/60 uppercase">USER-{user.id.toUpperCase()}-B22</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-xs text-slate-400">{t('SETT_SYNC')}</span>
                            <span className="text-xs font-black text-emerald-400 italic uppercase">{t('SETT_CONNECTED')}</span>
                        </div>
                    </div>
                </section>

                {/* Graphics */}
                <section className="space-y-4">
                    <h3 className="text-[0.65rem] font-black text-indigo-400 uppercase tracking-[0.3em]">{t('SETT_VISUAL')}</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <SlantedButton variant="primary" size="sm" fullWidth>{t('SETT_60FPS')}</SlantedButton>
                        <SlantedButton variant="secondary" size="sm" fullWidth>{t('SETT_HIGHRES')}</SlantedButton>
                    </div>
                </section>

                <div className="pt-4 text-center">
                    <p className="text-[0.5rem] font-bold text-slate-600 uppercase tracking-[0.2em]">Build Version 1.4.0-Spatial</p>
                </div>
            </div>

            <ModalFooter onClose={onExit} />
        </div>
    );
};

const VolumeSlider: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
            <span className="text-[0.7rem] font-black text-white italic uppercase tracking-tight">{label}</span>
            <span className="text-xs font-black text-indigo-400 italic tabular-nums">{value}%</span>
        </div>
        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
            <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-300"
                style={{ width: `${value}%` }}
            />
            <input 
                type="range" 
                min="0" max="100" 
                value={value} 
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
        </div>
    </div>
);