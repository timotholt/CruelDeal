import React from 'react';
import { SeasonProgress } from './SeasonProgress';
import { t } from '../../services/localization';

interface MasteryHeaderProps {
    title?: string;
    level: number;
    progressPercent: number;
    xpText: string;
}

/**
 * MasteryHeader
 * A reusable progress block for showing level and XP/CL advancement.
 */
export const MasteryHeader: React.FC<MasteryHeaderProps> = ({ 
    title,
    level, 
    progressPercent, 
    xpText 
}) => {
    return (
        <div className="shrink-0 pt-2 pb-1 px-2 z-30 flex flex-col items-center w-full">
            <div className="mb-[0.1rem]">
                <span className="text-[0.6rem] font-black text-indigo-50 uppercase tracking-[0.25em] leading-none drop-shadow-[0_0_10px_rgba(165,180,252,0.6)]">
                    {title || t('SEASON_MASTERY')}
                </span>
            </div>
            
            <SeasonProgress 
                level={level}
                progressPercent={progressPercent}
                xpText={xpText}
            />
        </div>
    );
};