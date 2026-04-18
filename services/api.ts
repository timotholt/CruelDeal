
import { PurchaseResponse, ProgressionRewardType } from '../types';
import { PendingMove } from './planning';
import { sanitizeLog, safeExecute } from './api/apiUtils';

// Specialized Domain Services
import { profileService } from './api/profileService';
import { storeService } from './api/storeService';
import { seasonService } from './api/seasonService';
import { progressionService } from './api/progressionService';
import { cmsService } from './api/cmsService';
import { matchService } from './api/matchService';
import { statsService } from './api/statsService';
import { rankingService } from './api/rankingService';
import { archiveService } from './api/archiveService';

const sanitizePurchaseResponse = (res: PurchaseResponse): PurchaseResponse => {
    if (res.activityLog) {
        return { ...res, activityLog: sanitizeLog(res.activityLog as any) };
    }
    return res;
};

/**
 * GALACTIC SNAP API GATEWAY (Elite Tier)
 */
export const api = {
    profile: {
        get: (userId: string) => 
            safeExecute(() => profileService.getProfile(userId)),
        updateDeck: (userId: string, deckId: number) => 
            safeExecute(() => profileService.updateActiveDeck(userId, deckId)),
        upgradeCard: (userId: string, cardId: string) =>
            safeExecute(async () => {
                const raw = await profileService.upgradeCard(userId, cardId);
                return sanitizePurchaseResponse(raw);
            }),
        addLevels: (userId: string, increment: number) => 
            safeExecute(() => profileService.addCollectionLevels(userId, increment)),
        saveDeck: (userId: string, deckId: number, cardIds: string[]) =>
            safeExecute(() => profileService.saveDeck(userId, deckId, cardIds)),
        renameDeck: (userId: string, deckId: number, name: string) =>
            safeExecute(() => profileService.renameDeck(userId, deckId, name)),
    },

    match: {
        // Now fully authoritative
        start: (userId: string) => 
            safeExecute(() => matchService.startMatch(userId)),
        submit: (userId: string, playerMoves: PendingMove[]) => 
            safeExecute(() => matchService.submitTurn(userId, playerMoves)),
    },

    cms: {
        inbox: (userId: string, locale?: string) => 
            safeExecute(() => cmsService.getInbox(userId, locale)),
        news: (locale?: string) => 
            safeExecute(() => cmsService.getNews(locale)),
        menu: (locale?: string) => 
            safeExecute(() => cmsService.getMainMenuContent(locale)),
        premium: (locale?: string) => 
            safeExecute(() => cmsService.getPremiumModalContent(locale)),
    },

    stats: {
        history: (userId: string) => 
            safeExecute(() => statsService.getBattleHistory(userId)),
        account: (userId: string) => 
            safeExecute(() => statsService.getAccountStats(userId)),
    },

    ranking: {
        leaderboard: () => 
            safeExecute(() => rankingService.getLeaderboard()),
        personal: (userId: string) => 
            safeExecute(() => rankingService.getPersonalLadderStats(userId)),
    },

    archive: {
        comics: () => 
            safeExecute(() => archiveService.getComicArchive()),
        inventory: (userId: string) => 
            safeExecute(() => archiveService.getInventoryStash(userId)),
    },

    store: {
        offers: {
            list: (userId: string) => 
                safeExecute(() => storeService.getOffers(userId)),
            purchase: (userId: string, offerId: string, txnId: string) => 
                safeExecute(async () => {
                    const raw = await storeService.purchaseOffer(userId, offerId, txnId);
                    return sanitizePurchaseResponse(raw);
                })
        }
    },

    season: {
        get: (userId: string) => 
            safeExecute(() => seasonService.getSeasonPass(userId)),
        debugNext: () => 
            safeExecute(() => seasonService.debugNextSeason()),
    },

    progression: {
        get: (userId: string) => 
            safeExecute(() => progressionService.getProgression(userId)),
        logs: () => 
            safeExecute(async () => {
                const logs = await progressionService.getActivityLog();
                return sanitizeLog(logs as any);
            }),
        claim: (userId: string, type: ProgressionRewardType, isBulk: boolean = false) => 
            safeExecute(async () => {
                const res = isBulk 
                    ? await progressionService.claimAllRewards(userId, type)
                    : await progressionService.claimReward(userId, type);
                return sanitizePurchaseResponse(res as any);
            })
    },
};
