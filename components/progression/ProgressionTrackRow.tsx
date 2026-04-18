
import React from 'react';
import { ProgressionTrack } from '../../types';
import { ProgressionHexButton } from './ProgressionHexButton';
import { ProgressionProgressBar } from './ProgressionProgressBar';

interface ProgressionTrackRowProps {
    track: ProgressionTrack;
    isClaiming: boolean;
    isClaimingAll: boolean;
    isSuccess: boolean;
    isGlobalTicking: boolean;
    isLapping?: boolean;
    isNewlyGained?: boolean;
    onClaim: () => void;
    onClaimAll: () => void;
}

const ProgressionTrackRowComponent: React.FC<ProgressionTrackRowProps> = ({
    track,
    isClaiming,
    isClaimingAll,
    isSuccess,
    isGlobalTicking,
    isLapping = false,
    onClaim,
    onClaimAll
}) => {
    return (
        <div 
            className="flex flex-col h-11 px-4 will-change-transform overflow-visible justify-center"
            style={{ contain: 'layout' }} 
        >
            <div className="flex items-center overflow-visible">
                <ProgressionProgressBar 
                    type={track.type}
                    currentXP={track.currentXP}
                    targetXP={track.targetXP}
                    isLapping={isLapping}
                />
                
                <div className="shrink-0 z-20 transition-transform duration-300 ml-[-0.18rem]">
                    <ProgressionHexButton 
                        type={track.type}
                        unclaimedCount={track.unclaimedCount}
                        rewardAmount={track.nextRewardAmount}
                        isClaiming={isClaiming}
                        isClaimingAll={isClaimingAll}
                        isSuccess={isSuccess}
                        isGlobalTicking={isGlobalTicking}
                        onClaim={onClaim}
                        onClaimAll={onClaimAll}
                    />
                </div>
            </div>
        </div>
    );
};

export const ProgressionTrackRow = React.memo(ProgressionTrackRowComponent);
