
import React from 'react';
import { ProgressionTrack } from '../../types';
import { LevelHero } from './LevelHero';
import { ProgressionTrackRow } from './ProgressionTrackRow';

interface RewardViewProps {
    visualLevel: number;
    visualGain: number;
    isTicking: boolean;
    isShifted: boolean;
    isFlare: boolean;
    visualTracks: ProgressionTrack[];
    lappingIndices: Set<number>;
    rewardStates: Record<number, 'idle' | 'claiming' | 'claiming-all' | 'success'>;
    onClaim: (type: any, idx: number, isBulk: boolean) => void;
}

const RewardViewComponent: React.FC<RewardViewProps> = ({
    visualLevel, visualGain, isTicking, isShifted, isFlare, visualTracks, lappingIndices, rewardStates, onClaim
}) => {
    return (
        <div className="flex-1 flex flex-col min-h-0 pt-1">
            {/* The animated CL counter */}
            <LevelHero 
                level={visualLevel} 
                gain={visualGain} 
                isTicking={isTicking} 
                isShifted={isShifted}
                isFlare={isFlare} 
            />
            
            {/* Decorative Divider */}
            <div className="px-6 mb-2">
                <div className="h-px w-full bg-white/20 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
            </div>

            {/* Scrollable/Layout area for the 5 parallel tracks */}
            <div className="flex-1 flex flex-col justify-around px-2 pb-4 overflow-hidden">
                {visualTracks.map((track, idx) => (
                    <ProgressionTrackRow 
                        key={`${track.type}-${idx}`}
                        track={track}
                        isClaiming={rewardStates[idx] === 'claiming'}
                        isClaimingAll={rewardStates[idx] === 'claiming-all'}
                        isSuccess={rewardStates[idx] === 'success'}
                        isGlobalTicking={isTicking}
                        isLapping={lappingIndices.has(idx)}
                        onClaim={() => onClaim(track.type, idx, false)}
                        onClaimAll={() => onClaim(track.type, idx, true)}
                    />
                ))}
            </div>
        </div>
    );
};

export const RewardView = React.memo(RewardViewComponent);
