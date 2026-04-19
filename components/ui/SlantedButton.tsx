import { createSignal, onCleanup, JSX, children as solidChildren } from 'solid-js';
import { GameText } from './GameText';

// Constants for consistent HUD styling
const SKEW_CLASS = 'skew-x-[-9deg]';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'blue' | 'black' | 'glass' | 'ghost';

interface SlantedButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    fullWidth?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    icon?: JSX.Element;
    padding?: string;
    holdDuration?: number; 
    onHoldChange?: (isHolding: boolean) => void;
    onHoldComplete?: (e: PointerEvent) => void;
    onProgressChange?: (progress: number) => void;
    children?: JSX.Element;
    class?: string;
}

/**
 * SlantedButton: A stylized HUD button with optional hold-to-press functionality.
 */
export const SlantedButton = (props: SlantedButtonProps) => {
    // --- STATE ---
    const [progress, setProgress] = createSignal(0);
    const [isHolding, setIsHolding] = createSignal(false);
    let timerId: number | null = null;
    let startTime = 0;
    let hasTriggeredHold = false;

    // --- DERIVED CONFIG ---
    const variant = () => props.variant ?? 'primary';
    const size = () => props.size ?? 'md';
    const holdDuration = () => props.holdDuration ?? 0;

    const variants: Record<ButtonVariant, string> = {
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

    const sizeConfigs = {
        xs: { height: "h-[1.65rem]", fontSize: 0.8, padding: "0.25rem" },
        sm: { height: "h-7", fontSize: 0.95, padding: "0.5rem" },
        md: { height: "h-10", fontSize: 1.1, padding: "0.5rem" },
        lg: { height: "h-16", fontSize: 1.4, padding: "1rem" }
    };

    const config = () => sizeConfigs[size()];

    // --- HOLD HANDLERS ---
    const startHold = (e: PointerEvent) => {
        const dur = holdDuration();
        if (!dur || props.disabled) return;

        setIsHolding(true);
        props.onHoldChange?.(true);
        hasTriggeredHold = false;
        startTime = Date.now();
        
        // eslint-disable-next-line solid/reactivity
        timerId = window.setInterval(() => {
            const elapsed = Date.now() - startTime;
            const p = Math.min((elapsed / dur) * 100, 100);
            setProgress(p);
            props.onProgressChange?.(p);
            
            if (p >= 100 && !hasTriggeredHold) {
                hasTriggeredHold = true;
                if (timerId !== null) clearInterval(timerId);
                timerId = null;
                
                if (props.onHoldComplete) props.onHoldComplete(e);
                else props.onClick?.(e as any);
                
                setIsHolding(false);
                props.onHoldChange?.(false);
                setProgress(0);
            }
        }, 16);
    };

    const cancelHold = () => {
        if (timerId !== null) { clearInterval(timerId); timerId = null; }
        setIsHolding(false);
        props.onHoldChange?.(false);
        setProgress(0);
        props.onProgressChange?.(0);
    };

    const handleButtonClick = (e: MouseEvent) => {
        if (holdDuration() > 0 && hasTriggeredHold) return;
        props.onClick?.(e as any);
    };

    onCleanup(() => { if (timerId !== null) clearInterval(timerId); });

    // --- CHILDREN ANALYSIS ---
    const resolvedChildren = solidChildren(() => props.children);
    const getChildrenValue = () => {
        const val = resolvedChildren();
        return Array.isArray(val) ? val[0] : val;
    };
    const isTextLike = () => {
        const val = getChildrenValue();
        return typeof val === 'string' || typeof val === 'number';
    };

    const widthClass = () => {
        if (props.fullWidth) return 'w-full';
        const hasCustomWidth = props.class?.includes('w-') || props.class?.includes('max-w-');
        return hasCustomWidth ? '' : 'w-max';
    };

    return (
        <div class={`relative group ${widthClass()} ${config().height} min-w-0 ${props.disabled ? 'opacity-50 pointer-events-none' : ''} ${props.class ?? ''}`}>
            <button 
                class="w-full h-full relative z-10 outline-none"
                onPointerDown={(e) => startHold(e)}
                onPointerUp={cancelHold}
                onPointerLeave={cancelHold}
                onClick={handleButtonClick}
                role="button"
                disabled={props.disabled}
            >
                {/* BACKGROUND LAYER */}
                <div class={`absolute inset-0 border rounded ${SKEW_CLASS} overflow-hidden ${variants[variant()]}`}>
                    {holdDuration() > 0 && (
                        <div 
                            class="absolute inset-y-0 left-0 bg-white/30 transition-all duration-75 ease-linear pointer-events-none" 
                            style={{ width: `${progress()}%` }} 
                        />
                    )}
                </div>
                
                {/* CONTENT LAYER */}
                <div 
                    class={`relative z-20 h-full w-full pointer-events-none flex items-center justify-center ${SKEW_CLASS} min-w-0`}
                    style={{ "padding-left": props.padding ?? config().padding, "padding-right": props.padding ?? config().padding }}
                >
                    <div class={`flex items-center justify-center gap-0 w-full h-full min-w-0 ${isHolding() ? 'opacity-40' : 'opacity-100'}`}>
                        {props.icon && (
                            <div 
                                class="shrink-0 flex items-center justify-center drop-shadow-[0_0.125rem_0.2rem_rgba(0,0,0,0.8)]"
                                style={{ "padding-right": getChildrenValue() ? '0.125rem' : '0' }}
                            >
                                {props.icon}
                            </div>
                        )}
                        
                        {getChildrenValue() && (
                            <div class="flex-1 h-full min-w-0 flex items-center justify-center">
                                {isTextLike() ? (
                                    <GameText 
                                        text={getChildrenValue()?.toString() ?? ""} 
                                        baseFontSize={config().fontSize} 
                                        skewFactor={0.9} 
                                        maxScale={1.5}
                                        class="text-white font-black italic tracking-tighter uppercase drop-shadow-[0_0.125rem_0.2rem_rgba(0,0,0,0.8)]"
                                    />
                                ) : (
                                    <div class="flex items-center justify-center drop-shadow-[0_0.125rem_0.2rem_rgba(0,0,0,0.8)] w-full h-full min-w-0">
                                        {getChildrenValue()}
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
