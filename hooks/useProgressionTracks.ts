
import { useMemo } from 'react';
import { ProgressionData, ProgressionTrack } from '../types';
import { REWARD_SEQUENCE } from '../services/api/mockData';

/**
 * useProgressionTracks
 * Calculates the visual state of all reward tracks based on the current 
 * animated "visual" level versus the actual "server" level.
 */
export const useProgressionTracks = (
    visualLevel: number, 
    actualLevel: number, 
    progressionData: ProgressionData | null
): ProgressionTrack[] => {
    return useMemo(() => {
        if (!progressionData) return [];

        return REWARD_SEQUENCE.map((config, i) => {
            // 1. Calculate how many points this specific track has visually
            const totalPointsVisual = visualLevel + config.offset;
            
            // 2. Calculate the "filled" amount of the bar (0 to capacity)
            const currentXP = totalPointsVisual % config.capacity;
            
            // 3. Calculate how many rewards are earned in total on the server
            const totalEarnedFinal = Math.floor((actualLevel + config.offset) / config.capacity);
            
            // 4. Calculate how many rewards are "visible" based on the ticking level
            const totalEarnedVisual = Math.floor(totalPointsVisual / config.capacity);
            
            // 5. The difference tells us how many rewards are "waiting in the wings" 
            // but not yet visible to the user because the counter hasn't reached them.
            const deltaNotYetEarned = totalEarnedFinal - totalEarnedVisual;
            
            // 6. Adjust the unclaimed count to match the visual progress
            const finalUnclaimed = progressionData.tracks[i]?.unclaimedCount || 0;
            const visualUnclaimedCount = Math.max(0, finalUnclaimed - deltaNotYetEarned);

            return {
                type: config.type,
                label: config.label,
                currentXP,
                targetXP: config.capacity,
                unclaimedCount: visualUnclaimedCount,
                nextRewardAmount: config.amount,
            };
        });
    }, [visualLevel, actualLevel, progressionData]);
};
