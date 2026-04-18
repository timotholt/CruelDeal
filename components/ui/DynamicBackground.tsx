
import React from 'react';

interface DynamicBackgroundProps {
    opacity?: number;
    showContrastShield?: boolean;
    className?: string;
}

/**
 * DYNAMIC BACKGROUND
 * The authoritative source for Galactic Snap's visual void.
 * Uses the high-performance .animated-bg CSS class defined in index.html.
 */
export const DynamicBackground: React.FC<DynamicBackgroundProps> = ({ 
    opacity = 1, 
    showContrastShield = true,
    className = "" 
}) => {
    return (
        <div className={`absolute inset-0 z-0 pointer-events-none overflow-hidden ${className}`}>
            {/* The Animated Galaxy Layer */}
            <div 
                className="absolute inset-0 animated-bg" 
                style={{ opacity }} 
            />
            
            {/* The Contrast Shield: Ensures text and cards pop regardless of bg color */}
            {showContrastShield && (
                <div className="absolute inset-0 bg-black/40" />
            )}
        </div>
    );
};
