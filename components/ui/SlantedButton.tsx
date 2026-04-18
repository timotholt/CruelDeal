import { createSignal, onCleanup, JSX, children as solidChildren } from 'solid-js';
import { GameText } from './GameText';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'blue' | 'black' | 'glass' | 'ghost';

interface SlantedButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    fullWidth?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    icon?: JSX.Element;
    holdDuration?: number; 
    onHoldChange?: (isHolding: boolean) => void;
    onHoldComplete?: (e: PointerEvent) => void;
    onProgressChange?: (progress: number) => void;
    children?: JSX.Element;
    class?: string;
}

export const SlantedButton = (props: SlantedButtonProps) => {
    const [progress, setProgress] = createSignal(0);
    const [isHolding, setIsHolding] = createSignal(false);
    let timerId: number | null = null;
    let startTime = 0;
    let hasTriggeredHold = false;

    const variant = () => props.variant ?? 'primary';
    const fullWidth = () => props.fullWidth ?? false;
    const size = () => props.size ?? 'md';
    const holdDuration = () => props.holdDuration ?? 0;

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

    const sizeConfigs = {
        xs: { height: "h-[1.65rem]", fontSize: 0.8, padding: "0.25rem" },
        sm: { height: "h-7", fontSize: 0.95, padding: "0.5rem" },
        md: { height: "h-10", fontSize: 1.1, padding: "0.75rem" },
        lg: { height: "h-16", fontSize: 1.4, padding: "1rem" }
    };

    const config = () => sizeConfigs[size()];

    const startHold = (e: PointerEvent) => {
        const dur = holdDuration();
        if (!dur || props.disabled) return;
        const onHoldChange = props.onHoldChange;
        const onProgressChange = props.onProgressChange;
        const onHoldComplete = props.onHoldComplete;
        const onClick = props.onClick;

        setIsHolding(true);
        onHoldChange?.(true);
        hasTriggeredHold = false;
        startTime = Date.now();
        
        timerId = window.setInterval(() => {
            const elapsed = Date.now() - startTime;
            const p = Math.min((elapsed / dur) * 100, 100);
            setProgress(p);
            onProgressChange?.(p);
            
            if (p >= 100 && !hasTriggeredHold) {
                hasTriggeredHold = true;
                if (timerId !== null) clearInterval(timerId);
                timerId = null;
                
                if (onHoldComplete) {
                    onHoldComplete(e);
                } else if (onClick) {
                    (onClick as any)(e);
                }
                
                setIsHolding(false);
                onHoldChange?.(false);
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
        // If a hold duration is set, we ignore standard clicks.
        // The action is triggered exclusively by the hold-completion logic inside startHold.
        if (holdDuration() > 0) {
            return;
        }
        props.onClick?.(e as any);
    };

    onCleanup(() => { if (timerId !== null) clearInterval(timerId); });

    const hasExplicitWidth = () => props.class?.includes('w-') || props.class?.includes('max-w-');
    const widthClass = () => fullWidth() ? 'w-full' : (hasExplicitWidth() ? '' : 'w-max');

    const hasChildren = () => props.children !== undefined;
    const containerJustify = () => (props.icon && hasChildren()) ? 'justify-start' : 'justify-center';
    const textJustify = 'justify-center';

    const resolvedChildren = solidChildren(() => props.children);
    const getChildrenValue = () => {
        const val = resolvedChildren();
        if (Array.isArray(val)) return val[0];
        return val;
    };
    const isTextLikeChildren = () => {
        const val = getChildrenValue();
        return typeof val === 'string' || typeof val === 'number';
    };

    return (
        <div class={`relative group ${widthClass()} ${config().height} min-w-0 ${props.disabled ? 'opacity-50 pointer-events-none' : ''} ${props.class ?? ''}`}>
            <button 
                class={`w-full h-full relative z-10 outline-none`}
                onPointerDown={(e) => holdDuration() ? startHold(e) : undefined}
                onPointerUp={(_e) => holdDuration() ? cancelHold() : undefined}
                onPointerLeave={(_e) => holdDuration() ? cancelHold() : undefined}
                onClick={handleButtonClick}
                role="button"
                disabled={props.disabled}
            >
                {/* SLANTED BACKGROUND */}
                <div class={`absolute inset-0 border rounded skew-x-[-9deg] overflow-hidden ${variants[variant()]}`}>
                    {holdDuration() > 0 && (
                        <div class={`absolute inset-y-0 left-0 bg-white/30 transition-all duration-75 ease-linear pointer-events-none`} style={{ width: `${progress()}%` }} />
                    )}
                </div>
                
                {/* SLANTED CONTENT WRAPPER */}
                <div 
                    class={`relative z-20 h-full w-full pointer-events-none flex items-center ${containerJustify()} skew-x-[-9deg] min-w-0`}
                    style={{ "padding-left": config().padding, "padding-right": config().padding }}
                >
                    <div class={`flex items-center ${containerJustify()} gap-0 w-full h-full min-w-0 ${isHolding() ? 'opacity-40' : 'opacity-100'}`}>
                        {props.icon && (
                            <div 
                                class={`shrink-0 flex items-center justify-center drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]`}
                                style={{ "padding-right": hasChildren() ? '0.125rem' : '0' }}
                            >
                                {props.icon}
                            </div>
                        )}
                        
                        {hasChildren() && (
                            <div class={`flex-1 h-full min-w-0 flex items-center ${textJustify}`}>
                                {isTextLikeChildren() ? (
                                    <GameText 
                                        text={getChildrenValue()?.toString() ?? ""} 
                                        baseFontSize={config().fontSize} 
                                        skewFactor={0.9} 
                                        maxScale={1.5}
                                        class="text-white font-black italic tracking-tighter uppercase drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]"
                                    />
                                ) : (
                                    <div class={`flex items-center ${textJustify} drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] w-full h-full min-w-0`}>
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