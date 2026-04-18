import React, { useState, useRef, useEffect } from 'react';
import { GameText } from './GameText';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'blue' | 'black' | 'glass' | 'ghost';

interface SlantedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    fullWidth?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    icon?: React.ReactNode;
    holdDuration?: number; 
    onHoldChange?: (isHolding: boolean) => void;
    onHoldComplete?: (e: React.PointerEvent) => void;
    onProgressChange?: (progress: number) => void;
}

export const SlantedButton: React.FC<SlantedButtonProps> = ({ 
    children, 
    variant = 'primary', 
    fullWidth = false,
    size = 'md',
    icon,
    className = '',
    holdDuration = 0,
    onHoldChange,
    onHoldComplete,
    onProgressChange,
    onClick,
    ...props 
}) => {
    const [progress, setProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);
    const timerRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const hasTriggeredHold = useRef(false);

    const variants = {
        primary: "from-indigo-500 to-indigo-800 border-indigo-400 shadow-[0_0.2rem_0_rgb(30,58,138)] bg-gradient-to-b",
        secondary: "from-slate-700 to-slate-900 border-slate-500 shadow-[0_0.2rem_0_rgb(15,23,42)] bg-gradient-to-b",
        success: "from-emerald-600 to-emerald-900 border-emerald-400 shadow-[0_0.2rem_0_rgb(6,78,59)] bg-gradient-to-b",
        danger: "from-red-600 to-red-900 border-red-400 shadow-[0_0.2rem_0_rgb(127,29,29)] bg-gradient-to-b",
        warning: "from-amber-600 to-amber-900 border-amber-400 shadow-[0_0.2rem_0_rgb(120,53,15)] bg-gradient-to-b",
        blue: "from-blue-600 to-blue-900 border-blue-400 shadow-[0_0.2rem_0_rgb(30,58,138)] bg-gradient-to-b",
        black: "from-slate-900 to-black border-slate-800 shadow-[0_0.2rem_0_rgb(0,0,0)] bg-gradient-to-b",
        glass: "bg-slate-900/90 border-white/30 shadow-[0_2px_10px_rgba(0,0,0,0.5)] hover:bg-indigo-950/95 hover:border-white/50 transition-all",
        ghost: "bg-white/[0.04] border-white/20 shadow-[0_0.15rem_0_rgba(255,255,255,0.05)] hover:bg-white/[0.08] hover:border-white/30 transition-all",
    };

    /**
     * RECALIBRATED SIZE CONFIGS
     * 'sm' reduced to h-7 for a sleeker profile in the store grid.
     */
    const sizeConfigs = {
        xs: { height: "h-[1.65rem]", fontSize: 0.8, padding: "px-1" },
        sm: { height: "h-7", fontSize: 0.95, padding: "px-2" },
        md: { height: "h-10", fontSize: 1.1, padding: "px-3" },
        lg: { height: "h-16", fontSize: 1.4, padding: "px-4" }
    };

    const config = sizeConfigs[size];

    const startHold = (e: React.PointerEvent) => {
        if (!holdDuration || props.disabled) return;
        setIsHolding(true);
        onHoldChange?.(true);
        hasTriggeredHold.current = false;
        startTimeRef.current = Date.now();
        
        timerRef.current = window.setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const p = Math.min((elapsed / holdDuration) * 100, 100);
            setProgress(p);
            onProgressChange?.(p);
            
            if (p >= 100 && !hasTriggeredHold.current) {
                hasTriggeredHold.current = true;
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
                
                if (onHoldComplete) {
                    onHoldComplete(e);
                } else if (onClick) {
                    const sEvent = { clientX: e.clientX, clientY: e.clientY, target: e.target, currentTarget: e.currentTarget, type: 'click' } as any;
                    onClick(sEvent);
                }
                
                setIsHolding(false);
                onHoldChange?.(false);
                setProgress(0);
            }
        }, 16);
    };

    const cancelHold = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setIsHolding(false);
        onHoldChange?.(false);
        setProgress(0);
        onProgressChange?.(0);
    };

    const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (holdDuration > 0 && hasTriggeredHold.current) {
            return;
        }
        onClick?.(e);
    };

    useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

    const hasExplicitWidth = className.includes('w-') || className.includes('max-w-');
    const widthClass = fullWidth ? 'w-full' : (hasExplicitWidth ? '' : 'w-max');

    const containerJustify = (icon && children !== undefined) ? 'justify-start' : 'justify-center';
    const textJustify = 'justify-center';

    return (
        <div className={`relative group ${widthClass} ${config.height} min-w-0 ${props.disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
            <button 
                className={`w-full h-full relative z-10 outline-none`}
                onPointerDown={holdDuration ? startHold : undefined}
                onPointerUp={holdDuration ? cancelHold : undefined}
                onPointerLeave={holdDuration ? cancelHold : undefined}
                onClick={handleButtonClick}
                role="button"
                {...props}
            >
                {/* SLANTED BACKGROUND */}
                <div className={`absolute inset-0 border rounded skew-x-[-9deg] overflow-hidden ${variants[variant]}`}>
                    {holdDuration > 0 && (
                        <div className={`absolute inset-y-0 left-0 bg-white/30 transition-all duration-75 ease-linear pointer-events-none`} style={{ width: `${progress}%` }} />
                    )}
                </div>
                
                {/* SLANTED CONTENT WRAPPER */}
                <div className={`relative z-20 h-full w-full pointer-events-none flex items-center ${containerJustify} skew-x-[-9deg] min-w-0 ${config.padding}`}>
                    <div className={`flex items-center ${containerJustify} gap-0 w-full h-full min-w-0 ${isHolding ? 'opacity-40' : 'opacity-100'}`}>
                        {icon && (
                            <div className={`shrink-0 flex items-center justify-center drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] ${children !== undefined ? 'pr-0.5' : ''}`}>
                                {icon}
                            </div>
                        )}
                        
                        {children !== undefined && (
                            <div className={`flex-1 h-full min-w-0 flex items-center ${textJustify}`}>
                                {typeof children === 'string' || typeof children === 'number' ? (
                                    <GameText 
                                        text={children.toString()} 
                                        baseFontSize={config.fontSize} 
                                        skewFactor={0.9} 
                                        maxScale={1.5}
                                        className="text-white font-black italic tracking-tighter uppercase drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]"
                                    />
                                ) : (
                                    <div className={`flex items-center ${textJustify} drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] w-full h-full min-w-0`}>
                                        {children}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </button>
        </div>
    );
};