import { Show } from 'solid-js';
import { CurrencyDisplay } from './CurrencyDisplay';
import { PremiumHeaderBase } from './PremiumHeaderBase';

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
            {/* Left Section - Title Anchored */}
            <div class="flex-none flex justify-start items-center gap-1.5 pr-2">
                {props.leftContent}
                <h1 class="text-[1.4rem] font-black text-white tracking-tighter uppercase drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)] whitespace-nowrap italic font-sans leading-none">
                    {props.title}
                </h1>
            </div>

            {/* Right Section - Currency Modules */}
            <div class="flex-1 flex justify-end items-center gap-1.5">
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
