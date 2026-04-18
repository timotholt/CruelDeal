
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { HexBadge } from '../ui/HexBadge';
import { RewardIconGraphic } from '../ui/RewardItemVisual';
import { ProgressionRewardType } from '../../types';
import { getVariant, getScale, getPulseColor, getSpinnerColor, getCheckmarkColor, getFlareColor } from './progressionUtils';
import { GameText } from '../ui/GameText';
import { Portal } from '../ui/Portal';

interface ProgressionHexButtonProps {
    type: ProgressionRewardType;
    unclaimedCount: number;
    rewardAmount?: string | number;
    isClaiming: boolean;
    isClaimingAll: boolean;
    isSuccess: boolean;
    isGlobalTicking: boolean;
    onClaim: () => void;
    onClaimAll: () => void;
}

const FloatingClaimText: React.FC<{ 
    amount: string | number; 
    type: ProgressionRewardType; 
    x: number; 
    y: number; 
    onComplete: () => void 
}> = ({ amount, type, x, y, onComplete }) => {
    useEffect(() => {
        const timer = setTimeout(onComplete, 8100); 
        return () => clearTimeout(timer);
    }, [onComplete]);

    const themeColor = getFlareColor(type);
    const isBox = type === 'box';

    return (
        <div 
            className="fixed z-[999] pointer-events-none flex items-center gap-1.5 whitespace-nowrap will-change-transform reward-float-container"
            style={{ left: x, top: y, color: themeColor, filter: `drop-shadow(0 0 6px ${themeColor}44)` }}
        >
            {!isBox && <span className="font-black italic text-sm tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">+{amount}</span>}
            <div className={`${isBox ? 'w-10 h-10' : 'w-5 h-5'} drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]`}>
                <RewardIconGraphic type={type} size="sm" />
            </div>
        </div>
    );
};

/**
 * RADIANT HEX PULSE
 * A specialized SVG component that renders a hex shape with the animate-ping behavior.
 */
const RadiantHexPulse: React.FC<{ _color: string; colorClass: string }> = ({ _color, colorClass }) => {
    return (
        <div className="absolute inset-0 animate-ping pointer-events-none flex items-center justify-center overflow-visible">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible opacity-60">
                <path 
                    d="M50 2 L95 25 L95 75 L50 98 L5 75 L5 25 Z" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="3"
                    className={colorClass}
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
};

export const ProgressionHexButton: React.FC<ProgressionHexButtonProps> = React.memo(({
    type, unclaimedCount, rewardAmount, isClaiming, isClaimingAll, isSuccess, onClaim, onClaimAll
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<number | null>(null);
    const hasTriggeredHold = useRef(false);

    const [progress, setProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);
    
    // Pulse System: Supports multiple concurrent rings
    const [pulses, setPulses] = useState<{ id: number }[]>([]);
    
    const [capturedCount, setCapturedCount] = useState(1);
    const [activeFloaters, setActiveFloaters] = useState<{ id: number; amount: string | number; x: number; y: number }[]>([]);

    const canClaim = unclaimedCount > 0;
    const colors = useMemo(() => ({
        variant: getVariant(type),
        pulse: getPulseColor(type),
        spinner: getSpinnerColor(type),
        checkmark: getCheckmarkColor(type),
        flare: getFlareColor(type)
    }), [type]);

    const addPulse = useCallback(() => {
        const id = Date.now() + Math.random();
        setPulses(prev => [...prev, { id }]);
        setTimeout(() => {
            setPulses(prev => prev.filter(p => p.id !== id));
        }, 1000); // Standard animate-ping duration is 1s
    }, []);

    const triggerFloatingFeedback = useCallback((bulkCount: number = 1) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const spawnX = rect.left + rect.width / 2;
        const spawnY = rect.top + rect.height / 2;

        const isBox = type === 'box';
        setTimeout(() => {
            if (isBox && bulkCount > 1) {
                for (let i = 0; i < bulkCount; i++) {
                    setTimeout(() => {
                        setActiveFloaters(p => [...p, { id: Date.now() + Math.random(), amount: 1, x: spawnX, y: spawnY }]);
                    }, i * 300);
                }
            } else {
                const amount = typeof rewardAmount === 'number' ? rewardAmount * bulkCount : (rewardAmount || '');
                setActiveFloaters(p => [...p, { id: Date.now() + Math.random(), amount, x: spawnX, y: spawnY }]);
            }
        }, 200);
    }, [rewardAmount, type]);

    useEffect(() => {
        if (isSuccess) triggerFloatingFeedback(capturedCount);
    }, [isSuccess, triggerFloatingFeedback, capturedCount]);

    const startHold = useCallback(() => {
        if (!canClaim || isClaiming || isClaimingAll || isSuccess) return;
        hasTriggeredHold.current = false;
        if (unclaimedCount <= 1) return;

        setIsHolding(true);
        const startTime = Date.now();
        timerRef.current = window.setInterval(() => {
            const p = Math.min(((Date.now() - startTime) / 800) * 100, 100);
            setProgress(p);
            if (p >= 100) {
                if (timerRef.current) clearInterval(timerRef.current);
                hasTriggeredHold.current = true;
                
                // BULK PULSE BURST: 3 soft staggered HEX rings for high energy theme alignment
                addPulse();
                setTimeout(addPulse, 200);
                setTimeout(addPulse, 400);

                setCapturedCount(unclaimedCount);
                onClaimAll();
                setIsHolding(false);
                setProgress(0);
            }
        }, 16);
    }, [canClaim, unclaimedCount, isClaiming, isClaimingAll, isSuccess, onClaimAll, addPulse]);

    const handlePointerUp = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        
        // Single Tap Logic
        if (!hasTriggeredHold.current && !isClaiming && !isClaimingAll && !isSuccess && canClaim) {
            // SINGLE PULSE: Standard pretty radiating hex
            addPulse();
            setCapturedCount(1);
            onClaim();
        }
        setIsHolding(false);
        setProgress(0);
    }, [isClaiming, isClaimingAll, isSuccess, canClaim, onClaim, addPulse]);

    const renderCheckmarks = () => {
        const count = Math.min(capturedCount, 3);
        if (count === 1) return <div className="w-8 h-8"><CheckmarkIcon colorClass={colors.checkmark} /></div>;
        if (count === 2) return (
            <div className="relative w-10 h-10">
                <div className="absolute top-1 left-1 w-6 h-6"><CheckmarkIcon colorClass={colors.checkmark} delay={0} /></div>
                <div className="absolute bottom-1 right-1 w-6 h-6"><CheckmarkIcon colorClass={colors.checkmark} delay={150} /></div>
            </div>
        );
        return (
            <div className="relative w-10 h-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5"><CheckmarkIcon colorClass={colors.checkmark} delay={0} /></div>
                <div className="absolute bottom-0.5 left-0 w-5 h-5"><CheckmarkIcon colorClass={colors.checkmark} delay={150} /></div>
                <div className="absolute bottom-0.5 right-0 w-5 h-5"><CheckmarkIcon colorClass={colors.checkmark} delay={300} /></div>
            </div>
        );
    };

    return (
        <div 
            ref={containerRef}
            className={`relative group cursor-pointer select-none touch-none transition-all duration-300 ${!canClaim && !isSuccess ? 'opacity-40 grayscale pointer-events-none' : ''} ${isHolding ? 'brightness-125' : ''}`}
            onPointerDown={startHold} onPointerUp={handlePointerUp} onPointerLeave={() => { if(timerRef.current) clearInterval(timerRef.current); setIsHolding(false); setProgress(0); }}
            style={{ '--flare-color': colors.flare, '--glow-color': colors.flare } as React.CSSProperties}
        >
            <Portal>
                {activeFloaters.map(f => (
                    <FloatingClaimText key={f.id} {...f} type={type} onComplete={() => setActiveFloaters(p => p.filter(i => i.id !== f.id))} />
                ))}
            </Portal>

            {/* Radiant Hex Pulse Layer */}
            <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center overflow-visible">
                {pulses.map(pulse => (
                    <RadiantHexPulse key={pulse.id} color={colors.flare} colorClass={colors.checkmark} />
                ))}
            </div>

            {isHolding && (
                <div className="absolute inset-[-0.3rem] z-50 pointer-events-none flex items-center justify-center">
                    <svg className="w-full h-full" style={{ filter: `drop-shadow(0 0 8px var(--flare-color))` }} viewBox="0 0 100 100">
                        <path 
                            d="M50 2 L95 25 L95 75 L50 98 L5 75 L5 25 Z" 
                            fill="none" 
                            stroke={colors.flare} 
                            strokeWidth="6" 
                            strokeDasharray={`${progress * 3.03} 303`} 
                            strokeLinecap="round" 
                            className="opacity-90" 
                        />
                    </svg>
                    <div 
                        className="absolute inset-0 animate-pulse opacity-20" 
                        style={{ 
                            backgroundColor: colors.flare,
                            clipPath: 'polygon(50% 2%, 95% 25%, 95% 75%, 50% 98%, 5% 75%, 5% 25%)'
                        }} 
                    />
                </div>
            )}

            <HexBadge 
                variant={colors.variant} size="lg" glow={canClaim || isSuccess}
                className={`${canClaim && !isSuccess && !isClaiming && !isClaimingAll && !isHolding ? 'animate-hex-glow' : ''} ${isSuccess ? 'animate-success-flare' : ''} transition-all duration-500`}
            >
                <div className="flex flex-col items-center justify-center w-full h-full relative overflow-visible">
                    {isSuccess ? renderCheckmarks() : (isClaiming || isClaimingAll) ? (
                        <div className={`w-6 h-6 border-4 border-white/20 ${colors.spinner} rounded-full animate-spin`} />
                    ) : (
                        <div className="relative flex items-center justify-center w-full h-full">
                            <div className={`${getScale(type)} ${type !== 'box' ? '-translate-y-[0.5rem]' : ''}`}><RewardIconGraphic type={type as any} size="sm" /></div>
                            {rewardAmount && type !== 'box' && (
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-[0.3rem] z-50 flex justify-center overflow-visible">
                                    <span className="text-white font-black italic drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none uppercase tracking-tighter text-[0.8rem] whitespace-nowrap">{rewardAmount}</span>
                                </div>
                            )}
                            {unclaimedCount > 0 && (
                                <div 
                                    key={unclaimedCount}
                                    className="absolute -bottom-3 -right-3 bg-red-600 border-2 border-white h-[1.3rem] min-w-[1.3rem] px-1 flex items-center justify-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.6)] z-50 animate-badge-gain overflow-hidden"
                                >
                                    <div className="w-full h-[75%]"><GameText text={unclaimedCount.toString()} baseFontSize={0.65} italic={false} className="text-white font-black drop-shadow-md" /></div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </HexBadge>
        </div>
    );
});

const CheckmarkIcon = ({ className = "", delay = 0, colorClass = "text-white" }: { className?: string, delay?: number, colorClass?: string }) => (
    <svg className={`w-full h-full animate-pop ${colorClass} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ animationDelay: `${delay}ms` }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);
