
import { SfxKey } from './utils/assets';

export { SfxKey };

// --- Elite API Types ---
export interface ApiResponse<T> {
    success: boolean;
    data: T | null;
    error: ApiErrorPayload | null;
    timestamp: number;
}

export interface ApiErrorPayload {
    code: string;
    message: string;
    field?: string; // Optional: for validation errors
}

// --- UI Types ---
export type ScreenKey = 'MENU' | 'GAME' | 'PLAY' | 'DECK' | 'SEASON' | 'STORE' | 'PROFILE' | 'INBOX' | 'RANK' | 'PROGRESSION' | 'HISTORY' | 'SETTINGS';

export type CollectionTab = 'CARDS' | 'COMICS' | 'INVENTORY';

export type Zone = 
  | "DECK" 
  | "HAND" 
  | "BOARD" 
  | "DISCARDED" 
  | "DESTROYED" 
  | "BANISHED";

export type PlayerID = "p1" | "p2";

// --- Meta Game Types ---
export interface SeasonProgressData {
    level: number;
    xp: number;
}

export interface UserProfile {
    id: string;
    username: string;
    level: number; 
    seasonProgress: Record<string, SeasonProgressData>; 
    rank: number; 
    credits: number;
    gold: number;
    tokens: number; 
    activeDeckId: number;
    avatarId: string;
    purchasedOfferIds: string[]; 
    lastClaimedDates: Record<string, string>;
    collection: string[]; 
    decks: Record<number, string[]>; 
    deckNames: Record<number, string>;
    deckStats: Record<number, {
        conquestWinRate: number;
        ladderWinRate: number;
        conquestWins: number;
        conquestTotal: number;
        ladderWins: number;
        ladderLosses: number;
        lastModified: string; 
    }>;
    cardRarities: Record<string, CardRarity>; 
}

export type CardRarity = "Common" | "Rare" | "Epic" | "Legendary";
export type CardType = "character" | "device" | "spell";

// --- Progression Types ---
export type ProgressionRewardType = 'booster' | 'credits' | 'gold' | 'box' | 'card' | 'tokens';

export interface ProgressionTrack {
    type: ProgressionRewardType;
    label: string;
    currentXP: number;
    targetXP: number;
    unclaimedCount: number;
    nextRewardAmount: number | string;
    nextRewardCardDef?: CardDefinition;
}

export interface ProgressionData {
    collectionLevel: number;
    tracks: ProgressionTrack[];
}

/**
 * CLIENT-FACING LOG ENTRY
 */
export interface ActivityLogEntry {
    id: string;
    title: string;
    type: ProgressionRewardType | 'purchase' | 'system';
    date: string;
    time: string;
    amount?: string | number;
    delta?: number; 
    isSpend?: boolean; 
    isBulk?: boolean; 
    currencyType?: 'gold' | 'credits' | 'tokens';
    cardDef?: CardDefinition;
    amountGained?: number;
    amountSpent?: number;
    // Added fields used by mock implementation for bookkeeping
    itemGained?: string;
    currencySpent?: string;
}

/**
 * SERVER-ONLY LOG ENTRY
 */
export interface ServerActivityLogEntry extends ActivityLogEntry {
    reconciliationId?: string;
}

// --- Season Types ---
export type SeasonRewardType = 'gold' | 'credits' | 'card' | 'booster' | 'tokens';

export interface SeasonPassReward {
    level: number;
    type: SeasonRewardType;
    amount: string | number;
    isClaimed: boolean;
    isActive: boolean;
    isLocked: boolean;
    cardDef?: CardDefinition;
}

export interface SeasonPassData {
    id: string;
    themeName: string;
    startDate: string;
    endDate: string;
    endsInSeconds: number;
    premiumActive: boolean;
    heroCardId: string;
    heroVariantName?: string;
    rewards: SeasonPassReward[];
}

// --- Store Types ---
export type OfferItem = 
  | { type: 'card'; definitionId: string }
  | { type: 'currency'; currencyType: 'gold' | 'credits' | 'tokens'; amount: number };

export interface StoreOffer {
    id: string;
    title: string;
    description: string;
    price: string; 
    priceAmount?: number; 
    priceType: 'real' | 'gold' | 'credits' | 'free' | 'tokens';
    imageUrl: string;
    discountLabel?: string;
    category?: 'featured' | 'monthly' | 'daily';
    isOneTime: boolean;
    purchaseLimit?: number; 
    contents: OfferItem[];
    expiryDate?: string; 
    cooldownSeconds?: number; 
    availableAt?: string; 
}

export interface StoreData {
    offers: StoreOffer[];
    lastUpdated: number;
    refreshHintSeconds: number;
}

export type StoreErrorCode = 
    | 'ERR_OFFER_NOT_FOUND' 
    | 'ERR_INSUFFICIENT_FUNDS' 
    | 'ERR_STALE_OFFER' 
    | 'ERR_DUPLICATE_TRANSACTION' 
    | 'ERR_BALANCE_DESYNC'
    | 'ERR_COOLDOWN_ACTIVE';

export interface PurchaseResponse {
    success: boolean;
    errorCode?: StoreErrorCode;
    transactionId: string;
    updatedProfile?: UserProfile; 
    activityLog?: ActivityLogEntry[];
}

export type VfxKey = 
    | 'vfx_explosion_small' 
    | 'vfx_warp_trail' 
    | 'vfx_dust_motes' 
    | 'vfx_electric_arcs' 
    | 'vfx_nebula_fog';

export interface LocationDefinition {
  id: string;
  name: string;
  description: string;
  effect: string;
  imageUrl: string;
  sfxOnReveal?: SfxKey;
  vfxAmbient?: VfxKey;
}

export interface LocationInstance {
  id: string;
  def: LocationDefinition;
  revealed: boolean;
}

export interface CardDefinition {
  id: string;
  name: string;
  cardType?: CardType;
  rarity: CardRarity;
  baseCost: number;
  basePower: number;
  tags: string[]; 
  baseText: string;
  effect: string; 
  imageUrl: string;
  flavorText?: string;
  sfxOnPlay?: SfxKey;   
  sfxOnReveal?: SfxKey; 
  vfxOnReveal?: VfxKey; 
  logic?: any[];
}

export interface StatModifier {
  source: string; 
  value: number;
  type: "BASE" | "PERMANENT" | "CONTINUOUS";
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  owner: PlayerID;
  zone: Zone;
  laneIndex: number | null;
  slotIndex: number | null;
  faceUp: boolean;
  turnPlayed: number | null;
  playOrder: number | null;
  baseCost: number;
  currentCost: number;
  totalCost: number;
  costModifiers: StatModifier[];
  basePower: number;
  currentPower: number;
  totalPower: number;
  powerModifiers: StatModifier[];
  baseText: string;
  currentText: string;
  abilityEnabled: boolean;
  hasResolvedOnReveal: boolean;
  startedInDeck: boolean;
  created: boolean;
  createdInZone: Zone;
  def: CardDefinition;
  pendingDiscard?: boolean;
  pendingDestroy?: boolean;
}

export interface PlayerState {
  energy: number;
  stats: { destroyedCount: number; destroyedPower: number };
  hand: CardInstance[];
  deck: CardInstance[];
  discardPile: CardInstance[];
  destroyedPile: CardInstance[];
  banishedPile: CardInstance[];
}

export interface Lane {
  location: LocationInstance; 
  p1Slots: (CardInstance | null)[];
  p2Slots: (CardInstance | null)[];
}

export interface GameState {
  turn: number;
  maxTurns: number;
  nextPlayOrder: number;
  priority: PlayerID;
  players: { p1: PlayerState; p2: PlayerState; }; 
  lanes: [Lane, Lane, Lane];
  winner: PlayerID | 'draw' | null;
  phase: 'planning' | 'resolving' | 'gameover';
  history: string[];
  eventQueue: GameEvent[]; 
  executionQueue: any[];
}

export interface OnRevealEffect {
  (state: GameState, source: CardInstance, context: EffectContext): GameState; 
}

export interface OngoingEffectFunction {
  (state: GameState, laneIdx: number, slotIdx: number, source: CardInstance): void;
}

export interface EffectContext {
  player: PlayerID;
  laneIndex: number;
  slotIndex: number;
  gameRegistry: CardDefinition[];
  actions: ActionSet;
  params?: any;
}

export type LaneSlots = (CardInstance | null)[];

export type GameEvent = 
  | { id: string; type: 'SFX_PLAY'; sfxId: SfxKey }
  | { id: string; type: 'VFX_PLAY'; vfxId: VfxKey; laneIdx?: number; slotIdx?: number; playerId?: PlayerID };

export interface ActionSet {
    destroyCard: (state: GameState, id: string) => GameState;
    addCardToHand: (state: GameState, card: CardInstance) => GameState;
    moveCard: (state: GameState, id: string, targetLane: number) => GameState;
    addCardToLane: (state: GameState, card: CardInstance, laneIdx: number) => GameState;
    modifyPower: (state: GameState, id: string, delta: number, source: string) => GameState;
    recalcState: (state: GameState) => GameState;
    playSfx: (state: GameState, sfxId: SfxKey) => GameState;
}
