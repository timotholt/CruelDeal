
import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useUI } from '../contexts/UIContext';
import { CardInspector } from './inspector/CardInspector';
import { LocationInspector } from './inspector/LocationInspector';
import { CurrencyInspector } from './inspector/CurrencyInspector';
import { BoxInspector } from './inspector/BoxInspector';
import { SeasonRewardInspector } from './inspector/SeasonRewardInspector';
import { ModalBackdrop } from './ui/ModalBackdrop';

export const InspectorOverlay: React.FC = () => {
    const { user, upgradeCard } = useUser();
    const { 
        inspectingCard, 
        inspectingLocation, 
        inspectingCurrency,
        inspectingBox,
        inspectingReward,
        closeInspector 
    } = useUI();

    const [isInteractionEnabled, setIsInteractionEnabled] = useState(false);

    useEffect(() => {
        const anyActive = inspectingCard || inspectingLocation || inspectingCurrency || inspectingBox || inspectingReward;
        if (anyActive) {
            const timer = setTimeout(() => setIsInteractionEnabled(true), 150);
            return () => clearTimeout(timer);
        } else {
            const timer = setTimeout(() => setIsInteractionEnabled(false), 0);
            return () => clearTimeout(timer);
        }
    }, [inspectingCard, inspectingLocation, inspectingCurrency, inspectingBox, inspectingReward]);

    if (!inspectingCard && !inspectingLocation && !inspectingCurrency && !inspectingBox && !inspectingReward) return null;

    const handleBackgroundClick = () => {
        if (isInteractionEnabled) {
            closeInspector();
        }
    };

    return (
        <ModalBackdrop onClose={handleBackgroundClick}>
            {inspectingReward && <SeasonRewardInspector reward={inspectingReward} />}
            {inspectingBox && <BoxInspector boxType={inspectingBox.boxType} title={inspectingBox.title} description={inspectingBox.description} />}
            {inspectingCard && <CardInspector card={inspectingCard.data} user={user} onUpgrade={upgradeCard} borderOverride={inspectingCard.borderOverride} />}
            {inspectingLocation && <LocationInspector location={inspectingLocation} />}
            {inspectingCurrency && <CurrencyInspector type={inspectingCurrency.type} amount={inspectingCurrency.amount} />}
        </ModalBackdrop>
    );
};
