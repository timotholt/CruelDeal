
import { createContext, useContext, createSignal, onMount, createEffect, createMemo, JSX } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { UserProfile, StoreData, SeasonPassData, ProgressionData, ActivityLogEntry, ApiResponse } from '../types';
import { audio } from '../services/audio';
import { api } from '../services/api';
import { useUI } from './UIContext';

export type CollectionSortOption = 'Cost' | 'Power' | 'Name' | 'Newest';

interface UserContextType {
    user: UserProfile;
    storeData: () => StoreData | null;
    isStoreLoading: () => boolean;
    isMutating: () => boolean;
    seasonPassData: () => SeasonPassData | null;
    isSeasonLoading: () => boolean;
    syncSeasonPass: () => Promise<void>;
    debugSwitchSeason: () => Promise<void>; 
    progressionData: () => ProgressionData | null;
    activityLog: () => ActivityLogEntry[];
    isProgressionLoading: () => boolean;
    syncProgression: (showLoading?: boolean) => Promise<void>;
    
    collectionSort: () => CollectionSortOption;
    setCollectionSort: (s: CollectionSortOption) => void;
    collectionFilterSearch: () => string;
    setCollectionFilterSearch: (s: string) => void;
    collectionFilterTags: () => string[];
    toggleCollectionFilterTag: (tag: string) => void;

    performSynchronizedAction: (apiCall: () => Promise<ApiResponse<any>>, options?: { visualDelay?: number, sfx?: string }) => Promise<boolean>;
    syncStore: () => Promise<void>;
    upgradeCard: (id: string) => Promise<void>;
    debugAddLevels: (amount: number) => Promise<void>;
    setActiveDeck: (id: number) => void;
    updateDeck: (id: number, cardIds: string[]) => void;
    renameDeck: (id: number, name: string) => void;
    activeDeck: () => string[];
}

const UserContext = createContext<UserContextType>();

export const UserProvider = (props: { children: JSX.Element; initialUser: UserProfile | (() => UserProfile) }) => {
    const getInitialUser = () => typeof props.initialUser === 'function' ? (props.initialUser as any)() : props.initialUser;
    
    console.log("UserProvider: Initializing with profile id:", getInitialUser()?.id);
    const [user, setUser] = createStore<UserProfile>(getInitialUser());
    
    createEffect(() => {
        const u = getInitialUser();
        if (u) {
            console.log("UserContext: Reconciling store with fresh user data:", u.username, u.credits);
            setUser(reconcile(u));
        }
    });
    const [storeData, setStoreData] = createSignal<StoreData | null>(null);
    const [isStoreLoading, setIsStoreLoading] = createSignal(false);
    const [isMutating, setIsMutating] = createSignal(false);
    const [seasonPassData, setSeasonPassData] = createSignal<SeasonPassData | null>(null);
    const [isSeasonLoading, setIsSeasonLoading] = createSignal(false);
    const [progressionData, setProgressionData] = createSignal<ProgressionData | null>(null);
    const [activityLog, setActivityLog] = createSignal<ActivityLogEntry[]>([]);
    const [isProgressionLoading, setIsProgressionLoading] = createSignal(false);

    const [collectionSort, setCollectionSort] = createSignal<CollectionSortOption>('Cost');
    const [collectionFilterSearch, setCollectionFilterSearch] = createSignal('');
    const [collectionFilterTags, setCollectionFilterTags] = createSignal<string[]>([]);

    const ui = useUI();

    const toggleCollectionFilterTag = (tag: string) => {
        setCollectionFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const syncSeasonPass = async () => {
        const userId = user.id;
        if (!userId || userId.length < 2) {
            console.warn("UserContext: Skipping syncSeasonPass - no valid userId", userId);
            return;
        }
        setIsSeasonLoading(true);
        const res = await api.season.get(userId);
        if (res.success) {
            setSeasonPassData(res.data);
        }
        setIsSeasonLoading(false);
    };

    const debugSwitchSeason = async () => {
        setIsSeasonLoading(true);
        await api.season.debugNext();
        await syncSeasonPass();
        setIsSeasonLoading(false);
    };

    const syncProgression = async (showLoading = false) => {
        const userId = user.id;
        if (!userId || userId.length < 2) {
            console.warn("UserContext: Skipping syncProgression - no valid userId", userId);
            return;
        }
        if (showLoading) setIsProgressionLoading(true);
        const [progRes, logRes] = await Promise.all([
            api.progression.get(userId),
            api.progression.logs()
        ]);
        if (progRes.success) setProgressionData(progRes.data);
        if (logRes.success) setActivityLog(logRes.data || []);
        setIsProgressionLoading(false);
    };

    const syncStore = async (showLoading = false) => {
        const userId = user.id;
        if (!userId || userId.length < 2) {
            console.warn("UserContext: Skipping syncStore - no valid userId", userId);
            return;
        }
        if (showLoading) setIsStoreLoading(true);
        try {
            const res = await api.store.offers.list(userId);
            if (res.success && res.data) {
                console.log("UserContext: Store sync success, items:", res.data.offers.length);
                setStoreData(res.data);
            } else {
                console.error("UserContext: Store sync failed", res.error);
            }
        } catch (e) {
            console.error("UserContext: Store sync exception", e);
        } finally {
            setIsStoreLoading(false);
        }
    };

    const performSynchronizedAction = async (
        apiCall: () => Promise<ApiResponse<any>>, 
        options?: { visualDelay?: number, sfx?: string }
    ): Promise<boolean> => {
        setIsMutating(true);
        try {
            const res = await apiCall();
            if (res.success && res.data) {
                const data = res.data;
                if (data.success && data.updatedProfile) {
                    if (options?.visualDelay) {
                        await new Promise(resolve => setTimeout(resolve, options.visualDelay));
                    }
                    
                    setUser(reconcile(data.updatedProfile));
                    if (data.activityLog) setActivityLog(data.activityLog);
                    if (data.progressionData) setProgressionData(data.progressionData);
                    
                    const sfxKey = options?.sfx || 'sfx_purchase';
                    audio.play(sfxKey as any, 0.5);

                    return true;
                }
            }
            return false;
        } finally {
            setIsMutating(false);
        }
    };

    const upgradeCard = async (cardId: string) => {
        const userId = user.id;
        const success = await performSynchronizedAction(
            () => api.profile.upgradeCard(userId, cardId),
            { visualDelay: 800 }
        );
        
        if (success) {
            ui.signalLevelUp(1);
            await syncProgression(false);
        }
    };

    const debugAddLevels = async (amount: number) => {
        const userId = user.id;
        const success = await performSynchronizedAction(
            () => api.profile.addLevels(userId, amount)
        );
        
        if (success) {
            ui.signalLevelUp(amount);
            await syncProgression(false);
        }
    };

    const setActiveDeck = async (deckId: number) => {
        const res = await api.profile.updateDeck(user.id, deckId);
        if (res.success && res.data) {
            setUser(reconcile(res.data));
        }
    };

    const updateDeck = (deckId: number, cardIds: string[]) => {
        setUser("decks", deckId, cardIds);
    };

    const renameDeck = (deckId: number, name: string) => {
        setUser("deckNames", deckId, name);
    };

    createEffect(() => {
        console.log("UserContext: Current user in store:", JSON.parse(JSON.stringify(user)));
    });

    onMount(() => {
        console.log("UserContext: onMount - userId:", user.id);
        if (user.id && user.id.length >= 2) {
            syncStore(true);
            syncSeasonPass();
            syncProgression(true);
        }
    });
    
    // We can also use createEffect to react to user.id changes if it ever changes
    createEffect(() => {
        const userId = user.id;
        console.log("UserContext: createEffect (user.id) - userId:", userId);
        if (userId && userId.length >= 2) {
            syncStore(true);
            syncSeasonPass();
            syncProgression(true);
        }
    });

    const activeDeck = createMemo(() => {
        if (!user || !user.decks) return [];
        return user.decks[user.activeDeckId] || [];
    });

    return (
        <UserContext.Provider value={{ 
            user, storeData, isStoreLoading, isMutating,
            seasonPassData, isSeasonLoading, syncSeasonPass, debugSwitchSeason,
            progressionData, activityLog, isProgressionLoading, syncProgression,
            collectionSort, setCollectionSort, collectionFilterSearch, setCollectionFilterSearch,
            collectionFilterTags, toggleCollectionFilterTag,
            performSynchronizedAction, syncStore, 
            upgradeCard, debugAddLevels, setActiveDeck, updateDeck, renameDeck, activeDeck
        }}>
            {props.children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) throw new Error('useUser must be used within a UserProvider');
    return context;
};
