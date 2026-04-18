import { Show } from 'solid-js';

interface ModalBackdropProps {
    children?: any;
    onClose: () => void;
    class?: string;
    showCloseHint?: boolean;
    blurAmount?: 'sm' | 'md' | 'lg';
}

export const ModalBackdrop = (props: ModalBackdropProps) => {
    const blurClass = () => ({
        sm: 'backdrop-blur-sm',
        md: 'backdrop-blur-md',
        lg: 'backdrop-blur-xl'
    }[props.blurAmount || 'md']);

    return (
        <div 
            class={`fixed inset-0 z-[500] bg-black/55 ${blurClass()} flex flex-col items-center justify-center p-4 overflow-hidden ${props.class || ''}`}
            onClick={() => props.onClose()}
        >
            {/* The actual modal content */}
            {props.children}
            
            {/* Standardised Close Hint */}
            <Show when={props.showCloseHint}>
                <div class="fixed bottom-8 text-white/20 font-black text-[0.5rem] uppercase tracking-[0.4em] animate-pulse pointer-events-none drop-shadow-md">
                    Tap anywhere to close
                </div>
            </Show>
        </div>
    );
};
