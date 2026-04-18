
import React from 'react';

interface AtmosphericGlowProps {
    color?: string; // e.g. "99, 102, 241" (indigo-500)
    opacity?: number;
    size?: string; // e.g. "90%"
    falloff?: string; // e.g. "38%"
    className?: string;
}

export const AtmosphericGlow: React.FC<AtmosphericGlowProps> = ({ 
    color = "99, 102, 241", 
    opacity = 0.4, 
    size = "90%", 
    falloff = "38%",
    className = ""
}) => {
    return (
        <div className={`absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center ${className}`}>
            {/* Primary Bloom */}
            <div 
                className="absolute h-[110%] blur-[40px]"
                style={{
                    width: size,
                    opacity: opacity,
                    background: `radial-gradient(ellipse at center, 
                        rgba(${color}, 0.7) 0%, 
                        rgba(${color}, 0.2) 20%, 
                        transparent ${falloff})`
                }}
            />
            
            {/* Core Tight Glow */}
            <div 
                className="absolute w-20 h-52 blur-3xl rounded-full"
                style={{
                    opacity: opacity + 0.1,
                    backgroundColor: `rgba(${color}, 0.3)`
                }}
            />
        </div>
    );
};
