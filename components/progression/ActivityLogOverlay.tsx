import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { useUser } from '../../contexts/UserContext';
import { useUI } from '../../contexts/UIContext';
import { Portal } from '../ui/Portal';
import { DynamicBackground } from '../ui/DynamicBackground';
import { ModalFooter } from '../ui/ModalFooter';
import { ActivityLogSection } from './ActivityLogSection';
import { PremiumHeaderBase } from '../ui/PremiumHeaderBase';

const STAGGER_MS = 500;

export const ActivityLogOverlay = () => {
    const userContext = useUser();
    const uiContext = useUI();
    
    const [flippedItemId, setFlippedItemId] = createSignal<string | null>(null);
    const [closingItemId, setClosingItemId] = createSignal<string | null>(null);
    const [isExiting, setIsExiting] = createSignal(false);
    
    let prevFlippedId: string | null = null;

    createEffect(() => {
        const currentId = flippedItemId();

        if (prevFlippedId && currentId && prevFlippedId !== currentId) {
            const capturedPrevId = prevFlippedId;
            const timer = setTimeout(() => {
                setClosingItemId(capturedPrevId);
                const innerTimer = setTimeout(() => {
                    setClosingItemId(null);
                }, STAGGER_MS);
                onCleanup(() => clearTimeout(innerTimer));
            }, 0);
            onCleanup(() => clearTimeout(timer));
        }
        
        if (!currentId) {
            const timer = setTimeout(() => setClosingItemId(null), 0);
            onCleanup(() => clearTimeout(timer));
        }

        prevFlippedId = currentId;
    });

    createEffect(() => {
        if (uiContext.isActivityLogOpen) {
            const timer = setTimeout(() => {
                setIsExiting(false);
                setFlippedItemId(null);
                setClosingItemId(null);
                prevFlippedId = null;
            }, 0);
            onCleanup(() => clearTimeout(timer));
        }
    });

    const handleFlipItem = (nextId: string | null) => {
        setFlippedItemId(nextId);
    };

    const handleClose = () => {
        if (isExiting()) return;
        setIsExiting(true);
        setFlippedItemId(null); 
        
        setTimeout(() => {
            uiContext.closeActivityLog();
        }, STAGGER_MS); 
    };

    return (
        <Show when={uiContext.isActivityLogOpen}>
            <Portal>
                <div 
                    class={`fixed inset-0 z-[250] flex flex-col items-center justify-start bg-slate-950 overflow-hidden transition-all duration-700 ${isExiting() ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100 scale-100'}`}
                >
                    <DynamicBackground opacity={0.6} />

                    <div class={`w-full h-full max-w-[23rem] flex flex-col relative z-10 overflow-hidden shadow-2xl border-x border-white/5 transition-transform duration-500 ${isExiting() ? 'scale-90 brightness-50 blur-sm' : 'scale-100'}`}>
                        
                        <PremiumHeaderBase class="pt-1 pb-2 px-1">
                            <h1 class="text-[1.2rem] font-black text-white tracking-tighter uppercase italic font-sans leading-none">
                                {"\u00A0\u00A0"}Activity Log
                            </h1>
                        </PremiumHeaderBase>

                        <div class="flex-1 flex flex-col min-h-0 relative z-10 overflow-hidden">
                            <ActivityLogSection 
                                logs={userContext.activityLog} 
                                flippedItemId={flippedItemId()}
                                closingItemId={closingItemId()}
                                onFlipItem={handleFlipItem}
                            />
                        </div>

                        <ModalFooter onClose={handleClose} />
                    </div>
                </div>
            </Portal>
        </Show>
    );
};
