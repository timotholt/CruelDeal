
import React from 'react';
import { DynamicBackground } from './DynamicBackground';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="h-full w-full max-w-[23rem] mx-auto flex flex-col text-white font-sans relative shadow-2xl overflow-hidden select-none bg-black">
      
      <DynamicBackground opacity={0.8} />
      
      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  );
};
