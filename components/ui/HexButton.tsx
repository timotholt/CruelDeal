
import React, { useState, useRef, useEffect } from 'react';
import { GameText } from './GameText';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'blue';

interface HexButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    fullWidth?: boolean;
    size?: 'sm' | 'md' | 'lg';
    icon?: React.ReactNode;
    holdDuration?: number; 
    onHoldChange?: (isHolding: boolean) => void;
    onProgressChange?: (progress: number) => void;
}

export const HexButton: React.FC<HexButtonProps> = ({ 
    children, 
    variant = 'primary', 
    fullWidth = false,
    size = 'md',
    icon,
    className = '',
    holdDuration = 0,
    onHoldChange,
    onProgressChange,
    onClick,
    ...props 
}) => {
    const [progress, setProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);
    const timerRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);

    const variants = {
        primary: "from-purple-600 to-purple-900 border-purple-400 shadow-[0_0.2rem_0_rgb(88,28,135)]",
        secondary: "from-slate-700 to-slate-900 border-slate-500 shadow-[0_0.2rem_0_rgb(15,23,42)]",
        success: "from-emerald-600 to-emerald-900 border-emerald-400 shadow-[0_0.2rem_0_rgb(6,78,59)]",
        danger: "from-red-600 to-red-900 border-red-400 shadow-[0_0.2rem_0_rgb(127,29,29)]",
        warning: "from-amber-600 to-amber-900 border-amber-400 shadow-[0_0.2rem_0_rgb(120,53,15)]",
        blue: "from-blue-600 to-blue-900 border-blue-400 shadow-[0_0.2rem_0_rgb(30,58,138)]",
    };

    const sizeConfigs = {
        sm: { height: "h-7", fontSize: 0.8, padding: "px-2" },
        md: { height: "h-10", fontSize: 1.0, padding: "px-4" },
        lg: { height: "h-14", fontSize: 1.2, padding: "px-6" }
    };

    const config = sizeConfigs[size];

    const startHold = (e: React.PointerEvent) => {
        if (!holdDuration || props.disabled) return;
        setIsHolding(true);
        onHoldChange?.(true);
        startTimeRef.current = Date.now();
        timerRef.current = window.setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const p = Math.min((elapsed / holdDuration) * 100, 100);
            setProgress(p);
            onProgressChange?.(p);
            if (p >= 100) {
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
                setProgress(100);
                onProgressChange?.(100);
                setTimeout(() => {
                    if (onClick) {
                        const syntheticEvent = { 
                            clientX: e.clientX,
                            clientY: e.clientY,
                            target: e.target,
                            currentTarget: e.currentTarget,
                            type: 'click',
                            bubbles: true,
                            cancelable: true,
                            nativeEvent: e.nativeEvent,
                        } as unknown as React.MouseEvent<HTMLButtonElement>;
                        onClick(syntheticEvent);
                    }
                    setIsHolding(false);
                    onHoldChange?.(false);
                    setProgress(0);
                    onProgressChange?.(0);
                }, 60);
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

    useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

    const widthClass = fullWidth ? 'w-full' : 'w-max min-w-[3.5rem]';

    return (
        <div className={`relative group ${widthClass} ${config.height} ${props.disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <button 
                className={`w-full h-full relative z-10 active:translate-y-0.5 transition-all outline-none ${className}`}
                onPointerDown={holdDuration ? startHold : undefined}
                onPointerUp={holdDuration ? cancelHold : undefined}
                onPointerLeave={holdDuration ? cancelHold : undefined}
                onClick={holdDuration ? undefined : onClick}
                role="button"
                aria-busy={isHolding}
                {...props}
            >
                <div className={`absolute inset-0 bg-gradient-to-b border rounded skew-x-[-10deg] group-hover:brightness-110 transition-all duration-200 overflow-hidden ${variants[variant]}`}>
                    {holdDuration > 0 && (
                        <div className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-75 ease-linear pointer-events-none" style={{ width: `${progress}%` }} />
                    )}
                </div>
                
                <div className={`relative z-20 skew-x-[-10deg] ${config.padding} flex items-center justify-center h-full pointer-events-none`}>
                    <div className={`w-full h-full flex items-center justify-center gap-1.5 transition-opacity ${isHolding ? 'opacity-40' : 'opacity-100'}`}>
                        {icon && (
                            <div className="shrink-0 flex items-center justify-center">
                                {icon}
                            </div>
                        )}
                        
                        {typeof children === 'string' || typeof children === 'number' ? (
                            <div className="flex-1 h-full min-w-0">
                                <GameText 
                                    text={children.toString()} 
                                    baseFontSize={config.fontSize} 
                                    skewFactor={0.88}
                                    className="text-white drop-shadow-md font-black italic uppercase tracking-tighter"
                                />
                            </div>
                        ) : (
                            <div className="font-black text-white italic tracking-tight uppercase drop-shadow-md flex items-center gap-1 h-full w-full" style={{ fontSize: `${config.fontSize}rem` }}>
                                {children}
                            </div>
                        )}
                    </div>
                </div>
            </button>
        </div>
    );
};
