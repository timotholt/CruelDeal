import { createEffect } from 'solid-js';
import { useUser } from '../../contexts/UserContext';
import { SlantedButton } from './SlantedButton';
import { CreditIcon, GoldIcon, TokenIcon } from './CurrencyIcons';

interface CurrencyDisplayProps {
    onCreditClick?: () => void;
    onGoldClick?: () => void;
    onTokenClick?: () => void;
}

export const CurrencyDisplay = (props: CurrencyDisplayProps) => {
    const userContext = useUser();

    createEffect(() => {
        console.log("CurrencyDisplay: rendering with credits:", userContext.user.credits);
    });

    return (
        /* 
           Using a fixed width (11rem) instead of max-width ensures 
           that the buttons are the exact same size on every screen,
           preventing the "stretching" seen on screens with shorter titles.
        */
        <div class="flex items-center gap-1 w-[11rem] justify-end">
             {/* Credits Button */}
             <SlantedButton 
                variant="blue" 
                size="xs" 
                onClick={() => props.onCreditClick?.()}
                class="flex-1 min-w-[3.2rem]"
                icon={<CreditIcon size="xs" />}
             >
                {String(userContext.user.credits)}
             </SlantedButton>

             {/* Gold Button */}
             <SlantedButton 
                variant="warning" 
                size="xs" 
                onClick={() => props.onGoldClick?.()}
                class="flex-1 min-w-[3.2rem]"
                icon={<GoldIcon size="xs" />}
             >
                {String(userContext.user.gold)}
             </SlantedButton>

             {/* Tokens Button */}
             <SlantedButton 
                variant="danger" 
                size="xs" 
                onClick={() => props.onTokenClick?.()}
                class="flex-1 min-w-[3.2rem]"
                icon={<TokenIcon size="xs" />}
             >
                {String(userContext.user.tokens)}
             </SlantedButton>
        </div>
    );
};
