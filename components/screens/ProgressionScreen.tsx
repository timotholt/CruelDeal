
import React, { useCallback } from 'react';
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

export const ProgressionScreen: React.FC<ProgressionScreenProps> = ({ onClose }) => {
    const { user, progressionData, isProgressionLoading } = useUser();
    const { pendingLevelIncrement, clearLevelUpSignal } = useUI();
    
    const { visualLevel, visualGain, isTicking, isShifted, lappingIndices, isFlare } = useLevelChaser(
        user.level, 
        pendingLevelIncrement, 
        clearLevelUpSignal
    );

    const visualTracks = useProgressionTracks(
        visualLevel, 
        user.level, 
        progressionData
    );

    const { rewardStates, handleClaimAction } = useProgressionClaims(isTicking);

    const handleManualClose = useCallback(() => {
        clearLevelUpSignal();
        onClose();
    }, [clearLevelUpSignal, onClose]);

    if (!progressionData && isProgressionLoading) {
        return <ProgressionLoading />;
    }

    return (
        <Portal>
            <div className="fixed inset-0 z-[200] flex flex-col items-center justify-start bg-slate-950 overflow-hidden">
                <DynamicBackground />

                <div className="w-full h-full max-w-[23rem] flex flex-col relative z-10 overflow-hidden shadow-2xl">
                    <ProgressionHeader />

                    <div className="flex-1 flex flex-col min-h-0 relative z-10 overflow-hidden">
                        <RewardView 
                            visualLevel={visualLevel}
                            visualGain={visualGain}
                            isTicking={isTicking}
                            isShifted={isShifted}
                            isFlare={isFlare}
                            visualTracks={visualTracks}
                            lappingIndices={lappingIndices}
                            rewardStates={rewardStates as any}
                            onClaim={handleClaimAction}
                        />
                    </div>

                    <ModalFooter onClose={handleManualClose} />
                </div>
            </div>
        </Portal>
    );
};
