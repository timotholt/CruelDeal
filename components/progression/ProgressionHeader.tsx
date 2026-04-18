import React from 'react';
import { PremiumHeaderBase } from '../ui/PremiumHeaderBase';
import { t } from '../../services/localization';

export const ProgressionHeader: React.FC = () => {
    return (
        <PremiumHeaderBase className="pt-1 pb-2 px-1">
            <div className="flex-none flex justify-start items-center gap-1.5 min-w-0">
                <h1 className="text-[1.2rem] font-black text-white tracking-tighter uppercase drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)] whitespace-nowrap italic font-sans leading-none pr-4">
                    {"\u00A0\u00A0"}{t('PROG_COLLECTION_LEVEL')}
                </h1>
            </div>
        </PremiumHeaderBase>
    );
};