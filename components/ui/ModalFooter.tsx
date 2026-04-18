import { mergeProps } from 'solid-js';
import { SlantedButton } from './SlantedButton';

interface ModalFooterProps {
    onClose: () => void;
    label?: string;
    variant?: 'danger' | 'secondary' | 'primary';
    class?: string;
}

/**
 * NEON MODAL FOOTER
 * Max-saturation footer design with laser-cut gradient rails and atmospheric bloom.
 */
export const ModalFooter = (props: ModalFooterProps) => {
    const merged = mergeProps({ 
        label: "Close", 
        variant: "secondary" as const,
        class: "" 
    }, props);

    return (
        <div class={`
            shrink-0 h-14 flex items-center justify-center z-50 relative
            bg-gradient-to-b from-indigo-900/60 via-slate-950/98 to-black
            backdrop-blur-xl shadow-[0_-15px_40px_rgba(0,0,0,0.9)] 
            ${merged.class}
        `}>
            {/* 1. THE LASER RAIL: Multi-stop high-vibrancy top border */}
            <div class="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 via-indigo-500 via-fuchsia-500 to-transparent opacity-80" />
            
            {/* 2. CHROMATIC BLOOM: Adds depth and "light bleed" behind the button */}
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <div class="w-32 h-8 bg-indigo-500/20 blur-2xl rounded-full" />
                <div class="w-16 h-4 bg-fuchsia-500/10 blur-xl rounded-full translate-x-8" />
            </div>

            {/* 3. CRYSTAL SHEEN: Subtle inner light reflection */}
            <div class="absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent pointer-events-none" />
            
            <SlantedButton 
                variant={merged.variant} 
                size="xs" 
                onClick={() => props.onClose()} 
                /* 
                   Tactical Button sizing: Standardized for one-tap exits.
                */
                class="shadow-2xl !w-[30vw] max-w-[7rem] !h-[1.6rem] relative z-10"
            >
                {merged.label}
            </SlantedButton>
        </div>
    );
};
