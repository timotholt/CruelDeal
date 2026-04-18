import { createMemo } from 'solid-js';
import { ProgressionData, ProgressionTrack } from '../types';
import { REWARD_SEQUENCE } from '../services/api/mockData';

export const useProgressionTracks = (
    visualLevel: () => number, 
    actualLevel: () => number, 
    progressionData: () => ProgressionData | null
): () => ProgressionTrack[] => {
    const memo = createMemo(() => {
        const data = progressionData();
        if (!data) return [];

        const vLevel = visualLevel();
        const aLevel = actualLevel();

        return REWARD_SEQUENCE.map((config, i) => {
            const totalPointsVisual = vLevel + config.offset;
            const currentXP = totalPointsVisual % config.capacity;
            const totalEarnedFinal = Math.floor((aLevel + config.offset) / config.capacity);
            const totalEarnedVisual = Math.floor(totalPointsVisual / config.capacity);
            const deltaNotYetEarned = totalEarnedFinal - totalEarnedVisual;
            const finalUnclaimed = data.tracks[i]?.unclaimedCount || 0;
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
    });
    return memo;
};
