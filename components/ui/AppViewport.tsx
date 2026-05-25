import { createContext, createEffect, createSignal, JSX, onCleanup, useContext } from 'solid-js';

type RailSide = 'left' | 'right';

interface AppViewportContextValue {
  setLeftRail: (content: JSX.Element | null) => void;
  setRightRail: (content: JSX.Element | null) => void;
  clearRails: () => void;
}

interface AppViewportProps {
  children: JSX.Element;
  leftRail?: JSX.Element;
  rightRail?: JSX.Element;
  class?: string;
}

interface ViewportRailPortalProps {
  side: RailSide;
  children: JSX.Element;
}

const AppViewportContext = createContext<AppViewportContextValue>();

export const useAppViewport = () => {
  const context = useContext(AppViewportContext);
  if (!context) {
    throw new Error('useAppViewport must be used inside AppViewport');
  }
  return context;
};

export const ViewportRailPortal = (props: ViewportRailPortalProps) => {
  const viewport = useAppViewport();
  const setter = () => props.side === 'left' ? viewport.setLeftRail : viewport.setRightRail;

  createEffect(() => {
    setter()(props.children);
  });
  onCleanup(() => setter()(null));

  return null;
};

export const AppViewport = (props: AppViewportProps) => {
  const [leftRail, setLeftRail] = createSignal<JSX.Element | null>(props.leftRail ?? null, { equals: false });
  const [rightRail, setRightRail] = createSignal<JSX.Element | null>(props.rightRail ?? null, { equals: false });

  const context: AppViewportContextValue = {
    setLeftRail,
    setRightRail,
    clearRails: () => {
      setLeftRail(null);
      setRightRail(null);
    },
  };

  return (
    <AppViewportContext.Provider value={context}>
      <div class={`app-viewport ${props.class ?? ''}`}>
        <aside class="app-viewport__rail app-viewport__rail--left" aria-label="Left desktop rail">
          {leftRail()}
        </aside>

        <main class="app-viewport__frame" data-app-frame>
          {props.children}
        </main>

        <aside class="app-viewport__rail app-viewport__rail--right" aria-label="Right desktop rail">
          {rightRail()}
        </aside>
      </div>
    </AppViewportContext.Provider>
  );
};
