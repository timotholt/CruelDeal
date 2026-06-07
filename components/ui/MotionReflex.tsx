import { createSignal, onMount, onCleanup, mergeProps, JSX, Show } from 'solid-js';

// Global shared signals
export const [globalShiftX, setGlobalShiftX] = createSignal(0);
export const [globalShiftY, setGlobalShiftY] = createSignal(0);
export const [gyroActive, setGyroActive] = createSignal(false);
export const [sheenEnabled, setSheenEnabled] = createSignal(true);

let listenerCount = 0;

const handleGlobalMouseMove = (e: MouseEvent) => {
  if (!sheenEnabled()) {
    if (globalShiftX() !== 0 || globalShiftY() !== 0) {
      setGlobalShiftX(0);
      setGlobalShiftY(0);
      updateRootVars(0, 0);
    }
    return;
  }
  const dx = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
  const dy = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
  const shiftX = dx * 45;
  const shiftY = dy * 45;
  setGlobalShiftX(shiftX);
  setGlobalShiftY(shiftY);
  updateRootVars(shiftX, shiftY);
};

const handleGlobalDeviceOrientation = (e: DeviceOrientationEvent) => {
  if (!sheenEnabled()) return;
  const gamma = e.gamma || 0; 
  const beta = e.beta || 0;    
  const dx = Math.max(-1, Math.min(1, gamma / 30));
  const dy = Math.max(-1, Math.min(1, (beta - 45) / 30));
  const shiftX = dx * 45;
  const shiftY = dy * 45;
  setGlobalShiftX(shiftX);
  setGlobalShiftY(shiftY);
  updateRootVars(shiftX, shiftY);
};

const updateRootVars = (x: number, y: number) => {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--sheen-x', x.toFixed(2));
    document.documentElement.style.setProperty('--sheen-y', y.toFixed(2));
  }
};

export const initGlobalListeners = () => {
  if (typeof window === 'undefined') return;
  listenerCount++;
  if (listenerCount === 1) {
    window.addEventListener('mousemove', handleGlobalMouseMove);
    if (
      // @ts-ignore
      typeof DeviceOrientationEvent !== 'undefined' &&
      // @ts-ignore
      typeof DeviceOrientationEvent.requestPermission !== 'function'
    ) {
      window.addEventListener('deviceorientation', handleGlobalDeviceOrientation);
      setGyroActive(true);
    }
  }
};

export const removeGlobalListeners = () => {
  if (typeof window === 'undefined') return;
  listenerCount--;
  if (listenerCount === 0) {
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('deviceorientation', handleGlobalDeviceOrientation);
  }
};

export const enableMobileGyroscope = async (): Promise<boolean> => {
  if (
    typeof window !== 'undefined' &&
    // @ts-ignore
    typeof DeviceOrientationEvent !== 'undefined' &&
    // @ts-ignore
    typeof DeviceOrientationEvent.requestPermission === 'function'
  ) {
    try {
      // @ts-ignore
      const state = await DeviceOrientationEvent.requestPermission();
      if (state === 'granted') {
        window.addEventListener('deviceorientation', handleGlobalDeviceOrientation);
        setGyroActive(true);
        return true;
      }
    } catch (e) {
      console.error('Failed to request orientation permissions:', e);
    }
  } else if (typeof window !== 'undefined') {
    window.addEventListener('deviceorientation', handleGlobalDeviceOrientation);
    setGyroActive(true);
    return true;
  }
  return false;
};

// Reusable Reflective Text Component
export interface ReflectiveTextProps {
  children: string;
  profile?: 'gold' | 'silver' | 'brass' | 'kan' | 'credit' | 'mark';
  type?: 'linear' | 'radial' | 'box';
  class?: string;
  style?: JSX.CSSProperties;
}

export const ReflectiveText = (rawProps: ReflectiveTextProps) => {
  const props = mergeProps({
    profile: 'gold' as const,
    type: 'linear' as const,
    class: '',
    style: {},
  }, rawProps);

  onMount(() => {
    initGlobalListeners();
  });

  onCleanup(() => {
    removeGlobalListeners();
  });

  return (
    <span 
      class={`sheen-text sheen-${props.type} metal-${props.profile} ${props.class}`}
      style={props.style}
    >
      {props.children}
    </span>
  );
};

// Reusable Embossed Reflective Text Component
export const EmbossedReflectiveText = (rawProps: ReflectiveTextProps) => {
  const props = mergeProps({
    profile: 'gold' as const,
    type: 'linear' as const,
    class: '',
    style: {},
  }, rawProps);

  onMount(() => {
    initGlobalListeners();
  });

  onCleanup(() => {
    removeGlobalListeners();
  });

  return (
    <span 
      class={`sheen-text sheen-${props.type} metal-${props.profile} embossed-text ${props.class}`}
      style={props.style}
    >
      {props.children}
    </span>
  );
};

// Reflective Progress Bar Component
export interface ReflectiveProgressBarProps {
  value: number; // 0 to 100
  profile?: 'gold' | 'silver' | 'brass' | 'kan' | 'credit' | 'mark';
  type?: 'linear' | 'radial' | 'box';
  class?: string;
}

export const ReflectiveProgressBar = (rawProps: ReflectiveProgressBarProps) => {
  const props = mergeProps({
    profile: 'gold' as const,
    type: 'linear' as const,
    class: '',
  }, rawProps);

  onMount(() => {
    initGlobalListeners();
  });

  onCleanup(() => {
    removeGlobalListeners();
  });

  return (
    <div class={`w-full h-4 bg-black/50 rounded-full border border-white/10 overflow-hidden relative shadow-inner ${props.class}`}>
      {/* Dynamic Sheen Bar fill */}
      <div 
        class={`h-full sheen-text sheen-${props.type} metal-${props.profile} rounded-full transition-all duration-300 relative`}
        style={{
          width: `${Math.max(0, Math.min(100, props.value))}%`,
          "background-clip": "initial",
          "-webkit-background-clip": "initial",
          "color": "transparent",
          "-webkit-text-fill-color": "initial",
          "background-size": props.type === 'box' ? "contain, 200% 200%" : "200% 200%",
        }}
      >
        {/* Volumetric glossy finish overlay */}
        <div class="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/35 rounded-full pointer-events-none" />
      </div>
    </div>
  );
};

// Premium Reflective Button Component
export interface ReflectiveButtonProps {
  onClick?: () => void;
  children: any;
  profile?: 'gold' | 'silver' | 'brass' | 'kan' | 'credit' | 'mark';
  type?: 'linear' | 'radial' | 'box';
  class?: string;
  disabled?: boolean;
}

export const ReflectiveButton = (rawProps: ReflectiveButtonProps) => {
  const props = mergeProps({
    profile: 'gold' as const,
    type: 'linear' as const,
    class: '',
    disabled: false,
  }, rawProps);

  onMount(() => {
    initGlobalListeners();
  });

  onCleanup(() => {
    removeGlobalListeners();
  });

  return (
    <button
      onClick={() => !props.disabled && props.onClick?.()}
      disabled={props.disabled}
      class={`
        relative px-6 py-2.5 font-bold uppercase tracking-wider text-black rounded
        transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.97]
        shadow-[0_4px_14px_0_rgba(251,191,36,0.3)] hover:shadow-[0_6px_20px_0_rgba(251,191,36,0.45)]
        border border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400
        ${props.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
        ${props.class}
      `}
      style={{
        background: 'none',
        "box-shadow": props.profile === 'gold' || props.profile === 'kan' || props.profile === 'brass' 
          ? '0 4px 14px 0 rgba(251, 191, 36, 0.3)' 
          : props.profile === 'silver' 
            ? '0 4px 14px 0 rgba(148, 163, 184, 0.3)'
            : '0 4px 14px 0 rgba(59, 130, 246, 0.3)',
      }}
    >
      {/* Background with Sheen */}
      <div 
        class={`absolute inset-0 sheen-text sheen-${props.type} metal-${props.profile} rounded`}
        style={{
          "background-clip": "initial",
          "-webkit-background-clip": "initial",
          "color": "transparent",
          "-webkit-text-fill-color": "initial",
          "background-size": props.type === 'box' ? "contain, 200% 200%" : "200% 200%",
        }}
      />

      {/* Volumetric light shade */}
      <div class="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/40 rounded pointer-events-none" />

      {/* Chiseled inner border highlight */}
      <div class="absolute inset-[1px] border border-white/20 rounded pointer-events-none" />

      {/* Content */}
      <span class="relative z-10 text-shadow-sm font-extrabold text-[#111]">{props.children}</span>
    </button>
  );
};
