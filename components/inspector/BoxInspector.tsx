
import React from 'react';

interface BoxInspectorProps {
    boxType: 'MYSTERY' | 'MEGA';
    title: string;
    description: string;
}

export const BoxInspector: React.FC<BoxInspectorProps> = ({ boxType, title, description }) => {
    return (
        <div className="flex flex-col items-center animate-pop max-w-[20rem]">
            <div className="relative mb-10 group">
                <div className={`absolute inset-0 blur-[60px] opacity-40 rounded-full ${boxType === 'MEGA' ? 'bg-amber-400' : 'bg-indigo-400'}`} />
                <div className="w-40 h-40 relative preserve-3d transition-transform duration-1000 animate-[spin_12s_linear_infinite]">
                    <div className={`absolute inset-0 border-4 rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-md ${boxType === 'MEGA' ? 'bg-gradient-to-br from-amber-600 to-amber-900 border-amber-400 shadow-amber-500/30' : 'bg-gradient-to-br from-indigo-600 to-indigo-900 border-indigo-400 shadow-indigo-500/30'}`}>
                        <span className="text-5xl font-black text-white italic drop-shadow-lg">?</span>
                    </div>
                </div>
            </div>

            <div className="text-center px-4">
                <h2 className="text-4xl font-black text-white italic tracking-tighter mb-4 uppercase leading-none drop-shadow-lg">
                    {title}
                </h2>
                <div className="w-full h-px bg-white/20 mb-5 mx-auto max-w-[12rem]" />
                <p className="text-indigo-100 font-bold text-[0.9rem] leading-relaxed px-2 italic drop-shadow-sm">
                    {description}
                </p>
            </div>
            <style>{`.preserve-3d { transform-style: preserve-3d; }`}</style>
        </div>
    );
};
