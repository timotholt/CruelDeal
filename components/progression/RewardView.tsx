import { For } from 'solid-js';
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

export const RewardView = (props: RewardViewProps) => {
    return (
        <div class="flex-1 flex flex-col min-h-0 pt-1">
            {/* The animated CL counter */}
            <LevelHero 
                level={props.visualLevel} 
                gain={props.visualGain} 
                isTicking={props.isTicking} 
                isShifted={props.isShifted}
                isFlare={props.isFlare} 
            />
            
            {/* Decorative Divider */}
            <div class="px-6 mb-2">
                <div class="h-px w-full bg-white/20 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
            </div>

            {/* Scrollable/Layout area for the 5 parallel tracks */}
            <div class="flex-1 flex flex-col justify-around px-2 pb-4 overflow-hidden">
                <For each={props.visualTracks}>
                    {(track, idx) => (
                        <ProgressionTrackRow 
                            track={track}
                            isClaiming={props.rewardStates[idx()] === 'claiming'}
                            isClaimingAll={props.rewardStates[idx()] === 'claiming-all'}
                            isSuccess={props.rewardStates[idx()] === 'success'}
                            isGlobalTicking={props.isTicking}
                            isLapping={props.lappingIndices.has(idx())}
                            onClaim={() => props.onClaim(track.type, idx(), false)}
                            onClaimAll={() => props.onClaim(track.type, idx(), true)}
                        />
                    )}
                </For>
            </div>
        </div>
    );
};
