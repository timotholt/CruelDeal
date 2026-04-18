import { Show } from 'solid-js';
import { useUser } from '../../contexts/UserContext';
import { useUI } from '../../contexts/UIContext';
import { Portal } from '../ui/Portal';
import { DynamicBackground } from '../ui/DynamicBackground';
import { ModalFooter } from '../ui/ModalFooter';
import { useLevelChaser } from '../../hooks/useLevelChaser';
import { useProgressionTracks } from '../../hooks/useProgressionTracks';
import { useProgressionClaims } from '../../hooks/useProgressionClaims';

// Modular Components
import { ProgressionLoading } from '../progression/ProgressionLoading';
import { ProgressionHeader } from '../progression/ProgressionHeader';
import { RewardView } from '../progression/RewardView';

interface ProgressionScreenProps {
    onClose: () => void;
}

export const ProgressionScreen = (props: ProgressionScreenProps) => {
    const { user, progressionData, isProgressionLoading } = useUser();
    const ui = useUI();
    
    const { visualLevel, visualGain, isTicking, isShifted, lappingIndices, isFlare } = useLevelChaser(
        () => user.level, 
        () => ui.pendingLevelIncrement, 
        ui.clearLevelUpSignal
    );

    const visualTracks = useProgressionTracks(
        visualLevel, 
        () => user.level, 
        progressionData
    );

    const { rewardStates, handleClaimAction } = useProgressionClaims(isTicking);

    const handleManualClose = () => {
        ui.clearLevelUpSignal();
        props.onClose();
    };

    return (
        <Show when={progressionData() || !isProgressionLoading()} fallback={<ProgressionLoading />}>
            <Portal>
                <div class="fixed inset-0 z-[200] flex flex-col items-center justify-start bg-slate-950 overflow-hidden text-white">
                    <DynamicBackground />

                    <div class="w-full h-full max-w-[23rem] flex flex-col relative z-10 overflow-hidden shadow-2xl">
                        <ProgressionHeader />

                        <div class="flex-1 flex flex-col min-h-0 relative z-10 overflow-hidden">
                            <RewardView 
                                visualLevel={visualLevel()}
                                visualGain={visualGain()}
                                isTicking={isTicking()}
                                isShifted={isShifted()}
                                isFlare={isFlare()}
                                visualTracks={visualTracks()}
                                lappingIndices={lappingIndices()}
                                rewardStates={rewardStates as any}
                                onClaim={handleClaimAction}
                            />
                        </div>

                        <ModalFooter onClose={handleManualClose} />
                    </div>
                </div>
            </Portal>
        </Show>
    );
};
