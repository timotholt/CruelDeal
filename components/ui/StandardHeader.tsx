import { Show } from 'solid-js';
import { CurrencyDisplay } from './CurrencyDisplay';
import { PremiumHeaderBase } from './PremiumHeaderBase';
import { GameTextV3 as GameText } from './GameTextV3';

interface StandardHeaderProps {
    title: string;
    leftContent?: any;
    rightContent?: any;
    showCurrency?: boolean;
    onCreditClick?: () => void;
    onGoldClick?: () => void;
    onTokenClick?: () => void;
    class?: string;
}

export const StandardHeader = (props: StandardHeaderProps) => {
    return (
        <PremiumHeaderBase 
            class={`pt-1 pb-2 px-1 ${props.class || ''}`}
            innerClass="justify-between"
        >
            {/* Left Section - Flexible Title */}
            <div class="flex-1 min-w-0 flex justify-start items-center gap-1.5 pr-2">
                {props.leftContent}
                <div class="h-6 flex-1 min-w-0 flex items-center">
                    <GameText 
                        text={props.title}
                        baseFontSize={1.4}
                        maxScale={1}
                        minScale={0.5}
                        align="left"
                        class="text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)] !font-sans uppercase italic"
                    />
                </div>
            </div>

            {/* Right Section - Currency Modules (Anchored) */}
            <div class="flex-none flex justify-end items-center gap-1.5">
                {props.rightContent}
                <Show when={props.showCurrency}>
                    <CurrencyDisplay 
                        onCreditClick={props.onCreditClick} 
                        onGoldClick={props.onGoldClick}
                        onTokenClick={props.onTokenClick}
                    />
                </Show>
            </div>
        </PremiumHeaderBase>
    );
};
