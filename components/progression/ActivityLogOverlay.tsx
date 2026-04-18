import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useUI } from '../../contexts/UIContext';
import { Portal } from '../ui/Portal';
import { DynamicBackground } from '../ui/DynamicBackground';
import { ModalFooter } from '../ui/ModalFooter';
import { ActivityLogSection } from './ActivityLogSection';
import { PremiumHeaderBase } from '../ui/PremiumHeaderBase';

const STAGGER_MS = 500;

export const ActivityLogOverlay: React.FC = () => {
    const { activityLog } = useUser();
    const { isActivityLogOpen, closeActivityLog } = useUI();
    
    // The card that just got flipped (Front to Back)
    const [flippedItemId, setFlippedItemId] = useState<string | null>(null);
    // The card currently in its "Grace Period" before un-flipping (Back to Front)
    const [closingItemId, setClosingItemId] = useState<string | null>(null);
    
    const [isExiting, setIsExiting] = useState(false);
    const prevFlippedIdRef = useRef<string | null>(null);

    // STAGGER ORCHESTRATOR
    // Detects when we switch from one open card to another
    useEffect(() => {
        const prevId = prevFlippedIdRef.current;
        const currentId = flippedItemId;

        // Only stagger if we are moving from one valid card directly to another valid card
        if (prevId && currentId && prevId !== currentId) {
            const timer = setTimeout(() => {
                setClosingItemId(prevId);
                const innerTimer = setTimeout(() => {
                    setClosingItemId(null);
                }, STAGGER_MS);
                return () => clearTimeout(innerTimer);
            }, 0);
            return () => clearTimeout(timer);
        }
        
        // If we toggled off or closed, clear the closing state immediately
        if (!currentId) {
            const timer = setTimeout(() => setClosingItemId(null), 0);
            return () => clearTimeout(timer);
        }

        prevFlippedIdRef.current = currentId;
    }, [flippedItemId]);

    // RESET ON OPEN/CLOSE
    useEffect(() => {
        if (isActivityLogOpen) {
            const timer = setTimeout(() => {
                setIsExiting(false);
                setFlippedItemId(null);
                setClosingItemId(null);
                prevFlippedIdRef.current = null;
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isActivityLogOpen]);

    const handleFlipItem = useCallback((nextId: string | null) => {
        setFlippedItemId(nextId);
    }, []);

    const handleClose = useCallback(() => {
        if (isExiting) return;
        setIsExiting(true);
        // Force un-flip everything for a clean exit
        setFlippedItemId(null); 
        
        setTimeout(() => {
            closeActivityLog();
        }, STAGGER_MS); 
    }, [isExiting, closeActivityLog]);

    if (!isActivityLogOpen) return null;

    return (
        <Portal>
            <div 
                className={`fixed inset-0 z-[250] flex flex-col items-center justify-start bg-slate-950 overflow-hidden transition-all duration-700 ${isExiting ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100 scale-100'}`}
            >
                <DynamicBackground opacity={0.6} />

                <div className={`w-full h-full max-w-[23rem] flex flex-col relative z-10 overflow-hidden shadow-2xl border-x border-white/5 transition-transform duration-500 ${isExiting ? 'scale-90 brightness-50 blur-sm' : 'scale-100'}`}>
                    
                    <PremiumHeaderBase className="pt-1 pb-2 px-1">
                        <h1 className="text-[1.2rem] font-black text-white tracking-tighter uppercase italic font-sans leading-none">
                            {"\u00A0\u00A0"}Activity Log
                        </h1>
                    </PremiumHeaderBase>

                    <div className="flex-1 flex flex-col min-h-0 relative z-10 overflow-hidden">
                        <ActivityLogSection 
                            logs={activityLog} 
                            flippedItemId={flippedItemId}
                            closingItemId={closingItemId}
                            onFlipItem={handleFlipItem}
                        />
                    </div>

                    <ModalFooter onClose={handleClose} />
                </div>
            </div>
        </Portal>
    );
};