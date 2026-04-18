
import { ProgressionData, ActivityLogEntry, ProgressionRewardType } from '../../types';
import { REWARD_SEQUENCE } from './mockData';
import { ITEM_SOURCES } from '../../config/sources';
import { progressionStore, getPersistedProfile, persistUserProfile } from './mockDb';
import { getProgressionDataInternal } from './progressionLogic';
import { generateInstanceId } from '../../utils/id';
import { simulateNetwork, verifySession, ApiError, lockedMutation } from './apiUtils';

const LOG_LIMIT = 500;

const formatDate = (now: Date) => {
    const day = now.getDate();
    const month = now.toLocaleString('default', { month: 'short' }).toUpperCase();
    const year = now.getFullYear().toString().slice(-2);
    return `${day} ${month} ${year}`;
};

export const progressionService = {
    async getProgression(userId: string): Promise<ProgressionData> {
        verifySession(userId);
        await simulateNetwork(200, 400);
        const user = getPersistedProfile();
        return getProgressionDataInternal(user);
    },

    async getActivityLog(): Promise<ActivityLogEntry[]> {
        await simulateNetwork(100, 200);
        return progressionStore.activityLog;
    },

    /**
     * AUTHORITATIVE CLAIM
     */
    async claimReward(userId: string, type: ProgressionRewardType) {
        return lockedMutation(async () => {
            verifySession(userId);
            await simulateNetwork(400, 600);
            
            const user = getPersistedProfile();
            if (!user || user.id !== userId) throw new ApiError('ERR_UNAUTHORIZED', 'Neural sync failed.');

            const currentData = getProgressionDataInternal(user);
            const trackIdx = currentData.tracks.findIndex(t => t.type === type);
            
            if (trackIdx === -1 || currentData.tracks[trackIdx].unclaimedCount <= 0) {
                throw new ApiError('ERR_ILLEGAL_CLAIM', 'Target reward not available or already claimed.');
            }

            const rewardConfig = REWARD_SEQUENCE[trackIdx];
            const updatedProfile = { ...user };
            
            const newClaimed = [...progressionStore.claimedCounts];
            newClaimed[trackIdx]++;
            progressionStore.claimedCounts = newClaimed;
            
            const amountToGrant = Number(rewardConfig.amount);

            if (type === 'credits') updatedProfile.credits += amountToGrant;
            else if (type === 'gold') updatedProfile.gold += amountToGrant;
            else if (type === 'tokens') updatedProfile.tokens += amountToGrant;

            const now = new Date();
            const dateStr = formatDate(now);
            const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            const newLog: ActivityLogEntry = {
                id: generateInstanceId(),
                title: ITEM_SOURCES.COLLECTION_LEVEL_REWARD,
                type,
                date: dateStr,
                time: timeStr,
                delta: amountToGrant,
                isSpend: false,
                amountGained: amountToGrant,
                itemGained: type
            };
            
            progressionStore.activityLog = [newLog, ...progressionStore.activityLog].slice(0, LOG_LIMIT);
            persistUserProfile(updatedProfile);

            return { 
                success: true, 
                updatedProfile, 
                progressionData: getProgressionDataInternal(updatedProfile),
                activityLog: [...progressionStore.activityLog]
            };
        });
    },

    async claimAllRewards(userId: string, type: ProgressionRewardType) {
        return lockedMutation(async () => {
            verifySession(userId);
            await simulateNetwork(600, 900);
            
            const user = getPersistedProfile();
            if (!user || user.id !== userId) throw new ApiError('ERR_UNAUTHORIZED', 'Access denied.');

            const currentData = getProgressionDataInternal(user);
            const trackIdx = currentData.tracks.findIndex(t => t.type === type);
            
            if (trackIdx === -1 || currentData.tracks[trackIdx].unclaimedCount <= 0) {
                throw new ApiError('ERR_ILLEGAL_CLAIM', 'Nothing to claim in this sector.');
            }

            const count = currentData.tracks[trackIdx].unclaimedCount;
            const rewardConfig = REWARD_SEQUENCE[trackIdx];
            const updatedProfile = { ...user };
            
            const newClaimed = [...progressionStore.claimedCounts];
            newClaimed[trackIdx] += count;
            progressionStore.claimedCounts = newClaimed;
            
            const totalAmount = (rewardConfig.amount as number) * count;
            if (type === 'credits') updatedProfile.credits += totalAmount;
            else if (type === 'gold') updatedProfile.gold += totalAmount;
            else if (type === 'tokens') updatedProfile.tokens += totalAmount;

            const now = new Date();
            const dateStr = formatDate(now);
            const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

            const newLog: ActivityLogEntry = {
                id: generateInstanceId(),
                title: ITEM_SOURCES.COLLECTION_LEVEL_REWARD,
                type,
                date: dateStr,
                time: timeStr,
                delta: totalAmount,
                isSpend: false,
                isBulk: true,
                amountGained: totalAmount,
                itemGained: type
            };
            
            progressionStore.activityLog = [newLog, ...progressionStore.activityLog].slice(0, LOG_LIMIT);
            persistUserProfile(updatedProfile);

            return { 
                success: true, 
                updatedProfile, 
                progressionData: getProgressionDataInternal(updatedProfile),
                activityLog: [...progressionStore.activityLog]
            };
        });
    }
};
