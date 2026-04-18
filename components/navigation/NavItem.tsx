import { GameText } from '../ui/GameText';
import { JSX } from 'solid-js';

interface NavItemProps {
    label: string;
    icon: JSX.Element;
    active: boolean;
    onClick: () => void;
}

export const NavItem = (props: NavItemProps) => {
    /**
     * UI REFINEMENT: 
     * Inactive buttons now use a brighter, high-contrast border (white/25) 
     * to feel like chiseled glass modules that catch the ambient light.
     */
    const variantStyles = () => props.active 
        ? "from-indigo-600 to-purple-900 border-indigo-400 shadow-[0_0.2rem_0_rgba(79,70,229,0.5)]"
        : "bg-white/[0.04] border-white/25 shadow-none hover:bg-white/[0.08] hover:border-white/40 transition-all";

    const textShadowClass = "drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]";

    return (
        <button 
            onClick={() => props.onClick()}
            class="flex-1 min-w-0 h-12 relative group outline-none overflow-visible active:scale-[0.97] transition-transform"
        >
            {/* BACKGROUND LAYER */}
            <div class={`
                absolute inset-0 rounded skew-x-[-9deg] border
                ${props.active ? 'bg-gradient-to-b' : ''}
                ${variantStyles()}
            `} />
            
            {/* CONTENT LAYER */}
            <div class={`
                relative h-full flex flex-col items-center justify-center skew-x-[-9deg] px-1
            `}>
                <div class={`
                    mb-1 scale-90 transition-all duration-300
                    ${textShadowClass}
                    ${props.active ? 'text-white scale-100' : 'text-slate-400 group-hover:text-slate-200'}
                `}>
                    {props.icon}
                </div>
                
                <div class="w-full h-3.5 flex items-center justify-center">
                    <GameText 
                        text={props.label}
                        baseFontSize={0.75}
                        minScale={0.4}
                        maxScale={1.0}
                        skewFactor={0.9}
                        maxLines={1}
                        class={`
                            font-black italic tracking-tighter uppercase transition-colors duration-300
                            ${textShadowClass}
                            ${props.active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}
                        `}
                    />
                </div>
            </div>
        </button>
    );
};
