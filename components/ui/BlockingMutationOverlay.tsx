
import React, { useState, useEffect } from 'react';
import { Portal } from './Portal';

/**
 * BLOCKING MUTATION OVERLAY (Stealth Edition)
 * 1. Blocks all pointer events immediately upon mount.
 * 2. Remains 100% transparent for the first 500ms (Grace Period).
 * 3. Shows a minimal holographic indicator only if the transaction persists.
 */
export const BlockingMutationOverlay: React.FC = () => {
    const [showVisuals, setShowVisuals] = useState(false);

    useEffect(() => {
        // Only show the "Syncing" graphics if the lock lasts longer than 500ms
        const timer = setTimeout(() => {
            setShowVisuals(true);
        }, 500);
        
        return () => clearTimeout(timer);
    }, []);

    return (
        <Portal>
            {/* The Invisible Shield: Always present to prevent double-taps */}
            <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/0 pointer-events-auto select-none">
                
                {/* Visual Feedback: Only appears if the server is slow */}
                <div className={`flex flex-col items-center transition-opacity duration-700 ${showVisuals ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="relative mb-4">
                        {/* Minimalist Spinner */}
                        <div className="w-12 h-12 border-2 border-indigo-500/10 rounded-full" />
                        <div className="absolute inset-0 w-12 h-12 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    </div>

                    <div className="text-center">
                        <span className="text-[0.5rem] font-black text-indigo-400/60 uppercase tracking-[0.4em] animate-pulse italic">
                            Syncing Sector
                        </span>
                    </div>
                </div>

                {/* Subtle "Active" screen-edge glow to show the app hasn't crashed */}
                <div className={`absolute inset-x-0 bottom-0 h-1 bg-indigo-500/20 blur-sm transition-opacity duration-1000 ${showVisuals ? 'opacity-100' : 'opacity-0'}`} />
            </div>
        </Portal>
    );
};
