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
    onClaim: () => void;
    onClaimAll: () => void;
}

export const ProgressionTrackRow = (props: ProgressionTrackRowProps) => {
    return (
        <div 
            class="flex flex-col h-11 px-4 will-change-transform overflow-visible justify-center"
            style={{ contain: 'layout' }} 
        >
            <div class="flex items-center overflow-visible">
                <ProgressionProgressBar 
                    type={props.track.type}
                    currentXP={props.track.currentXP}
                    targetXP={props.track.targetXP}
                    isLapping={props.isLapping || false}
                />
                
                <div class="shrink-0 z-20 transition-transform duration-300 ml-[-0.18rem]">
                    <ProgressionHexButton 
                        type={props.track.type}
                        unclaimedCount={props.track.unclaimedCount}
                        rewardAmount={props.track.nextRewardAmount}
                        isClaiming={props.isClaiming}
                        isClaimingAll={props.isClaimingAll}
                        isSuccess={props.isSuccess}
                        isGlobalTicking={props.isGlobalTicking}
                        onClaim={props.onClaim}
                        onClaimAll={props.onClaimAll}
                    />
                </div>
            </div>
        </div>
    );
};
