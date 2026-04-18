
/**
 * AUTHORITATIVE ITEM SOURCES
 * These strings are used across the API services and displayed in the Activity Log.
 */
export const ITEM_SOURCES = {
    LOGIN_REWARD: "Login Reward",
    FREE_STORE_REWARD: "Free Store Reward",
    STORE_PURCHASE: "Store Purchase",
    WEB_STORE_PURCHASE: "Web Store Purchase",
    OMEGA_BOX: "Omega Box",
    COLLECTION_LEVEL_REWARD: "Collection Level Reward",
    CONQUEST_REWARD: "Conquest Reward",
    LADDER_REWARD: "Ladder Reward",
    MISSION_REWARD: "Mission Reward",
    SEASON_PASS_REWARD: (season: number, level: number) => `Season Pass #${season} Reward #${level}`,
    DOWNTIME_REWARD: "Downtime Reward",
    HOLIDAY_GIFT: "Holiday Gift",
    VETERAN_REWARD: "Veteran Reward",
    CODE_REDEEMED: (code: string) => `Code Redeemed: ${code}`,
    SUPPORT_REWARD: "Support Reward",
} as const;

export type ItemSource = typeof ITEM_SOURCES[keyof typeof ITEM_SOURCES] | string;
