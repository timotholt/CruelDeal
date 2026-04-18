
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CardInstance, CardDefinition, LocationDefinition, SeasonRewardType, ProgressionRewardType } from '../types';
import { audio } from '../services/audio';

interface BoxReward {
    type: 'box';
    boxType: 'MYSTERY' | 'MEGA';
    title: string;
    description: string;
}

export interface SeasonRewardInfo {
    type: 'level_info';
    level: number;
    rewardType: SeasonRewardType | ProgressionRewardType;
    rewardAmount: string | number;
    isClaimed?: boolean;
    cardDef?: CardDefinition;
}

interface InspectingCard {
    data: CardInstance | CardDefinition;
    borderOverride?: string;
}

interface UIContextType {
    inspectingCard: InspectingCard | null;
    inspectingLocation: LocationDefinition | null;
    inspectingCurrency: { type: 'gold' | 'credits', amount: number } | null;
    inspectingBox: BoxReward | null;
    inspectingReward: SeasonRewardInfo | null;
    inspect: (item: any, options?: { borderOverride?: string }) => void;
    closeInspector: () => void;
    storeScrollTarget: string | null;
    setStoreScrollTarget: (id: string | null) => void;
    // Level Up Flow
    pendingLevelIncrement: number;
    signalLevelUp: (increment: number) => void;
    clearLevelUpSignal: () => void;
    // Activity Log Modal
    isActivityLogOpen: boolean;
    openActivityLog: () => void;
    closeActivityLog: () => void;
}

const UIContext = createContext<UIContextType | null>(null);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [inspectingCard, setInspectingCard] = useState<InspectingCard | null>(null);
    const [inspectingLocation, setInspectingLocation] = useState<LocationDefinition | null>(null);
    const [inspectingCurrency, setInspectingCurrency] = useState<{ type: 'gold' | 'credits', amount: number } | null>(null);
    const [inspectingBox, setInspectingBox] = useState<BoxReward | null>(null);
    const [inspectingReward, setInspectingReward] = useState<SeasonRewardInfo | null>(null);
    const [storeScrollTarget, setStoreScrollTarget] = useState<string | null>(null);
    const [pendingLevelIncrement, setPendingLevelIncrement] = useState(0);
    const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);

    const inspect = useCallback((item: any, options?: { borderOverride?: string }) => {
        if (!item) return; 
        audio.playUiClick();
        
        setInspectingCurrency(null); 
        setInspectingCard(null); 
        setInspectingLocation(null); 
        setInspectingBox(null); 
        setInspectingReward(null);

        if ('type' in item) {
            if (item.type === 'gold' || item.type === 'credits') setInspectingCurrency(item);
            else if (item.type === 'box') setInspectingBox(item);
            else if (item.type === 'level_info') setInspectingReward(item);
        } 
        else if (('instanceId' in item) || ('basePower' in item) || ('definitionId' in item)) {
            setInspectingCard({ data: item, borderOverride: options?.borderOverride });
        }
        else if ('description' in item) {
            setInspectingLocation(item);
        }
    }, []);

    const closeInspector = useCallback(() => { 
        setInspectingCard(null); 
        setInspectingLocation(null); 
        setInspectingCurrency(null); 
        setInspectingBox(null); 
        setInspectingReward(null); 
    }, []);

    const signalLevelUp = useCallback((increment: number) => {
        setPendingLevelIncrement(increment);
    }, []);

    const clearLevelUpSignal = useCallback(() => {
        setPendingLevelIncrement(0);
    }, []);

    const openActivityLog = useCallback(() => {
        audio.playUiClick();
        setIsActivityLogOpen(true);
    }, []);

    const closeActivityLog = useCallback(() => {
        audio.playUiClick();
        setIsActivityLogOpen(false);
    }, []);

    return (
        <UIContext.Provider value={{ 
            inspectingCard, inspectingLocation, inspectingCurrency, inspectingBox, inspectingReward,
            inspect, closeInspector, storeScrollTarget, setStoreScrollTarget,
            pendingLevelIncrement, signalLevelUp, clearLevelUpSignal,
            isActivityLogOpen, openActivityLog, closeActivityLog
        }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within a UIProvider');
    return context;
};
