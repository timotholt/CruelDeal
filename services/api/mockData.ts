import { ProgressionRewardType, StoreOffer } from '../../types';

// --- PROGRESSION SYSTEM CONFIG ---
export const XP_PER_LEVEL = 1; 
export const DEFAULT_CAPACITY = 12;
export const TOKEN_CAPACITY = 40;

export interface RewardConfig {
    type: ProgressionRewardType;
    label: string;
    amount: number | string;
    capacity: number;
    offset: number;
}

export const REWARD_SEQUENCE: RewardConfig[] = [
    { type: 'booster', label: 'Boosters',     amount: 10,   capacity: DEFAULT_CAPACITY, offset: 9 },
    { type: 'credits', label: 'Credits',      amount: 50,   capacity: DEFAULT_CAPACITY, offset: 6 },
    { type: 'gold',    label: 'Gold',         amount: 25,   capacity: DEFAULT_CAPACITY, offset: 3 },
    { type: 'box',     label: 'Omega Box',    amount: 1,    capacity: DEFAULT_CAPACITY, offset: 0 },
    { type: 'tokens',  label: 'Tokens',       amount: 1000, capacity: TOKEN_CAPACITY,   offset: 0 }
];

// --- SERVER-SIDE LOCALIZED PAYLOADS (CMS MOCK) ---
export const MOCK_INBOX_DATA = {
    "en": [
        {
            id: "msg_001",
            type: "REWARD",
            title: "Season Launch Reward",
            body: "Welcome to Cosmic Eclipse! Enjoy these starting credits to boost your collection level.",
            ctaLabel: "CLAIM 500 CREDITS",
            rewardAmount: 500,
            isRead: false
        },
        {
            id: "msg_002",
            type: "SYSTEM",
            title: "Sector Maintenance Complete",
            body: "The Galactic Grid is now stable. Spatial UI metrics have been optimized for your device.",
            isRead: true
        }
    ]
};

export const MOCK_NEWS_DATA = {
    "en": [
        { id: "news_1", type: "Patch Notes", title: "Update 1.4.0: Spatial UI", subtitle: "We've completely overhauled the navigation system for a faster, more immersive experience.", color: "bg-slate-700/50" },
        { id: "news_2", type: "Community", title: "Top Decks of the Week", subtitle: "See what the pros are using to climb the galactic ladder.", color: "bg-slate-800/50" },
        { id: "news_3", type: "Event", title: "Double Credit Weekend", subtitle: "Earn double rewards for every Conquest match completed this Saturday and Sunday.", color: "bg-amber-700/50" }
    ]
};

export const MOCK_MAIN_MENU_DATA = {
    "en": {
        welcomeHeader: "WELCOME BACK",
        dailyBriefingLabel: "Daily Briefing",
        seasonPassLabel: "SEASON PASS",
        currentSeasonTheme: "COSMIC ECLIPSE",
        seasonSubtitle: "Unlock the new Titan variant and earn double credits this weekend.",
        endTransmissionLabel: "End of Transmission"
    }
};

export const MOCK_PREMIUM_MODAL_DATA = {
    "en": {
        title: "Season Pass Rewards",
        subtitle: "Available This Month",
        ctaLabel: "UNLOCK ALL NOW",
        ctaMain: "GO PREMIUM",
        footer: "Cards added to collection instantly. Authoritative transaction via Galactic Proxy.",
        rewards: [
            { icon: "🎴", title: "Exclusive Season Variant", desc: "A rare Pirate variant for Wolverine." },
            { icon: "💰", title: "2,500 Gold", desc: "Premium currency for variants and emotes." },
            { icon: "💎", title: "5,000 Credits", desc: "Speed up your Collection Level progress." },
            { icon: "📦", title: "10 Mega Boxes", desc: "Guaranteed variants and rare materials." },
            { icon: "🏷️", title: "Exclusive Titles", desc: "'Captain of the Void' and more." }
        ]
    }
};

// --- BATTLE HISTORY MOCK ---
export const MOCK_HISTORY_DATA = [
    { res: 'VICTORY', opp: 'Xenon_GS', mode: 'CONQUEST', score: '2-1-0', date: '24 MAY 25', time: '14:20' },
    { res: 'DEFEAT', opp: 'Bot_Alpha', mode: 'LADDER', cubes: -4, date: '23 MAY 25', time: '18:45' },
    { res: 'VICTORY', opp: 'PlayerOne', mode: 'LADDER', cubes: 2, date: '23 MAY 25', time: '10:12' },
    { res: 'DRAW', opp: 'Guest_99', mode: 'CONQUEST', score: '1-1-2', date: '22 MAY 25', time: '22:30' },
    { res: 'VICTORY', opp: 'Starlord', mode: 'CONQUEST', score: '2-0-0', date: '21 MAY 25', time: '16:05' },
    { res: 'DEFEAT', opp: 'ThanosWasRight', mode: 'LADDER', cubes: -8, date: '20 MAY 25', time: '09:15' },
    { res: 'VICTORY', opp: 'NovaCommander', mode: 'LADDER', cubes: 4, date: '19 MAY 25', time: '13:40' },
    { res: 'DEFEAT', opp: 'Zabu_Fan', mode: 'CONQUEST', score: '0-2-1', date: '18 MAY 25', time: '21:55' },
];

// --- LEADERBOARD MOCK ---
export const MOCK_LEADERBOARD_DATA = [
    { rank: 1, name: 'Xenon_GS', score: 12450, avatar: '🏆' },
    { rank: 2, name: 'VoidWalker', score: 11980, avatar: '⚔️' },
    { rank: 3, name: 'NovaCommander', score: 11500, avatar: '💠' },
    { rank: 4, name: 'PlayerOne', score: 10200, avatar: '🎮' },
    { rank: 5, name: 'Starlord', score: 9850, avatar: '🌌' },
    { rank: 6, name: 'ThanosWasRight', score: 9400, avatar: '💎' },
];

export const MOCK_PERSONAL_LADDER = {
    points: 450,
    percentile: "Top 15% in Sector",
    rank: 10
};

// --- ACCOUNT STATS MOCK ---
export const MOCK_ACCOUNT_STATS = {
    totalMatches: 142,
    winRate: "58.2%",
    fastestWinTurn: 4,
    milestones: [
        { icon: "🏆", text: "Reached Rank 10" },
        { icon: "💎", text: "Collected 10 Variants" }
    ]
};

// --- COMIC ARCHIVE MOCK ---
export const MOCK_COMIC_DATA = [
    { issueNumber: 1, title: "THE ARRIVAL", isLocked: false },
    { issueNumber: 2, title: "FIRST CONTACT", isLocked: false },
    { issueNumber: 3, title: "THE VOID OPENS", isLocked: true },
    { issueNumber: 4, title: "LAST STAND", isLocked: true },
];

// --- INVENTORY MOCK ---
export const MOCK_INVENTORY_DATA = [
    { id: 'inv_1', title: "Omega Boxes", count: 2, iconType: 'BOX' },
    { id: 'inv_2', title: "Conquest Tickets", count: 5, iconType: 'TICKET' },
    { id: 'inv_3', title: "Card Backs", count: 14, iconType: 'BACK' },
];

// --- STORE MANIFEST ---
export const MOCK_STORE_OFFERS: StoreOffer[] = [
    {
        id: 'offer_bundle_starter',
        title: 'OFFER_STARTER_TITLE',
        description: 'OFFER_STARTER_DESC',
        price: '$99.99',
        priceAmount: 9999,
        priceType: 'real',
        imageUrl: 'https://picsum.photos/seed/bundle1/400/200',
        discountLabel: 'BEST VALUE',
        category: 'featured',
        isOneTime: true,
        contents: [
            { type: 'currency', currencyType: 'credits', amount: 12500 },
            { type: 'currency', currencyType: 'tokens', amount: 3000 },
            { type: 'card', definitionId: 'c11' }
        ]
    },
    {
        id: 'offer_bundle_venom',
        title: 'OFFER_VENOM_TITLE',
        description: 'OFFER_VENOM_DESC',
        price: '$24.99',
        priceAmount: 2499,
        priceType: 'real',
        imageUrl: 'https://picsum.photos/seed/bundle2/400/200',
        category: 'featured',
        isOneTime: true,
        contents: [
            { type: 'currency', currencyType: 'tokens', amount: 3000 },
            { type: 'currency', currencyType: 'credits', amount: 2000 },
            { type: 'card', definitionId: 'c13' }
        ]
    },
    // Daily Credits (3 Tiers provided)
    {
        id: 'offer_daily_credits_free',
        title: 'OFFER_DAILY_GIFT_TITLE',
        description: 'OFFER_DAILY_GIFT_DESC',
        price: 'FREE',
        priceAmount: 0,
        priceType: 'free',
        imageUrl: 'https://picsum.photos/seed/cfree/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'credits', amount: 25 }]
    },
    {
        id: 'offer_credits_s',
        title: 'OFFER_CREDITS_S_TITLE',
        description: 'A small boost.',
        price: '400 GOLD',
        priceAmount: 400,
        priceType: 'gold',
        imageUrl: 'https://picsum.photos/seed/cs/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'credits', amount: 500 }]
    },
    {
        id: 'offer_credits_m',
        title: 'OFFER_CREDITS_M_TITLE',
        description: 'A significant boost.',
        price: '1200 GOLD',
        priceAmount: 1200,
        priceType: 'gold',
        imageUrl: 'https://picsum.photos/seed/cm/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'credits', amount: 1500 }]
    },
    // Daily Gold (6 Tiers provided)
    {
        id: 'offer_gold_s',
        title: 'OFFER_GOLD_S_TITLE',
        description: 'Starter gold.',
        price: '$4.99',
        priceAmount: 499,
        priceType: 'real',
        imageUrl: 'https://picsum.photos/seed/gs/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'gold', amount: 300 }]
    },
    {
        id: 'offer_gold_m',
        title: 'OFFER_GOLD_M_TITLE',
        description: 'Handy gold.',
        price: '$9.99',
        priceAmount: 999,
        priceType: 'real',
        imageUrl: 'https://picsum.photos/seed/gm/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'gold', amount: 700 }]
    },
    {
        id: 'offer_gold_l',
        title: 'OFFER_GOLD_L_TITLE',
        description: 'Serious gold.',
        price: '$19.99',
        priceAmount: 1999,
        priceType: 'real',
        imageUrl: 'https://picsum.photos/seed/gl/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'gold', amount: 1450 }]
    },
    {
        id: 'offer_gold_xl',
        title: 'OFFER_GOLD_XL_TITLE',
        description: 'Vast wealth.',
        price: '$34.99',
        priceAmount: 3499,
        priceType: 'real',
        imageUrl: 'https://picsum.photos/seed/gxl/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'gold', amount: 2600 }]
    },
    {
        id: 'offer_gold_ultra',
        title: 'OFFER_GOLD_ULTRA_TITLE',
        description: 'The hoard.',
        price: '$49.99',
        priceAmount: 4999,
        priceType: 'real',
        imageUrl: 'https://picsum.photos/seed/gultra/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'gold', amount: 3850 }]
    },
    {
        id: 'offer_gold_galactic',
        title: 'OFFER_GOLD_GALACTIC_TITLE',
        description: 'Own the stars.',
        price: '$99.99',
        priceAmount: 9999,
        priceType: 'real',
        imageUrl: 'https://picsum.photos/seed/ggalactic/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'gold', amount: 8000 }]
    },
    // Daily Tokens (6 Tiers provided)
    {
        id: 'offer_daily_tokens_free',
        title: 'OFFER_DAILY_GIFT_TITLE',
        description: 'Daily token drop.',
        price: 'FREE',
        priceAmount: 0,
        priceType: 'free',
        imageUrl: 'https://picsum.photos/seed/tfree/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'tokens', amount: 50 }]
    },
    {
        id: 'offer_tokens_s',
        title: 'OFFER_TOKENS_S_TITLE',
        description: 'Minor tokens.',
        price: '1300 GOLD',
        priceAmount: 1300,
        priceType: 'gold',
        imageUrl: 'https://picsum.photos/seed/ts/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'tokens', amount: 1000 }]
    },
    {
        id: 'offer_tokens_m',
        title: 'OFFER_TOKENS_M_TITLE',
        description: 'Standard tokens.',
        price: '3250 GOLD',
        priceAmount: 3250,
        priceType: 'gold',
        imageUrl: 'https://picsum.photos/seed/tm/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'tokens', amount: 2500 }]
    },
    {
        id: 'offer_tokens_l',
        title: 'OFFER_TOKENS_L_TITLE',
        description: 'Major tokens.',
        price: '6500 GOLD',
        priceAmount: 6500,
        priceType: 'gold',
        imageUrl: 'https://picsum.photos/seed/tl/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'tokens', amount: 5000 }]
    },
    {
        id: 'offer_tokens_xl',
        title: 'OFFER_TOKENS_XL_TITLE',
        description: 'Elite tokens.',
        price: '10400 GOLD',
        priceAmount: 10400,
        priceType: 'gold',
        imageUrl: 'https://picsum.photos/seed/txl/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'tokens', amount: 8000 }]
    },
    {
        id: 'offer_tokens_elite',
        title: 'OFFER_TOKENS_ELITE_TITLE',
        description: 'Master tokens.',
        price: '15600 GOLD',
        priceAmount: 15600,
        priceType: 'gold',
        imageUrl: 'https://picsum.photos/seed/telite/200/200',
        category: 'daily',
        isOneTime: false,
        contents: [{ type: 'currency', currencyType: 'tokens', amount: 12000 }]
    }
];

export const SEASONS = [
    { id: '2025_01', name: 'COSMIC ECLIPSE', heroCardId: 'c15', heroVariant: 'DEATH' },
    { id: '2025_02', name: 'NEON UPRISING', heroCardId: 'c8', heroVariant: 'CYBER-SOUL' },
];