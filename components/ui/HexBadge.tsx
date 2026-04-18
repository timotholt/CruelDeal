
import React from 'react';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'blue';

interface HexBadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    glow?: boolean;
}

export const HexBadge: React.FC<HexBadgeProps> = ({ 
    children, 
    variant = 'primary', 
    size = 'md',
    className = '',
    glow = false
}) => {
    const variants = {
        primary: {
            fill: 'url(#bg_primary)',
            stroke: '#818cf8',
            innerStroke: '#c7d2fe',
            text: 'text-white',
            glowColor: 'rgba(99, 102, 241, 0.75)' // Increased from 0.4
        },
        secondary: {
            fill: 'url(#bg_secondary)',
            stroke: '#f1f5f9',
            innerStroke: '#ffffff',
            text: 'text-slate-900', 
            glowColor: 'rgba(255, 255, 255, 0.6)' // Increased from 0.3
        },
        success: {
            fill: 'url(#bg_success)',
            stroke: '#34d399',
            innerStroke: '#a7f3d0',
            text: 'text-white',
            glowColor: 'rgba(16, 185, 129, 0.75)' // Increased from 0.3
        },
        danger: {
            fill: 'url(#bg_danger)',
            stroke: '#f87171',
            innerStroke: '#fecaca',
            text: 'text-white',
            glowColor: 'rgba(239, 68, 68, 0.75)' // Increased from 0.3
        },
        warning: {
            fill: 'url(#bg_warning)',
            stroke: '#fbbf24',
            innerStroke: '#fde68a',
            text: 'text-white',
            glowColor: 'rgba(245, 158, 11, 0.75)' // Increased from 0.3
        },
        blue: {
            fill: 'url(#bg_blue)',
            stroke: '#60a5fa',
            innerStroke: '#bfdbfe',
            text: 'text-white',
            glowColor: 'rgba(59, 130, 246, 0.75)' // Increased from 0.3
        }
    };

    const sizeConfigs = {
        xs: { box: 'w-[1.25rem] h-[1.25rem]', fontSize: 0.5, strokeWidth: 11 },
        sm: { box: 'w-[2.0rem] h-[2.0rem]', fontSize: 0.7, strokeWidth: 9 },
        md: { box: 'w-[2.4rem] h-[2.4rem]', fontSize: 0.85, strokeWidth: 8 },
        lg: { box: 'w-[3.2rem] h-[3.2rem]', fontSize: 1.1, strokeWidth: 7 },
        xl: { box: 'w-[4.8rem] h-[4.8rem]', fontSize: 1.6, strokeWidth: 5 }
    };

    const v = variants[variant];
    const s = sizeConfigs[size];

    return (
        <div 
            className={`relative ${s.box} flex items-center justify-center shrink-0 ${className}`}
            style={glow ? { filter: `drop-shadow(0 0 10px ${v.glowColor})` } : {}}
        >
            <svg 
                viewBox="0 0 100 100" 
                className="absolute inset-0 w-full h-full overflow-visible"
            >
                <defs>
                    <linearGradient id="bg_primary" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#312e81" /><stop offset="100%" stopColor="#1e1b4b" />
                    </linearGradient>
                    <linearGradient id="bg_secondary" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#475569" /><stop offset="100%" stopColor="#334155" />
                    </linearGradient>
                    <linearGradient id="bg_success" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#064e3b" /><stop offset="100%" stopColor="#022c22" />
                    </linearGradient>
                    <linearGradient id="bg_danger" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7f1d1d" /><stop offset="100%" stopColor="#450a0a" />
                    </linearGradient>
                    <linearGradient id="bg_warning" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#78350f" /><stop offset="100%" stopColor="#451a03" />
                    </linearGradient>
                    <linearGradient id="bg_blue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1e3a8a" /><stop offset="100%" stopColor="#172554" />
                    </linearGradient>
                    
                    <clipPath id="hexClip">
                        <path d="M50 2 L95 25 L95 75 L50 98 L5 75 L5 25 Z" />
                    </clipPath>
                </defs>

                {/* Main Hex Body - Removed costly inner shadow filters */}
                <path 
                    d="M50 2 L95 25 L95 75 L50 98 L5 75 L5 25 Z" 
                    fill={v.fill}
                />

                {/* Outermost Stroke */}
                <path 
                    d="M50 2 L95 25 L95 75 L50 98 L5 75 L5 25 Z" 
                    fill="none" 
                    stroke={v.stroke} 
                    strokeWidth={s.strokeWidth} 
                    strokeLinejoin="round"
                />

                {/* Inner Accent Path */}
                <path 
                    d="M50 5 L91 26 L91 74 L50 95 L9 74 L9 26 Z" 
                    fill="none" 
                    stroke={v.innerStroke} 
                    strokeWidth="1.8" 
                    opacity="0.3"
                    strokeLinejoin="round"
                />
            </svg>

            <div className="relative z-10 w-full h-full flex items-center justify-center pointer-events-none">
                <div className="w-[82%] h-[82%] flex items-center justify-center">
                    {typeof children === 'string' || typeof children === 'number' ? (
                        <span className={`${v.text} font-black italic tracking-tighter uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,1)] text-[0.85em]`}>
                            {children}
                        </span>
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center ${v.text}`}>
                            {children}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
