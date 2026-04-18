
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { UserProfile, StoreData, SeasonPassData, ProgressionData, ActivityLogEntry, ApiResponse } from '../types';
import { audio } from '../services/audio';
import { api } from '../services/api';
import { useUI } from './UIContext';

export type CollectionSortOption = 'Cost' | 'Power' | 'Name' | 'Newest';

interface UserContextType {
    user: UserProfile;
    storeData: StoreData | null;
    isStoreLoading: boolean;
    isMutating: boolean; // NEW: Global blocking indicator
    seasonPassData: SeasonPassData | null;
    isSeasonLoading: boolean;
    syncSeasonPass: () => Promise<void>;
    debugSwitchSeason: () => Promise<void>; 
    progressionData: ProgressionData | null;
    activityLog: ActivityLogEntry[];
    isProgressionLoading: boolean;
    syncProgression: (showLoading?: boolean) => Promise<void>;
    
    collectionSort: CollectionSortOption;
    setCollectionSort: (s: CollectionSortOption) => void;
    collectionFilterSearch: string;
    setCollectionFilterSearch: (s: string) => void;
    collectionFilterTags: string[];
    toggleCollectionFilterTag: (tag: string) => void;

    performSynchronizedAction: (apiCall: () => Promise<ApiResponse<any>>, options?: { visualDelay?: number, sfx?: string }) => Promise<boolean>;
    syncStore: () => Promise<void>;
    upgradeCard: (id: string) => Promise<void>;
    debugAddLevels: (amount: number) => Promise<void>;
    setActiveDeck: (id: number) => void;
    updateDeck: (id: number, cardIds: string[]) => void;
    activeDeck: string[];
}

const UserContext = createContext<UserContextType | null>(null);

export const UserProvider: React.FC<{ children: ReactNode; initialUser: UserProfile }> = ({ children, initialUser }) => {
    const [user, setUser] = useState<UserProfile>(initialUser);
    const [storeData, setStoreData] = useState<StoreData | null>(null);
    const [isStoreLoading, setIsStoreLoading] = useState(false);
    const [isMutating, setIsMutating] = useState(false); // New state for blocking overlay
    const [seasonPassData, setSeasonPassData] = useState<SeasonPassData | null>(null);
    const [isSeasonLoading, setIsSeasonLoading] = useState(false);
    const [progressionData, setProgressionData] = useState<ProgressionData | null>(null);
    const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
    const [isProgressionLoading, setIsProgressionLoading] = useState(false);

    const [collectionSort, setCollectionSort] = useState<CollectionSortOption>('Cost');
    const [collectionFilterSearch, setCollectionFilterSearch] = useState('');
    const [collectionFilterTags, setCollectionFilterTags] = useState<string[]>([]);

    const ui = useUI();

    const toggleCollectionFilterTag = useCallback((tag: string) => {
        setCollectionFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    }, []);

    const syncSeasonPass = useCallback(async () => {
        setIsSeasonLoading(true);
        const res = await api.season.get(user.id);
        if (res.success) {
            setSeasonPassData(res.data);
        }
        setIsSeasonLoading(false);
    }, [user.id]);

    const debugSwitchSeason = useCallback(async () => {
        setIsSeasonLoading(true);
        await api.season.debugNext();
        await syncSeasonPass();
        setIsSeasonLoading(false);
    }, [syncSeasonPass]);

    const syncProgression = useCallback(async (showLoading = false) => {
        if (showLoading) setIsProgressionLoading(true);
        const [progRes, logRes] = await Promise.all([
            api.progression.get(user.id),
            api.progression.logs()
        ]);
        if (progRes.success) setProgressionData(progRes.data);
        if (logRes.success) setActivityLog(logRes.data || []);
        setIsProgressionLoading(false);
    }, [user.id]);

    const syncStore = useCallback(async (showLoading = false) => {
        if (showLoading) setIsStoreLoading(true);
        const res = await api.store.offers.list(user.id);
        if (res.success) setStoreData(res.data);
        setIsStoreLoading(false);
    }, [user.id]);

    const performSynchronizedAction = useCallback(async (
        apiCall: () => Promise<ApiResponse<any>>, 
        options?: { visualDelay?: number, sfx?: string }
    ): Promise<boolean> => {
        setIsMutating(true); // START BLOCKING
        try {
            const res = await apiCall();
            if (res.success && res.data) {
                const data = res.data;
                if (data.success && data.updatedProfile) {
                    if (options?.visualDelay) {
                        await new Promise(resolve => setTimeout(resolve, options.visualDelay));
                    }
                    
                    setUser(data.updatedProfile);
                    if (data.activityLog) setActivityLog(data.activityLog);
                    if (data.progressionData) setProgressionData(data.progressionData);
                    
                    audio.play((options?.sfx || 'sfx_victory') as any, 0.5);
                    return true;
                }
            }
            return false;
        } finally {
            setIsMutating(false); // STOP BLOCKING
        }
    }, []);

    const upgradeCard = useCallback(async (cardId: string) => {
        const success = await performSynchronizedAction(
            () => api.profile.upgradeCard(user.id, cardId),
            { visualDelay: 800 }
        );
        
        if (success) {
            ui.signalLevelUp(1);
            await syncProgression(false);
        }
    }, [user.id, ui, syncProgression, performSynchronizedAction]);

    const debugAddLevels = useCallback(async (amount: number) => {
        // Correctly handle the response from addLevels using the synchronized pattern
        const success = await performSynchronizedAction(
            () => api.profile.addLevels(user.id, amount)
        );
        
        if (success) {
            ui.signalLevelUp(amount);
            await syncProgression(false);
        }
    }, [user.id, ui, syncProgression, performSynchronizedAction]);

    const setActiveDeck = useCallback(async (deckId: number) => {
        const res = await api.profile.updateDeck(user.id, deckId);
        if (res.success && res.data) {
            setUser(res.data);
        }
    }, [user.id]);

    const updateDeck = useCallback((deckId: number, cardIds: string[]) => {
        setUser(prev => ({
            ...prev,
            decks: { ...prev.decks, [deckId]: cardIds }
        }));
    }, []);

    useEffect(() => {
        syncStore(true);
        syncSeasonPass();
        syncProgression(true);
    }, [user.id, syncStore, syncSeasonPass, syncProgression]);

    const activeDeck = useMemo(() => user.decks[user.activeDeckId] || [], [user.decks, user.activeDeckId]);

    return (
        <UserContext.Provider value={{ 
            user, storeData, isStoreLoading, isMutating,
            seasonPassData, isSeasonLoading, syncSeasonPass, debugSwitchSeason,
            progressionData, activityLog, isProgressionLoading, syncProgression,
            collectionSort, setCollectionSort, collectionFilterSearch, setCollectionFilterSearch,
            collectionFilterTags, toggleCollectionFilterTag,
            performSynchronizedAction, syncStore, 
            upgradeCard, debugAddLevels, setActiveDeck, updateDeck, activeDeck
        }}>{children}</UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) throw new Error('useUser must be used within a UserProvider');
    return context;
};
