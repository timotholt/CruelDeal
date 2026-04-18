import { ProgressionRewardType, ProgressionTrack, ProgressionData } from '../../types';
import { REWARD_SEQUENCE } from '../../services/api/mockData';

// Ensure this matches the HexBadge type definition
type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'blue';

export const getScale = (type: string) => {
    if (type === 'tokens') return 'scale-[0.85]';   
    if (type === 'gold') return 'scale-[1.1]';     
    if (type === 'credits') return 'scale-[1.1]';  
    if (type === 'booster') return 'scale-[1.3]';    
    if (type === 'box') return 'scale-[1.3]';        
    return 'scale-[1.3]';
};

// Fixed: Explicit return type to avoid 'string' mismatch in HexBadge
export const getVariant = (type: ProgressionRewardType): BadgeVariant => {
    switch(type) {
        case 'booster': return 'success';
        case 'credits': return 'blue';
        case 'gold': return 'warning';
        case 'tokens': return 'danger';
        case 'box': return 'primary';
        default: return 'secondary';
    }
};

export const getPulseColor = (type: ProgressionRewardType) => {
    switch(type) {
        case 'booster': return 'border-emerald-400';
        case 'credits': return 'border-blue-400';
        case 'gold': return 'border-amber-400';
        case 'tokens': return 'border-red-400';
        case 'box': return 'border-indigo-400';
        default: return 'border-white';
    }
};

export const getCheckmarkColor = (type: ProgressionRewardType) => {
    switch(type) {
        case 'booster': return 'text-emerald-400';
        case 'credits': return 'text-blue-400';
        case 'gold': return 'text-yellow-400'; 
        case 'tokens': return 'text-red-400';
        case 'box': return 'text-indigo-400';
        default: return 'text-white';
    }
};

export const getFlareColor = (type: ProgressionRewardType) => {
    switch(type) {
        case 'booster': return '#34d399'; // Emerald
        case 'credits': return '#60a5fa'; // Blue
        case 'gold': return '#fbbf24';    // Amber/Gold
        case 'tokens': return '#f87171';   // Red
        case 'box': return '#818cf8';      // Indigo
        default: return '#ffffff';
    }
};

export const getSpinnerColor = (type: ProgressionRewardType) => {
    switch(type) {
        case 'booster': return 'border-t-emerald-400';
        case 'credits': return 'border-t-blue-400';
        case 'gold': return 'border-t-amber-400';
        case 'tokens': return 'border-t-red-400';
        case 'box': return 'border-t-indigo-400';
        default: return 'border-t-white';
    }
};

export const getColors = (type: ProgressionRewardType) => {
    switch(type) {
        case 'booster': return { color: 'from-emerald-600 to-emerald-400', bgTrack: 'bg-[#064e3b]', borderColor: 'border-emerald-400/50' };
        case 'credits': return { color: 'from-blue-600 to-blue-400', bgTrack: 'bg-[#1e3a8a]', borderColor: 'border-blue-400/50' };
        case 'gold': return { color: 'from-amber-600 to-amber-400', bgTrack: 'bg-[#78350f]', borderColor: 'border-amber-400/50' };
        case 'tokens': return { color: 'from-red-600 to-red-400', bgTrack: 'bg-[#450a0a]', borderColor: 'border-red-400/50' };
        case 'box': return { color: 'from-indigo-600 to-indigo-400', bgTrack: 'bg-[#1e1b4b]', borderColor: 'border-indigo-400/50' };
        default: return { color: 'from-slate-600 to-white', bgTrack: 'bg-[#334155]', borderColor: 'border-white/50' };
    }
};

/**
 * Calculates visual progression tracks based on the current animated level.
 * Ensures rewards "appear" exactly as the level ticks past their threshold.
 */
export const projectVisualTracks = (
    visualLevel: number, 
    actualLevel: number, 
    progressionData: ProgressionData | null
): ProgressionTrack[] => {
    if (!progressionData) return [];
    
    return REWARD_SEQUENCE.map((config, i) => {
        const totalPointsVisual = visualLevel + config.offset;
        const currentXP = totalPointsVisual % config.capacity;
        
        // Unclaimed logic projection
        const totalEarnedFinal = Math.floor((actualLevel + config.offset) / config.capacity);
        const totalEarnedVisual = Math.floor(totalPointsVisual / config.capacity);
        const finalUnclaimed = progressionData.tracks[i]?.unclaimedCount || 0;
        const visualUnclaimed = Math.max(0, finalUnclaimed - (totalEarnedFinal - totalEarnedVisual));
        
        return {
            type: config.type,
            label: config.label,
            currentXP,
            targetXP: config.capacity,
            unclaimedCount: visualUnclaimed,
            nextRewardAmount: config.amount,
        };
    });
};