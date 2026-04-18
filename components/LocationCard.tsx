import { LocationDefinition } from '../types';

interface LocationCardProps {
  location: LocationDefinition;
  size?: 'sm' | 'lg';
  onClick?: () => void;
  class?: string;
}

export const LocationCard = (props: LocationCardProps) => {
  const isLarge = () => props.size === 'lg';
  
  // Enforce 7/5 aspect ratio for Locations (Landscape)
  const sizeClass = () => isLarge() 
    ? "w-80 aspect-[7/5] text-lg rounded-2xl border-4"
    : "w-full aspect-[7/5] text-[0.625rem] rounded-lg border-2";

  const cursorClass = () => props.onClick ? "cursor-pointer hover:brightness-110 active:scale-95" : "";
  
  return (
    <div 
        class={`relative overflow-hidden bg-slate-800 border-slate-500 shadow-xl select-none touch-none transition-transform ${sizeClass()} ${cursorClass()} ${props.class ?? ''}`} 
        onClick={() => props.onClick?.()}
    >
       {/* Background Image */}
       <img 
         src={props.location.imageUrl} 
         alt={props.location.name}
         class="absolute inset-0 w-full h-full object-cover opacity-80"
         referrerPolicy="no-referrer"
       />

       {/* Content Overlay */}
       <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 flex flex-col justify-between p-2">
          
          {/* Top: Name */}
          <div class="w-full flex items-start justify-center pt-1">
              <div class={`font-black text-center uppercase tracking-wider text-white drop-shadow-md ${isLarge() ? 'text-xl' : 'text-[0.5rem] leading-tight'}`}>
                  {props.location.name}
              </div>
          </div>

          {/* Bottom: Description */}
          <div class="w-full flex items-end justify-center pb-1">
              <div class={`text-center text-indigo-100 font-medium drop-shadow-md ${isLarge() ? 'text-sm px-4 mb-2' : 'text-[0.45rem] leading-tight line-clamp-2'}`}>
                  {props.location.description}
              </div>
          </div>

       </div>

       {/* Hex/Tech Overlay Pattern (Optional decoration) */}
       <div class="absolute inset-0 border-[1px] border-white/10 pointer-events-none rounded-lg" />
    </div>
  );
};
