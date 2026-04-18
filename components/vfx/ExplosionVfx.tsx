
import React from 'react';

export const ExplosionVfx: React.FC = () => (
    <div className="relative w-20 h-20 flex items-center justify-center pointer-events-none">
         {/* Core Flash */}
         <div className="absolute w-full h-full bg-white rounded-full animate-[ping_0.3s_cubic-bezier(0,0,0.2,1)] opacity-80"></div>
         {/* Outer Ring */}
         <div className="absolute w-full h-full border-4 border-orange-500 rounded-full animate-[ping_0.5s_cubic-bezier(0,0,0.2,1)] opacity-60 delay-75"></div>
         {/* Particles (Simulated via radial gradients or simplified DOM) */}
         <div className="absolute w-1/2 h-1/2 bg-yellow-300 rounded-full animate-pulse"></div>
    </div>
);
