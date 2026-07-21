
import { StoreData, PurchaseResponse, ActivityLogEntry, UserProfile } from '../../types';
import { MOCK_STORE_OFFERS } from './mockData';
import { ITEM_SOURCES } from '../../config/sources';
import { simulateNetwork, verifySession, ApiError, lockedMutation } from './apiUtils';
import { getPersistedProfile, persistUserProfile, progressionStore, transactionStore } from './mockDb';
import { generateInstanceId } from '../../utils/id';

const COOLDOWN_DURATION_MS = 60000;
const LOG_LIMIT = 500;

const formatDate = (now: Date) => {
    const day = now.getDate();
    const month = now.toLocaleString('default', { month: 'short' }).toUpperCase();
    const year = now.getFullYear().toString().slice(-2);
    return `${day} ${month} ${year}`;
};

export const storeService = {
    async getOffers(userId: string): Promise<StoreData> {
        verifySession(userId);
        await simulateNetwork(300, 500); 
        const user = getPersistedProfile();
        
        const offersWithCooldowns = MOCK_STORE_OFFERS.map(offer => {
            const lastClaimed = user?.lastClaimedDates[offer.id];
            if (lastClaimed) {
                const availableAt = new Date(lastClaimed).getTime();
                if (availableAt > Date.now()) {
                    return { ...offer, availableAt: new Date(availableAt).toISOString() };
                }
            }
            return { ...offer };
        }).filter(offer => {
            if (offer.isOneTime && user?.purchasedOfferIds.includes(offer.id)) return false;
            return true;
        });

        return { offers: [...offersWithCooldowns], lastUpdated: Date.now(), refreshHintSeconds: 60 };
    },

    /**
     * AUTHORITATIVE PURCHASE (Hardened)
     * Now uses a Global Mutation Lock to prevent concurrent spending race conditions.
     */
    async purchaseOffer(userId: string, offerId: string, transactionId: string): Promise<PurchaseResponse> {
        return lockedMutation(async () => {
            verifySession(userId);
            await simulateNetwork(800, 1200);
            
            // 1. IDEMPOTENCY CHECK
            if (transactionStore.isProcessed(transactionId)) {
                console.warn(`[SECURITY] Duplicate transaction detected: ${transactionId}. Skipping.`);
                return { success: true, transactionId, updatedProfile: getPersistedProfile() };
            }

            const user = getPersistedProfile();
            if (!user || user.id !== userId) throw new ApiError('ERR_UNAUTHORIZED', 'Account sync failure.');
            
            // 2. HARDENED OFFER LOOKUP
            const offer = MOCK_STORE_OFFERS.find(o => o.id === offerId);
            if (!offer) throw new ApiError('ERR_STALE_OFFER', 'Target bundle has expired.');
            
            // 3. AUTHORITATIVE COOLDOWN CHECK
            if (offer.priceType === 'free') {
                const nextAvailableAt = user.lastClaimedDates[offerId];
                if (nextAvailableAt && new Date(nextAvailableAt).getTime() > Date.now()) {
                    throw new ApiError('ERR_COOLDOWN_ACTIVE', 'Neural link charging. Please wait.');
                }
            }

            // 4. AUTHORITATIVE BALANCE CHECK (Locked context ensures this is absolute)
            if (offer.priceType === 'gold' && user.gold < (offer.priceAmount || 0)) {
                throw new ApiError('ERR_INSUFFICIENT_FUNDS', 'Insufficient Gold in sector.');
            }
            if (offer.priceType === 'tokens' && user.tokens < (offer.priceAmount || 0)) {
                throw new ApiError('ERR_INSUFFICIENT_FUNDS', 'Insufficient Tokens in sector.');
            }
            if (offer.priceType === 'credits' && user.credits < (offer.priceAmount || 0)) {
                throw new ApiError('ERR_INSUFFICIENT_FUNDS', 'Insufficient Credits in sector.');
            }

            // 5. ATOMIC UPDATE
            const updatedProfile: UserProfile = { ...user };
            const now = new Date();
            const dateStr = formatDate(now);
            const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
            const logSource = offer.priceType === 'free' ? ITEM_SOURCES.FREE_STORE_REWARD : ITEM_SOURCES.STORE_PURCHASE;

            // Deduct real cost
            if (offer.priceType !== 'free' && offer.priceType !== 'real') {
                const curType = offer.priceType as 'gold' | 'tokens' | 'credits';
                updatedProfile[curType] -= (offer.priceAmount || 0);

                const spendLog: ActivityLogEntry = {
                    id: generateInstanceId(),
                    title: logSource,
                    type: 'purchase',
                    date: dateStr,
                    time: timeStr,
                    delta: offer.priceAmount,
                    isSpend: true,
                    currencyType: curType,
                    amountSpent: offer.priceAmount,
                    currencySpent: curType
                };
                progressionStore.activityLog = [spendLog, ...progressionStore.activityLog].slice(0, LOG_LIMIT);
            }

            // Grant authoritative contents
            offer.contents.forEach(item => {
                if (item.type === 'currency') {
                    if (item.currencyType === 'gold') updatedProfile.gold += item.amount;
                    if (item.currencyType === 'credits') updatedProfile.credits += item.amount;
                    if (item.currencyType === 'tokens') updatedProfile.tokens += item.amount;

                    const gainLog: ActivityLogEntry = {
                        id: generateInstanceId(),
                        title: logSource,
                        type: item.currencyType as any,
                        date: dateStr,
                        time: timeStr,
                        delta: item.amount,
                        isSpend: false,
                        currencyType: item.currencyType,
                        amountGained: item.amount,
                        itemGained: item.currencyType
                    };
                    progressionStore.activityLog = [gainLog, ...progressionStore.activityLog].slice(0, LOG_LIMIT);
                } else if (item.type === 'card' && !updatedProfile.collection.includes(item.definitionId)) {
                    updatedProfile.collection = [...updatedProfile.collection, item.definitionId];
                }
            });

            if (offer.isOneTime) {
                updatedProfile.purchasedOfferIds = [...updatedProfile.purchasedOfferIds, offerId];
            }
            
            if (offer.priceType === 'free') {
                updatedProfile.lastClaimedDates = {
                    ...updatedProfile.lastClaimedDates,
                    [offerId]: new Date(Date.now() + COOLDOWN_DURATION_MS).toISOString()
                };
            }

            // Commit and track
            persistUserProfile(updatedProfile);
            transactionStore.markProcessed(transactionId);
            
            return { 
                success: true, 
                transactionId, 
                updatedProfile,
                activityLog: [...progressionStore.activityLog] 
            };
        });
    }
};
