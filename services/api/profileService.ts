
import { UserProfile, CardRarity, ActivityLogEntry } from '../../types';
import { CARDS } from '../../constants';
import { simulateNetwork, verifySession, ApiError, lockedMutation } from './apiUtils';
import { getPersistedProfile, persistUserProfile, progressionStore } from './mockDb';
import { getProgressionDataInternal } from './progressionLogic';
import { generateInstanceId } from '../../utils/id';
import { getIdentityClaims } from './developerAccess';

const INITIAL_PROFILE: Omit<UserProfile, 'id'> = {
    email: '',
    isDeveloper: false,
    username: 'Commander',
    level: 0, 
    seasonProgress: { '2025_01': { level: 1, xp: 0 } },
    rank: 10, 
    credits: 500, gold: 0, tokens: 0,
    activeDeckId: 1,
    avatarId: 'avatar_01',
    purchasedOfferIds: [],
    lastClaimedDates: {},
    collection: [...CARDS.map(c => c.id).slice(0, 10)], 
    decks: {
        1: [...CARDS.map(c => c.id).slice(0, 10)], 
        2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: []
    },
    deckNames: {
        1: 'ASSAULT', 2: 'DECK 2', 3: 'DECK 3', 4: 'DECK 4', 5: 'DECK 5',
        6: 'DECK 6', 7: 'DECK 7', 8: 'DECK 8', 9: 'DECK 9', 10: 'DECK 10'
    },
    deckStats: {
        1: { conquestWinRate: 0, ladderWinRate: 0, conquestWins: 0, conquestTotal: 0, ladderWins: 0, ladderLosses: 0, lastModified: new Date().toISOString() },
    },
    cardRarities: {},
};

const RARITY_PATH: CardRarity[] = ["Common", "Rare", "Epic", "Legendary"];
const UPGRADE_COSTS: Record<string, number> = { "Rare": 100, "Epic": 400, "Legendary": 1000 };

export const profileService = {
    async getProfile(userId: string): Promise<UserProfile> {
        verifySession(userId);
        await simulateNetwork(400, 700);
        const persisted = getPersistedProfile();
        
        const identity = getIdentityClaims(userId);
        const newProfileBase = {
            ...INITIAL_PROFILE,
            ...identity,
            id: userId,
        } satisfies UserProfile;

        if (persisted && persisted.id === userId) {
            // Migration: Ensure critical fields exist even if they are missing from persisted storage
            return {
                ...newProfileBase,
                ...persisted,
                id: userId, // Explicitly enforce the correct ID
                // Authentication claims always come from the fake server,
                // never browser-persisted profile data.
                email: identity.email,
                isDeveloper: identity.isDeveloper,
                credits: (typeof persisted.credits === 'number') ? persisted.credits : newProfileBase.credits,
                gold: (typeof persisted.gold === 'number') ? persisted.gold : newProfileBase.gold,
                tokens: (typeof persisted.tokens === 'number') ? persisted.tokens : newProfileBase.tokens,
                decks: persisted.decks || newProfileBase.decks,
                deckNames: persisted.deckNames || newProfileBase.deckNames,
                deckStats: persisted.deckStats || newProfileBase.deckStats,
                cardRarities: persisted.cardRarities || newProfileBase.cardRarities,
            };
        }
        
        persistUserProfile(newProfileBase);
        return newProfileBase;
    },

    async updateActiveDeck(userId: string, deckId: number): Promise<UserProfile> {
        return lockedMutation(async () => {
            verifySession(userId);
            await simulateNetwork(100, 200);
            const user = getPersistedProfile();
            if (!user || user.id !== userId) throw new ApiError('ERR_UNAUTHORIZED', 'Session desync.');
            
            const updated = { ...user, activeDeckId: deckId };
            persistUserProfile(updated);
            return updated;
        });
    },

    /**
     * AUTHORITATIVE CARD UPGRADE
     */
    async upgradeCard(userId: string, cardId: string): Promise<any> {
        return lockedMutation(async () => {
            verifySession(userId);
            await simulateNetwork(600, 900);
            
            const user = getPersistedProfile();
            if (!user || user.id !== userId) throw new ApiError('ERR_UNAUTHORIZED', 'Account lock failed.');

            const currentRarity = user.cardRarities[cardId] || "Common";
            const nextIdx = RARITY_PATH.indexOf(currentRarity) + 1;
            
            if (nextIdx >= RARITY_PATH.length) {
                throw new ApiError('ERR_MAX_LEVEL', 'Card has reached maximum evolution.');
            }

            const nextRarity = RARITY_PATH[nextIdx];
            const cost = UPGRADE_COSTS[nextRarity];

            if (user.credits < cost) {
                throw new ApiError('ERR_INSUFFICIENT_FUNDS', 'Insufficient Credits for neural upgrade.');
            }

            const updatedProfile = { ...user };
            updatedProfile.credits -= cost;
            updatedProfile.level += 1; 
            updatedProfile.cardRarities = { ...user.cardRarities, [cardId]: nextRarity };

            const now = new Date();
            const logEntry: ActivityLogEntry = {
                id: generateInstanceId(),
                title: `Upgrade: ${cardId}`,
                type: 'credits',
                date: `${now.getDate()} ${now.toLocaleString('en', {month:'short'}).toUpperCase()} ${now.getFullYear().toString().slice(-2)}`,
                time: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
                delta: cost,
                isSpend: true,
                currencyType: 'credits'
            };
            progressionStore.activityLog = [logEntry, ...progressionStore.activityLog].slice(0, 500);

            persistUserProfile(updatedProfile);

            return {
                success: true,
                updatedProfile,
                progressionData: getProgressionDataInternal(updatedProfile),
                activityLog: [...progressionStore.activityLog]
            };
        });
    },

    async addCollectionLevels(userId: string, increment: number): Promise<any> {
        return lockedMutation(async () => {
            verifySession(userId);
            await simulateNetwork(300, 600);
            const user = getPersistedProfile();
            if (!user || user.id !== userId) throw new ApiError('ERR_UNAUTHORIZED', 'Access denied.');
            
            const updated = { ...user, level: user.level + increment };
            persistUserProfile(updated);
            
            return {
                success: true,
                updatedProfile: updated,
                progressionData: getProgressionDataInternal(updated)
            };
        });
    },

    async saveDeck(userId: string, deckId: number, cardIds: string[]): Promise<UserProfile> {
        return lockedMutation(async () => {
            verifySession(userId);
            await simulateNetwork(200, 400);
            const user = getPersistedProfile();
            if (!user || user.id !== userId) throw new ApiError('ERR_UNAUTHORIZED', 'Sync error.');
            
            const updated = { 
                ...user, 
                decks: { ...user.decks, [deckId]: cardIds } 
            };
            persistUserProfile(updated);
            return updated;
        });
    },

    async renameDeck(userId: string, deckId: number, name: string): Promise<UserProfile> {
        return lockedMutation(async () => {
            verifySession(userId);
            await simulateNetwork(200, 400);
            const user = getPersistedProfile();
            if (!user || user.id !== userId) throw new ApiError('ERR_UNAUTHORIZED', 'Sync error.');
            
            const updated = { 
                ...user, 
                deckNames: { ...user.deckNames, [deckId]: name } 
            };
            persistUserProfile(updated);
            return updated;
        });
    }
};
