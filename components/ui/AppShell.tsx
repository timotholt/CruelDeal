import { DynamicBackground } from './DynamicBackground';

interface AppShellProps {
  children?: any;
}

export const AppShell = (props: AppShellProps) => {
  return (
    <div class="h-full w-full max-w-[23rem] mx-auto flex flex-col text-white font-sans relative shadow-2xl overflow-hidden select-none bg-black">
      
      <DynamicBackground opacity={0.8} />
      
      <div class="relative z-10 w-full h-full flex flex-col">
        {props.children}
      </div>
    </div>
  );
};
