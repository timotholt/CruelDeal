
import React from 'react';
import { useUser } from '../../contexts/UserContext';
import { SlantedButton } from './SlantedButton';
import { CreditIcon, GoldIcon, TokenIcon } from './CurrencyIcons';

interface CurrencyDisplayProps {
    onCreditClick?: () => void;
    onGoldClick?: () => void;
    onTokenClick?: () => void;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({ onCreditClick, onGoldClick, onTokenClick }) => {
    const { user } = useUser();

    return (
        /* 
           Using a fixed width (11rem) instead of max-width ensures 
           that the buttons are the exact same size on every screen,
           preventing the "stretching" seen on screens with shorter titles.
        */
        <div className="flex items-center gap-1 w-[11rem] justify-end">
             {/* Credits Button */}
             <SlantedButton 
                variant="blue" 
                size="xs" 
                onClick={onCreditClick}
                className="flex-1 min-w-0"
                icon={<CreditIcon size="xs" />}
             >
                {user.credits}
             </SlantedButton>

             {/* Gold Button */}
             <SlantedButton 
                variant="warning" 
                size="xs" 
                onClick={onGoldClick}
                className="flex-1 min-w-0"
                icon={<GoldIcon size="xs" />}
             >
                {user.gold}
             </SlantedButton>

             {/* Tokens Button */}
             <SlantedButton 
                variant="danger" 
                size="xs" 
                onClick={onTokenClick}
                className="flex-1 min-w-0"
                icon={<TokenIcon size="xs" />}
             >
                {user.tokens}
             </SlantedButton>
        </div>
    );
};
