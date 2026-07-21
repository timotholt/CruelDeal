
import { CardDefinition, SeasonPassData, SeasonPassReward, SeasonRewardType } from '../../types';
import { SEASONS } from './mockData';
import { seasonStore, getPersistedProfile } from './mockDb';
import { CARDS } from '../../constants';

/**
 * SEASON SERVICE
 * Handles dynamic generation of the Season Pass reward track and seasonal metadata.
 */
export const seasonService = {
    async getSeasonPass(userId: string): Promise<SeasonPassData> {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const user = getPersistedProfile();
        const season = SEASONS[seasonStore.currentSeasonIndex];
        const userProgress = (user && user.id === userId) 
            ? (user.seasonProgress[season.id] || { level: 1, xp: 0 })
            : { level: 1, xp: 0 };
        
        const rewards: SeasonPassReward[] = Array.from({ length: 100 }, (_, i) => {
            const level = i + 1;
            let type: SeasonRewardType;
            let amount: string | number;
            let specificCardDef: CardDefinition | undefined;
            
            if (level === 50) { 
                type = 'card'; amount = 'SEASON EXCLUSIVE'; 
                specificCardDef = CARDS.find(c => c.id === season.heroCardId)!; 
            } 
            else if (level % 10 === 0) { 
                type = 'card'; amount = 'VARIANT'; 
                specificCardDef = CARDS[Math.floor((level / 10) % CARDS.length)]; 
            } 
            else if (level % 5 === 0) { type = 'gold'; amount = 100; } 
            else if (level % 2 === 0) { type = 'booster'; amount = 10; } 
            else { type = 'credits'; amount = 50 + (Math.floor(level / 10) * 10); }

            return { 
                level, type, amount, cardDef: specificCardDef, 
                isClaimed: level < userProgress.level, 
                isActive: level === userProgress.level, 
                isLocked: level > userProgress.level 
            };
        });

        return { 
            id: season.id, 
            themeName: season.name, 
            startDate: "2025-01-01T00:00:00Z", 
            endDate: "2025-12-31T23:59:59Z", 
            endsInSeconds: 86400, 
            premiumActive: true, 
            heroCardId: season.heroCardId, 
            heroVariantName: season.heroVariant, 
            rewards 
        };
    },

    async debugNextSeason(): Promise<void> {
        seasonStore.currentSeasonIndex = (seasonStore.currentSeasonIndex + 1) % SEASONS.length;
        await new Promise(resolve => setTimeout(resolve, 200));
    }
};
