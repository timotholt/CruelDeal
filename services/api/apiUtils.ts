
import { ActivityLogEntry, ServerActivityLogEntry, ApiResponse, ApiErrorPayload } from '../../types';

/**
 * GLOBAL MUTATION LOCK
 * This is the "One Queue to Rule Them All".
 * Every API call that modifies the user profile (Store, Profile, Progression)
 * MUST chain onto this promise to ensure absolute serial execution.
 */
export let MUTATION_LOCK: Promise<any> = Promise.resolve();

/**
 * Helper to queue an action into the global mutation lock.
 */
export const lockedMutation = <T>(action: () => Promise<T>): Promise<T> => {
    return MUTATION_LOCK = MUTATION_LOCK.then(action);
};

/**
 * SIMULATED NETWORK LATENCY
 */
export const simulateNetwork = async (minMs = 200, maxMs = 600) => {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
    await new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * SESSION VALIDATION (Authoritative)
 */
export const verifySession = (userId: string) => {
    if (!userId || userId.length < 2) {
        throw new ApiError('ERR_UNAUTHORIZED', 'Secure session link severed. Please re-authenticate.');
    }
    return userId; 
};

/**
 * WHITELIST SANITIZATION
 */
export const sanitizeLog = (logs: ServerActivityLogEntry[]): ActivityLogEntry[] => {
    return logs.map(entry => {
        const publicEntry: ActivityLogEntry = {
            id: entry.id,
            title: entry.title,
            type: entry.type,
            date: entry.date,
            time: entry.time,
            amount: entry.amount,
            isSpend: entry.isSpend,
            isBulk: entry.isBulk,
            currencyType: entry.currencyType,
            cardDef: entry.cardDef
        };

        if (!entry.isSpend) {
            publicEntry.delta = entry.delta;
        }
        
        return publicEntry;
    });
};

/**
 * HARDENED API WRAPPER
 */
export const safeExecute = async <T>(
    action: () => Promise<T>,
    _validator?: (data: T) => boolean
): Promise<ApiResponse<T>> => {
    try {
        const data = await action();
        return {
            success: true,
            data,
            error: null,
            timestamp: Date.now()
        };
    } catch (err: any) {
        console.error(`[SECURITY LOG] Request Failed. Code: ${err.code || 'UNKNOWN'}. Msg: ${err.message}`);
        
        const errorPayload: ApiErrorPayload = {
            code: err.code || 'ERR_SYSTEM_FAILURE',
            message: err.message || 'A transmission error occurred in the Galactic Grid.'
        };

        return {
            success: false,
            data: null,
            error: errorPayload,
            timestamp: Date.now()
        };
    }
};

export class ApiError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}
