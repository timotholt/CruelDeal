import { mergeProps, Show } from 'solid-js';

interface DynamicBackgroundProps {
    opacity?: number;
    showContrastShield?: boolean;
    class?: string;
}

/**
 * DYNAMIC BACKGROUND
 * The authoritative source for Cruel Deal's visual void.
 * Uses the high-performance .animated-bg CSS class defined in index.html.
 */
export const DynamicBackground = (props: DynamicBackgroundProps) => {
    const merged = mergeProps({ 
        opacity: 1, 
        showContrastShield: true,
        class: "" 
    }, props);

    return (
        <div class={`absolute inset-0 z-0 pointer-events-none overflow-hidden ${merged.class}`}>
            {/* The Animated Galaxy Layer */}
            <div 
                class="absolute inset-0 animated-bg" 
                style={{ opacity: merged.opacity }} 
            />
            
            {/* The Contrast Shield: Ensures text and cards pop regardless of bg color */}
            <Show when={merged.showContrastShield}>
                <div class="absolute inset-0 bg-black/40" />
            </Show>
        </div>
    );
};
