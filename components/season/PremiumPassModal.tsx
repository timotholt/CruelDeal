
import React, { useState, useEffect } from 'react';
import { Portal } from '../ui/Portal';
import { ModalBackdrop } from '../ui/ModalBackdrop';
import { SlantedButton } from '../ui/SlantedButton';
import { ModalFooter } from '../ui/ModalFooter';
import { api } from '../../services/api';

interface PremiumPassModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PremiumPassModal: React.FC<PremiumPassModalProps> = ({ isOpen, onClose }) => {
    const [content, setContent] = useState<any>(null);

    useEffect(() => {
        if (isOpen) {
            api.cms.premium('en').then(response => {
                if (response.success) {
                    setContent(response.data);
                }
            });
        }
    }, [isOpen]);

    if (!isOpen || !content) return null;

    return (
        <Portal>
            <ModalBackdrop onClose={onClose} blurAmount="md">
                <div 
                    className="w-full max-w-sm bg-slate-900 border-2 border-indigo-500/50 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(79,70,229,0.3)] flex flex-col animate-pop"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="relative h-40 shrink-0">
                        <img src="https://picsum.photos/seed/pirates/600/300" className="w-full h-full object-cover opacity-60" alt="" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                        <div className="absolute bottom-4 left-6">
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg">{content.title}</h2>
                            <p className="text-[0.6rem] font-bold text-indigo-300 uppercase tracking-[0.2em]">{content.subtitle}</p>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div className="space-y-3">
                            {(content.rewards || []).map((r: any, i: number) => (
                                <RewardItem key={i} icon={r.icon} title={r.title} description={r.desc} />
                            ))}
                        </div>
                        <div className="pt-4">
                            <SlantedButton variant="warning" fullWidth size="lg">
                                <div className="flex flex-col items-center py-1">
                                    <span className="text-[0.60rem] opacity-70 uppercase">{content.ctaLabel}</span>
                                    <span className="text-lg">{content.ctaMain}</span>
                                </div>
                            </SlantedButton>
                        </div>
                    </div>
                    
                    <ModalFooter onClose={onClose} />
                </div>
            </ModalBackdrop>
        </Portal>
    );
};

const RewardItem: React.FC<{ icon: string, title: string, description: string }> = ({ icon, title, description }) => (
    <div className="flex items-center gap-4 p-3 bg-slate-800/50 border border-white/5 rounded-xl hover:bg-slate-800 transition-colors">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-xl shadow-inner border border-white/5">{icon}</div>
        <div className="flex-1">
            <h4 className="text-[0.7rem] font-black text-white uppercase tracking-tight">{title}</h4>
            <p className="text-[0.55rem] text-slate-400 font-medium leading-tight">{description}</p>
        </div>
    </div>
);
