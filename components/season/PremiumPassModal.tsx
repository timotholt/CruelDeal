import { createSignal, createEffect, Show, For } from 'solid-js';
import { Portal } from '../ui/Portal';
import { ModalBackdrop } from '../ui/ModalBackdrop';
import { SlantedButton } from '../ui/SlantedButton';
import { ModalFooter } from '../ui/ModalFooter';
import { api } from '../../services/api';

interface PremiumPassModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const RewardItem = (props: { icon: string, title: string, description: string }) => (
    <div class="flex items-center gap-4 p-3 bg-slate-800/50 border border-white/5 rounded-xl hover:bg-slate-800 transition-colors">
        <div class="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-xl shadow-inner border border-white/5">{props.icon}</div>
        <div class="flex-1">
            <h4 class="text-[0.7rem] font-black text-white uppercase tracking-tight">{props.title}</h4>
            <p class="text-[0.55rem] text-slate-400 font-medium leading-tight">{props.description}</p>
        </div>
    </div>
);

export const PremiumPassModal = (props: PremiumPassModalProps) => {
    const [content, setContent] = createSignal<any>(null);

    createEffect(() => {
        if (props.isOpen) {
            api.cms.premium('en').then(response => {
                if (response.success) {
                    setContent(response.data);
                }
            });
        }
    });

    return (
        <Show when={props.isOpen && content()}>
            {(data) => (
                <Portal>
                    <ModalBackdrop onClose={() => props.onClose()} blurAmount="md">
                        <div 
                            class="w-full max-w-sm bg-slate-900 border-2 border-indigo-500/50 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(79,70,229,0.3)] flex flex-col animate-pop"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div class="relative h-40 shrink-0">
                                <img 
                                    src="https://picsum.photos/seed/pirates/600/300" 
                                    class="w-full h-full object-cover opacity-60" 
                                    alt="" 
                                    referrerPolicy="no-referrer"
                                />
                                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                                <div class="absolute bottom-4 left-6">
                                    <h2 class="text-2xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg">{data().title}</h2>
                                    <p class="text-[0.6rem] font-bold text-indigo-300 uppercase tracking-[0.2em]">{data().subtitle}</p>
                                </div>
                            </div>
                            <div class="flex-1 overflow-y-auto p-6 space-y-4">
                                <div class="space-y-3">
                                    <For each={data().rewards || []}>
                                        {(r: any) => (
                                            <RewardItem icon={r.icon} title={r.title} description={r.desc} />
                                        )}
                                    </For>
                                </div>
                                <div class="pt-4">
                                    <SlantedButton variant="warning" fullWidth size="lg">
                                        <div class="flex flex-col items-center py-1">
                                            <span class="text-[0.60rem] opacity-70 uppercase">{data().ctaLabel}</span>
                                            <span class="text-lg">{data().ctaMain}</span>
                                        </div>
                                    </SlantedButton>
                                </div>
                            </div>
                            
                            <ModalFooter onClose={() => props.onClose()} />
                        </div>
                    </ModalBackdrop>
                </Portal>
            )}
        </Show>
    );
};
