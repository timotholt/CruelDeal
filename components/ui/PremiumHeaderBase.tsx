import React from 'react';

interface PremiumHeaderBaseProps {
    children: React.ReactNode;
    className?: string;
    innerClassName?: string;
}

/**
 * PREMIUM HEADER BASE
 * The authoritative visual stack for all headers, mirroring the footer style in reverse.
 * Features: Bottom Laser Rail, Chromatic Bloom, and Controlled Shadow depth.
 */
export const PremiumHeaderBase: React.FC<PremiumHeaderBaseProps> = ({ 
    children, 
    className = "",
    innerClassName = ""
}) => {
    return (
        <div className={`shrink-0 z-40 relative overflow-visible ${className}`}>
            
            {/* 1. THE ARCHITECTURAL BASE (REVERSED) 
                Shadow is tuned to [0_8px_16px] for a crisp lift that doesn't muddy top-screen content.
            */}
            <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950/98 to-indigo-900/60 backdrop-blur-xl shadow-[0_8px_16px_rgba(0,0,0,0.6)]" />

            {/* 2. THE LASER RAIL: Bottom edge vibrancy (Symmetric to footer's top rail) */}
            <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-500 via-indigo-500 via-cyan-400 to-transparent opacity-80 z-20" />

            {/* 3. CHROMATIC BLOOM: Adds depth and "light bleed" */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10">
                <div className="w-48 h-8 bg-indigo-500/20 blur-2xl rounded-full -translate-y-4" />
            </div>

            {/* 4. CRYSTAL SHEEN: Inverted reflection */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none z-10" />

            {/* 5. CONTENT LAYER */}
            <div className={`relative z-30 flex items-center w-full h-full ${innerClassName}`}>
                {children}
            </div>
        </div>
    );
};