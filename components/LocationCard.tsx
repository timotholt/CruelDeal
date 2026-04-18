
import React from 'react';
import { LocationDefinition } from '../types';

interface LocationCardProps {
  location: LocationDefinition;
  size?: 'sm' | 'lg';
  onClick?: () => void;
  className?: string;
}

export const LocationCard: React.FC<LocationCardProps> = ({ location, size = 'sm', onClick, className = '' }) => {
  const isLarge = size === 'lg';
  
  // Enforce 7/5 aspect ratio for Locations (Landscape)
  const sizeClass = isLarge 
    ? "w-80 aspect-[7/5] text-lg rounded-2xl border-4"
    : "w-full aspect-[7/5] text-[0.625rem] rounded-lg border-2";

  const cursorClass = onClick ? "cursor-pointer hover:brightness-110 active:scale-95" : "";
  
  return (
    <div 
        className={`relative overflow-hidden bg-slate-800 border-slate-500 shadow-xl select-none touch-none transition-transform ${sizeClass} ${cursorClass} ${className}`} 
        onClick={onClick}
    >
       {/* Background Image */}
       <img 
         src={location.imageUrl} 
         alt={location.name}
         className="absolute inset-0 w-full h-full object-cover opacity-80"
       />

       {/* Content Overlay */}
       <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 flex flex-col justify-between p-2">
          
          {/* Top: Name */}
          <div className="w-full flex items-start justify-center pt-1">
              <div className={`font-black text-center uppercase tracking-wider text-white drop-shadow-md ${isLarge ? 'text-xl' : 'text-[0.5rem] leading-tight'}`}>
                  {location.name}
              </div>
          </div>

          {/* Bottom: Description */}
          <div className="w-full flex items-end justify-center pb-1">
              <div className={`text-center text-indigo-100 font-medium drop-shadow-md ${isLarge ? 'text-sm px-4 mb-2' : 'text-[0.45rem] leading-tight line-clamp-2'}`}>
                  {location.description}
              </div>
          </div>

       </div>

       {/* Hex/Tech Overlay Pattern (Optional decoration) */}
       <div className="absolute inset-0 border-[1px] border-white/10 pointer-events-none rounded-lg"></div>
    </div>
  );
};
