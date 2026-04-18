import React from 'react';
import { GameText } from '../ui/GameText';

interface NavItemProps {
    label: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
}

const NavItemComponent: React.FC<NavItemProps> = ({ label, icon, onClick, active }) => {
    /**
     * UI REFINEMENT: 
     * Inactive buttons now use a brighter, high-contrast border (white/25) 
     * to feel like chiseled glass modules that catch the ambient light.
     */
    const variantStyles = active 
        ? "from-indigo-600 to-purple-900 border-indigo-400 shadow-[0_0.2rem_0_rgba(79,70,229,0.5)]"
        : "bg-white/[0.04] border-white/25 shadow-none hover:bg-white/[0.08] hover:border-white/40 transition-all";

    const textShadowClass = "drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]";

    return (
        <button 
            onClick={onClick}
            className="flex-1 min-w-0 h-12 relative group outline-none overflow-visible active:scale-[0.97] transition-transform"
        >
            {/* BACKGROUND LAYER */}
            <div className={`
                absolute inset-0 rounded skew-x-[-9deg] border
                ${active ? 'bg-gradient-to-b' : ''}
                ${variantStyles}
            `} />
            
            {/* CONTENT LAYER */}
            <div className={`
                relative h-full flex flex-col items-center justify-center skew-x-[-9deg] px-1
            `}>
                <div className={`
                    mb-1 scale-90 transition-all duration-300
                    ${textShadowClass}
                    ${active ? 'text-white scale-100' : 'text-slate-400 group-hover:text-slate-200'}
                `}>
                    {icon}
                </div>
                
                <div className="w-full h-3.5 flex items-center justify-center">
                    <GameText 
                        text={label}
                        baseFontSize={0.75}
                        minScale={0.4}
                        maxScale={1.0}
                        skewFactor={0.9}
                        maxLines={1}
                        className={`
                            font-black italic tracking-tighter uppercase transition-colors duration-300
                            ${textShadowClass}
                            ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}
                        `}
                    />
                </div>
            </div>
        </button>
    );
};

export const NavItem = React.memo(NavItemComponent);