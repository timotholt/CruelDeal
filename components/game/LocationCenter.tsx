import { LocationDefinition } from '../../types';
import { LocationCard } from '../LocationCard';

interface LocationCenterProps {
    locationDef: LocationDefinition;
    playerPower: number;
    opponentPower: number;
    winningPlayer: 'p1' | 'p2' | 'tie';
    onInspect: () => void;
}

export const LocationCenter = (props: LocationCenterProps) => {
    
    // Determine colors based on win state
    const p1Color = () => props.winningPlayer === 'p1' ? 'bg-green-900 border-green-500' : 'bg-slate-800 border-slate-600';
    const p2Color = () => props.winningPlayer === 'p2' ? 'bg-green-900 border-green-500' : 'bg-slate-800 border-slate-600';
    
    // If losing, show red
    const p1Final = () => props.winningPlayer === 'p2' ? 'bg-red-900 border-red-500' : p1Color();
    const p2Final = () => props.winningPlayer === 'p1' ? 'bg-red-900 border-red-500' : p2Color();

    return (
        <div class="w-full px-1 z-10 flex-none flex items-center justify-center relative my-3">
             {/* Opponent Power Bubble (Top) */}
             <div class={`absolute -top-3 left-1/2 -translate-x-1/2 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center font-bold border-2 z-30 shadow-lg transition-colors duration-500 ${p2Final()}`}>
                {props.opponentPower}
             </div>
    
             {/* The Card */}
             <LocationCard 
                location={props.locationDef} 
                size="sm" 
                onClick={props.onInspect}
             />
    
             {/* Player Power Bubble (Bottom) */}
             <div class={`absolute -bottom-3 left-1/2 -translate-x-1/2 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center font-bold border-2 z-30 shadow-lg transition-colors duration-500 ${p1Final()}`}>
                {props.playerPower}
             </div>
        </div>
    );
};
