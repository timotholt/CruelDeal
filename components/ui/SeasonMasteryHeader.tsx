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
export const MasteryHeader = (props: MasteryHeaderProps) => {
    return (
        <div class="shrink-0 pt-2 pb-1 px-2 z-30 flex flex-col items-center w-full">
            <div class="mb-[0.1rem]">
                <span class="text-[0.6rem] font-black text-indigo-5 uppercase tracking-[0.25em] leading-none drop-shadow-[0_0_10px_rgba(165,180,252,0.6)]">
                    {props.title || t('SEASON_MASTERY')}
                </span>
            </div>
            
            <SeasonProgress 
                level={props.level}
                progressPercent={props.progressPercent}
                xpText={props.xpText}
            />
        </div>
    );
};
