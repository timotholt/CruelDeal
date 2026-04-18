import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { useUser } from '../contexts/UserContext';
import { useUI } from '../contexts/UIContext';
import { CardInspector } from './inspector/CardInspector';
import { LocationInspector } from './inspector/LocationInspector';
import { CurrencyInspector } from './inspector/CurrencyInspector';
import { BoxInspector } from './inspector/BoxInspector';
import { SeasonRewardInspector } from './inspector/SeasonRewardInspector';
import { ModalBackdrop } from './ui/ModalBackdrop';

export const InspectorOverlay = () => {
    const { user, upgradeCard } = useUser();
    const { 
        inspectingCard, 
        inspectingLocation, 
        inspectingCurrency,
        inspectingBox,
        inspectingReward,
        closeInspector 
    } = useUI();

    const [isInteractionEnabled, setIsInteractionEnabled] = createSignal(false);

    createEffect(() => {
        const anyActive = !!(inspectingCard() || inspectingLocation() || inspectingCurrency() || inspectingBox() || inspectingReward());
        if (anyActive) {
            const timer = setTimeout(() => setIsInteractionEnabled(true), 150);
            onCleanup(() => clearTimeout(timer));
        } else {
            const timer = setTimeout(() => setIsInteractionEnabled(false), 0);
            onCleanup(() => clearTimeout(timer));
        }
    });

    const handleBackgroundClick = () => {
        if (isInteractionEnabled()) {
            closeInspector();
        }
    };

    return (
        <Show when={inspectingCard() || inspectingLocation() || inspectingCurrency() || inspectingBox() || inspectingReward()}>
            <ModalBackdrop onClose={handleBackgroundClick}>
                <Show when={inspectingReward()}>
                    {(reward) => <SeasonRewardInspector reward={reward()} />}
                </Show>
                <Show when={inspectingBox()}>
                    {(box) => <BoxInspector boxType={box().boxType} title={box().title} description={box().description} />}
                </Show>
                <Show when={inspectingCard()}>
                    {(card) => <CardInspector card={card().data} user={user} onUpgrade={upgradeCard} borderOverride={card().borderOverride} />}
                </Show>
                <Show when={inspectingLocation()}>
                    {(loc) => <LocationInspector location={loc()} />}
                </Show>
                <Show when={inspectingCurrency()}>
                    {(cur) => <CurrencyInspector type={cur().type} amount={cur().amount} />}
                </Show>
            </ModalBackdrop>
        </Show>
    );
};
