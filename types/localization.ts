export interface LocalizationSchema {
    // Navigation
    NAV_SEASON: string;
    NAV_INBOX: string;
    NAV_MAIN: string;
    NAV_COLLECTION: string;
    NAV_STORE: string;

    // Common UI
    UI_CLOSE: string;
    UI_CANCEL: string;
    UI_BACK: string;
    UI_MENU: string;
    UI_CLAIM: string;
    UI_SYNCING: string;
    UI_Lvl: string;
    UI_TAP_TO_CLOSE: string;
    UI_AVAILABLE_BALANCE: string;
    UI_SEARCH_CARDS: string;
    UI_MARK_READ: string;
    UI_HOLD_BUY: string;
    UI_SYNCED: string;
    UI_CLAIMED: string;

    // Loading & Login
    LOAD_DOWNLOADING: string;
    LOAD_CALIBRATING: string;
    LOAD_SYNCING_TYPO: string;
    LOAD_FINALIZING: string;
    LOAD_INITIALIZING: string;
    LOAD_SYNCING_SECTOR: string;
    LOGIN_SUBTITLE: string;
    LOGIN_GUEST: string;
    LOGIN_FOOTER: string;

    // Main Menu & News
    MENU_WELCOME: string;
    MENU_DAILY_BRIEFING: string;
    MENU_SEASON_PASS: string;
    MENU_END_TRANSMISSION: string;
    NEWS_SECTOR_ANNOUNCE: string;
    INBOX_EMPTY: string;

    // Game Interface & Results
    GAME_RESIGN: string;
    GAME_END_TURN: string;
    GAME_WAITING: string;
    GAME_READY: string;
    GAME_UNDO_ALL: string;
    GAME_PLAY_AGAIN: string;
    GAME_SHOW_RESULTS: string;
    GAME_HIDE_RESULTS: string;
    GAME_TURN: string;
    GAME_YOU: string;
    GAME_OPPONENT: string;
    RESULT_VICTORY: string;
    RESULT_DEFEAT: string;
    RESULT_DRAW: string;
    RESULT_TIE_GAME: string;
    RESULT_OPP_DEFEATED: string;
    RESULT_SECTOR_LOST: string;
    RESULT_REWARD: string;

    // Store & Progression
    STORE_TITLE: string;
    STORE_FEATURED: string;
    STORE_CREDITS: string;
    STORE_GOLD: string;
    STORE_TOKENS: string;
    STORE_INSTANT_CREDIT_FOOTER: string;
    PROG_COLLECTION_LEVEL: string;
    PROG_SYNAPSE_ACTIVE: string;
    INSPECT_UPGRADE_TO: string;

    // Activity Log
    UI_ACTIVITY_LOG: string;
    UI_SHOWING_LAST_LOGS: string;
    UI_LOG_EMPTY: string;

    // Season Screen
    SEASON_MASTERY: string;
    SEASON_EXCLUSIVE: string;
    SEASON_LVL_50: string;
    SEASON_GO_PREMIUM: string;
    SEASON_PREMIUM_TAG: string;
    SEASON_TIMELINE: string;
    SEASON_ENDS_IN: string;

    // Lore & Comics
    LORE_DB_TERM: string;
    LORE_COLLECT_MORE: string;

    // Battle History
    HIST_TITLE: string;
    HIST_ALL: string;
    HIST_WIN: string;
    HIST_LOSS: string;
    HIST_TIE: string;
    HIST_CONQUEST: string;
    HIST_LADDER: string;
    HIST_LIMIT_NOTE: string;
    HIST_END: string;

    // Profile Screen
    PROF_TITLE: string;
    PROF_GLOBAL_RANK: string;
    PROF_COLLECTED: string;
    PROF_CQ_WINS: string;
    PROF_PERFORMANCE: string;
    PROF_TOTAL_MATCHES: string;
    PROF_WIN_RATE: string;
    PROF_FASTEST: string;
    PROF_MILESTONES: string;
    PROF_LOGOUT: string;

    // Ladder
    LADDER_YOU: string;

    // Settings
    SETT_TITLE: string;
    SETT_AUDIO: string;
    SETT_MUSIC: string;
    SETT_SFX: string;
    SETT_STATUS: string;
    SETT_ID: string;
    SETT_SYNC: string;
    SETT_CONNECTED: string;
    SETT_VISUAL: string;
    SETT_60FPS: string;
    SETT_HIGHRES: string;

    // Dynamic Contexts (API Keys)
    OFFER_STARTER_TITLE: string;
    OFFER_STARTER_DESC: string;
    OFFER_VENOM_TITLE: string;
    OFFER_VENOM_DESC: string;
    OFFER_DAILY_GIFT_TITLE: string;
    OFFER_DAILY_GIFT_DESC: string;

    OFFER_CREDITS_S_TITLE: string;
    OFFER_CREDITS_M_TITLE: string;
    OFFER_CREDITS_L_TITLE: string;
    OFFER_CREDITS_XL_TITLE: string;
    OFFER_CREDITS_MEGA_TITLE: string;

    OFFER_GOLD_S_TITLE: string;
    OFFER_GOLD_M_TITLE: string;
    OFFER_GOLD_L_TITLE: string;
    OFFER_GOLD_XL_TITLE: string;
    OFFER_GOLD_ULTRA_TITLE: string;
    OFFER_GOLD_GALACTIC_TITLE: string;

    OFFER_TOKENS_S_TITLE: string;
    OFFER_TOKENS_M_TITLE: string;
    OFFER_TOKENS_L_TITLE: string;
    OFFER_TOKENS_XL_TITLE: string;
    OFFER_TOKENS_ELITE_TITLE: string;
    OFFER_TOKENS_COSMIC_TITLE: string;
    
    INBOX_RANK_REWARD_TITLE: string;
    INBOX_RANK_REWARD_MSG: string;
    INBOX_MAINT_TITLE: string;
    INBOX_MAINT_MSG: string;
    INBOX_CLAIM_CREDITS: string;
}

export type LocaleKey = keyof LocalizationSchema;