
import { ActivityLogEntry } from '../../types';
import { ITEM_SOURCES } from '../../config/sources';

const STORAGE_KEY = 'galactic_snap_mock_db_v3';

interface DbState {
    claimedCounts: number[];
    activityLog: ActivityLogEntry[];
    currentSeasonIndex: number;
    userProfile?: any; 
    processedTxnIds: string[]; // Idempotency Registry
}

const DEFAULT_STATE: DbState = {
    claimedCounts: [0, 0, 0, 0, 0],
    activityLog: [
        { 
            id: '019553f1-79b0-760d-8524-766286287042', 
            title: ITEM_SOURCES.LOGIN_REWARD, 
            type: 'tokens', 
            date: "15 MAY 25", 
            time: "10:30", 
            delta: 50, 
            isSpend: false, 
            currencyType: 'tokens',
            amountGained: 50,
            itemGained: 'tokens'
        }
    ],
    currentSeasonIndex: 0,
    processedTxnIds: []
};

const state: DbState = (() => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : DEFAULT_STATE;
    } catch {
        return DEFAULT_STATE;
    }
})();

const save = () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn("Could not persist mock state", e);
    }
};

export const progressionStore = {
    get claimedCounts() { return state.claimedCounts; },
    set claimedCounts(val) { state.claimedCounts = val; save(); },
    get activityLog() { return state.activityLog; },
    set activityLog(val) { state.activityLog = val; save(); }
};

export const seasonStore = {
    get currentSeasonIndex() { return state.currentSeasonIndex; },
    set currentSeasonIndex(val) { state.currentSeasonIndex = val; save(); }
};

export const transactionStore = {
    isProcessed: (id: string) => state.processedTxnIds.includes(id),
    markProcessed: (id: string) => {
        state.processedTxnIds.push(id);
        // Keep registry lean (last 1000 txns)
        if (state.processedTxnIds.length > 1000) state.processedTxnIds.shift();
        save();
    }
};

export const persistUserProfile = (profile: any) => {
    state.userProfile = profile;
    save();
};

export const getPersistedProfile = () => state.userProfile;
