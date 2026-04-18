
import { createContext, useContext, createSignal, JSX } from 'solid-js';
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
    inspectingCard: () => InspectingCard | null;
    inspectingLocation: () => LocationDefinition | null;
    inspectingCurrency: () => { type: 'gold' | 'credits', amount: number } | null;
    inspectingBox: () => BoxReward | null;
    inspectingReward: () => SeasonRewardInfo | null;
    inspect: (item: any, options?: { borderOverride?: string }) => void;
    closeInspector: () => void;
    storeScrollTarget: () => string | null;
    setStoreScrollTarget: (id: string | null) => void;
    // Level Up Flow
    pendingLevelIncrement: () => number;
    signalLevelUp: (increment: number) => void;
    clearLevelUpSignal: () => void;
    // Activity Log Modal
    isActivityLogOpen: () => boolean;
    openActivityLog: () => void;
    closeActivityLog: () => void;
}

const UIContext = createContext<UIContextType>();

export const UIProvider = (props: { children: JSX.Element }) => {
    const [inspectingCard, setInspectingCard] = createSignal<InspectingCard | null>(null);
    const [inspectingLocation, setInspectingLocation] = createSignal<LocationDefinition | null>(null);
    const [inspectingCurrency, setInspectingCurrency] = createSignal<{ type: 'gold' | 'credits', amount: number } | null>(null);
    const [inspectingBox, setInspectingBox] = createSignal<BoxReward | null>(null);
    const [inspectingReward, setInspectingReward] = createSignal<SeasonRewardInfo | null>(null);
    const [storeScrollTarget, setStoreScrollTarget] = createSignal<string | null>(null);
    const [pendingLevelIncrement, setPendingLevelIncrement] = createSignal(0);
    const [isActivityLogOpen, setIsActivityLogOpen] = createSignal(false);

    const inspect = (item: any, options?: { borderOverride?: string }) => {
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
    };

    const closeInspector = () => { 
        setInspectingCard(null); 
        setInspectingLocation(null); 
        setInspectingCurrency(null); 
        setInspectingBox(null); 
        setInspectingReward(null); 
    };

    const signalLevelUp = (increment: number) => {
        setPendingLevelIncrement(increment);
    };

    const clearLevelUpSignal = () => {
        setPendingLevelIncrement(0);
    };

    const openActivityLog = () => {
        audio.playUiClick();
        setIsActivityLogOpen(true);
    };

    const closeActivityLog = () => {
        audio.playUiClick();
        setIsActivityLogOpen(false);
    };

    return (
        <UIContext.Provider value={{ 
            inspectingCard, inspectingLocation, inspectingCurrency, inspectingBox, inspectingReward,
            inspect, closeInspector, storeScrollTarget, setStoreScrollTarget,
            pendingLevelIncrement, signalLevelUp, clearLevelUpSignal,
            isActivityLogOpen, openActivityLog, closeActivityLog
        }}>
            {props.children}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within a UIProvider');
    return context;
};
