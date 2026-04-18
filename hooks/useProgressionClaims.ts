
import { useState, useCallback } from 'react';
import { ProgressionRewardType } from '../types';
import { api } from '../services/api';
import { useUser } from '../contexts/UserContext';

export type ClaimState = 'idle' | 'claiming' | 'claiming-all' | 'success';

export const useProgressionClaims = (isTicking: boolean) => {
    const { user, performSynchronizedAction } = useUser();
    const [rewardStates, setRewardStates] = useState<Record<number, ClaimState>>({});

    const handleClaimAction = useCallback(async (type: ProgressionRewardType, idx: number, isBulk: boolean) => {
        if (rewardStates[idx] && rewardStates[idx] !== 'idle') return;
        if (isTicking) return;

        setRewardStates(prev => ({ ...prev, [idx]: isBulk ? 'claiming-all' : 'claiming' }));
        
        // Corrected: api call structure
        const action = isBulk 
            ? () => api.progression.claim(user.id, type, true)
            : () => api.progression.claim(user.id, type, false);

        const success = await performSynchronizedAction(action, { 
            visualDelay: isBulk ? 500 : 300 
        });
        
        if (success) {
            setRewardStates(prev => ({ ...prev, [idx]: 'success' }));
            // Success window duration
            setTimeout(() => {
                setRewardStates(prev => ({ ...prev, [idx]: 'idle' }));
            }, isBulk ? 1000 : 800);
        } else {
            setRewardStates(prev => ({ ...prev, [idx]: 'idle' }));
        }
    }, [rewardStates, user.id, performSynchronizedAction, isTicking]);

    return {
        rewardStates,
        handleClaimAction
    };
};
