import { mergeProps } from 'solid-js';

interface AtmosphericGlowProps {
    color?: string; // e.g. "99, 102, 241" (indigo-500)
    opacity?: number;
    size?: string; // e.g. "90%"
    falloff?: string; // e.g. "38%"
    class?: string;
}

export const AtmosphericGlow = (props: AtmosphericGlowProps) => {
    const merged = mergeProps({
        color: "99, 102, 241", 
        opacity: 0.4, 
        size: "90%", 
        falloff: "38%",
        class: ""
    }, props);

    return (
        <div class={`absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center ${merged.class}`}>
            {/* Primary Bloom */}
            <div 
                class="absolute h-[110%] blur-[40px]"
                style={{
                    width: merged.size,
                    opacity: merged.opacity,
                    background: `radial-gradient(ellipse at center, 
                        rgba(${merged.color}, 0.7) 0%, 
                        rgba(${merged.color}, 0.2) 20%, 
                        transparent ${merged.falloff})`
                }}
            />
            
            {/* Core Tight Glow */}
            <div 
                class="absolute w-20 h-52 blur-3xl rounded-full"
                style={{
                    opacity: merged.opacity + 0.1,
                    "background-color": `rgba(${merged.color}, 0.3)`
                }}
            />
        </div>
    );
};
