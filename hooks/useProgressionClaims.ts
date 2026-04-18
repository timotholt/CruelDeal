import { createStore } from 'solid-js/store';
import { ProgressionRewardType } from '../types';
import { api } from '../services/api';
import { useUser } from '../contexts/UserContext';

export type ClaimState = 'idle' | 'claiming' | 'claiming-all' | 'success';

export const useProgressionClaims = (isTicking: () => boolean) => {
    const userContext = useUser();
    const [rewardStates, setRewardStates] = createStore<Record<number, ClaimState>>({});

    const handleClaimAction = async (type: ProgressionRewardType, idx: number, isBulk: boolean) => {
        if (rewardStates[idx] && rewardStates[idx] !== 'idle') return;
        if (isTicking()) return;

        setRewardStates(idx, isBulk ? 'claiming-all' : 'claiming');
        
        const action = isBulk 
            ? () => api.progression.claim(userContext.user.id, type, true)
            : () => api.progression.claim(userContext.user.id, type, false);

        const success = await userContext.performSynchronizedAction(action, { 
            visualDelay: isBulk ? 500 : 300 
        });
        
        if (success) {
            setRewardStates(idx, 'success');
            setTimeout(() => {
                setRewardStates(idx, 'idle');
            }, isBulk ? 1000 : 800);
        } else {
            setRewardStates(idx, 'idle');
        }
    };

    return {
        rewardStates,
        handleClaimAction
    };
};
