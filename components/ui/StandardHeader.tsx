import React from 'react';
import { CurrencyDisplay } from './CurrencyDisplay';
import { PremiumHeaderBase } from './PremiumHeaderBase';

interface StandardHeaderProps {
    title: string;
    leftContent?: React.ReactNode;
    rightContent?: React.ReactNode;
    showCurrency?: boolean;
    onCreditClick?: () => void;
    onGoldClick?: () => void;
    onTokenClick?: () => void;
    className?: string;
}

export const StandardHeader: React.FC<StandardHeaderProps> = ({ 
    title, 
    leftContent, 
    rightContent,
    showCurrency = false, 
    onCreditClick, 
    onGoldClick,
    onTokenClick,
    className = '' 
}) => {
    return (
        <PremiumHeaderBase 
            className={`pt-1 pb-2 px-1 ${className}`}
            innerClassName="justify-between"
        >
            {/* Left Section - Title Anchored */}
            <div className="flex-none flex justify-start items-center gap-1.5 pr-2">
                {leftContent}
                <h1 className="text-[1.4rem] font-black text-white tracking-tighter uppercase drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)] whitespace-nowrap italic font-sans leading-none">
                    {title}
                </h1>
            </div>

            {/* Right Section - Currency Modules */}
            <div className="flex-1 flex justify-end items-center gap-1.5">
                {rightContent}
                {showCurrency && (
                    <CurrencyDisplay 
                        onCreditClick={onCreditClick} 
                        onGoldClick={onGoldClick}
                        onTokenClick={onTokenClick}
                    />
                )}
            </div>
        </PremiumHeaderBase>
    );
};