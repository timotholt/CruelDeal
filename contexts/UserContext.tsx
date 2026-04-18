
import { createContext, useContext, createSignal, createEffect, createMemo, JSX } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { createQuery, useQueryClient, createMutation } from '@tanstack/solid-query';
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
    syncSeasonPass: () => Promise<any>;
    debugSwitchSeason: () => Promise<void>; 
    progressionData: () => ProgressionData | null;
    activityLog: () => ActivityLogEntry[];
    isProgressionLoading: () => boolean;
    syncProgression: () => Promise<any>;
    
    collectionSort: () => CollectionSortOption;
    setCollectionSort: (s: CollectionSortOption) => void;
    collectionFilterSearch: () => string;
    setCollectionFilterSearch: (s: string) => void;
    collectionFilterTags: () => string[];
    toggleCollectionFilterTag: (tag: string) => void;

    performSynchronizedAction: (apiCall: () => Promise<ApiResponse<any>>, options?: { visualDelay?: number, sfx?: string }) => Promise<boolean>;
    syncStore: () => Promise<any>;
    upgradeCard: (id: string) => Promise<void>;
    debugAddLevels: (amount: number) => Promise<void>;
    setActiveDeck: (id: number) => void;
    updateDeck: (id: number, cardIds: string[]) => void;
    renameDeck: (id: number, name: string) => void;
    activeDeck: () => string[];
}

const UserContext = createContext<UserContextType>();

export const UserProvider = (props: { children: JSX.Element; initialUser: UserProfile | (() => UserProfile) }) => {
    const queryClient = useQueryClient();
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

    const [isMutating, setIsMutating] = createSignal(false);
    const [collectionSort, setCollectionSort] = createSignal<CollectionSortOption>('Cost');
    const [collectionFilterSearch, setCollectionFilterSearch] = createSignal('');
    const [collectionFilterTags, setCollectionFilterTags] = createSignal<string[]>([]);

    const ui = useUI();

    // Secondary Data Queries
    const storeQuery = createQuery(() => ({
        queryKey: ['store', user.id],
        queryFn: async () => {
            const res = await api.store.offers.list(user.id);
            if (!res.success) throw new Error(res.error || 'Failed to fetch store');
            return res.data;
        },
        enabled: !!user.id && user.id.length >= 2,
    }));

    const seasonQuery = createQuery(() => ({
        queryKey: ['season', user.id],
        queryFn: async () => {
            const res = await api.season.get(user.id);
            if (!res.success) throw new Error(res.error || 'Failed to fetch season');
            return res.data;
        },
        enabled: !!user.id && user.id.length >= 2,
    }));

    const progressionQuery = createQuery(() => ({
        queryKey: ['progression', user.id],
        queryFn: async () => {
            const res = await api.progression.get(user.id);
            if (!res.success) throw new Error(res.error || 'Failed to fetch progression');
            return res.data;
        },
        enabled: !!user.id && user.id.length >= 2,
    }));

    const activityLogQuery = createQuery(() => ({
        queryKey: ['activityLog'],
        queryFn: async () => {
            const res = await api.progression.logs();
            if (!res.success) throw new Error(res.error || 'Failed to fetch logs');
            return res.data || [];
        },
        enabled: !!user.id && user.id.length >= 2,
    }));

    const toggleCollectionFilterTag = (tag: string) => {
        setCollectionFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const saveDeckMutation = createMutation(() => ({
        mutationFn: async ({ deckId, cardIds }: { deckId: number, cardIds: string[] }) => {
            const res = await api.profile.saveDeck(user.id, deckId, cardIds);
            if (!res.success) throw new Error(res.error || 'Failed to save deck');
            return res.data;
        },
        onSuccess: (updatedProfile) => {
            if (updatedProfile) setUser(reconcile(updatedProfile));
        }
    }));

    const renameDeckMutation = createMutation(() => ({
        mutationFn: async ({ deckId, name }: { deckId: number, name: string }) => {
            const res = await api.profile.renameDeck(user.id, deckId, name);
            if (!res.success) throw new Error(res.error || 'Failed to rename deck');
            return res.data;
        },
        onSuccess: (updatedProfile) => {
            if (updatedProfile) setUser(reconcile(updatedProfile));
        }
    }));

    const syncSeasonPass = () => queryClient.invalidateQueries({ queryKey: ['season', user.id] });
    const syncProgression = () => Promise.all([
        queryClient.invalidateQueries({ queryKey: ['progression', user.id] }),
        queryClient.invalidateQueries({ queryKey: ['activityLog'] })
    ]);
    const syncStore = () => queryClient.invalidateQueries({ queryKey: ['store', user.id] });

    const debugSwitchSeason = async () => {
        await api.season.debugNext();
        await syncSeasonPass();
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
                    
                    // Trigger refetches if data changed on server
                    if (data.activityLog) queryClient.setQueryData(['activityLog'], data.activityLog);
                    if (data.progressionData) queryClient.setQueryData(['progression', user.id], data.progressionData);
                    
                    const sfxKey = options?.sfx || 'sfx_purchase';
                    audio.play(sfxKey as any, 0.5);

                    return true;
                }
            }
            return false;
        } catch (e) {
            console.error("Action failed:", e);
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
            await syncProgression();
        }
    };

    const debugAddLevels = async (amount: number) => {
        const userId = user.id;
        const success = await performSynchronizedAction(
            () => api.profile.addLevels(userId, amount)
        );
        
        if (success) {
            ui.signalLevelUp(amount);
            await syncProgression();
        }
    };

    const setActiveDeck = async (deckId: number) => {
        const res = await api.profile.updateDeck(user.id, deckId);
        if (res.success && res.data) {
            setUser(reconcile(res.data));
        }
    };

    const updateDeck = (deckId: number, cardIds: string[]) => {
        // Optimistic update of local store
        setUser("decks", deckId, cardIds);
        saveDeckMutation.mutate({ deckId, cardIds });
    };

    const renameDeck = (deckId: number, name: string) => {
        // Optimistic update of local store
        setUser("deckNames", deckId, name);
        renameDeckMutation.mutate({ deckId, name });
    };

    createEffect(() => {
        console.log("UserContext: Current user in store:", JSON.parse(JSON.stringify(user)));
    });

    const activeDeck = createMemo(() => {
        if (!user || !user.decks) return [];
        return user.decks[user.activeDeckId] || [];
    });

    return (
        <UserContext.Provider value={{ 
            user, 
            storeData: () => storeQuery.data ?? null, 
            isStoreLoading: () => storeQuery.isLoading, 
            isMutating,
            seasonPassData: () => seasonQuery.data ?? null, 
            isSeasonLoading: () => seasonQuery.isLoading, 
            syncSeasonPass, 
            debugSwitchSeason,
            progressionData: () => progressionQuery.data ?? null, 
            activityLog: () => activityLogQuery.data ?? [], 
            isProgressionLoading: () => progressionQuery.isLoading || activityLogQuery.isLoading, 
            syncProgression,
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
