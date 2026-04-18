
import React from 'react';

interface ModalBackdropProps {
    children: React.ReactNode;
    onClose: () => void;
    className?: string;
    showCloseHint?: boolean;
    blurAmount?: 'sm' | 'md' | 'lg';
}

export const ModalBackdrop: React.FC<ModalBackdropProps> = ({ 
    children, 
    onClose, 
    className = "",
    showCloseHint = false,
    blurAmount = 'md'
}) => {
    const blurClass = {
        sm: 'backdrop-blur-sm',
        md: 'backdrop-blur-md',
        lg: 'backdrop-blur-xl'
    }[blurAmount];

    return (
        <div 
            className={`fixed inset-0 z-[500] bg-black/55 ${blurClass} flex flex-col items-center justify-center p-4 overflow-hidden ${className}`}
            onClick={onClose}
        >
            {/* The actual modal content */}
            {children}
            
            {/* Standardised Close Hint */}
            {showCloseHint && (
                <div className="fixed bottom-8 text-white/20 font-black text-[0.5rem] uppercase tracking-[0.4em] animate-pulse pointer-events-none drop-shadow-md">
                    Tap anywhere to close
                </div>
            )}
        </div>
    );
};
