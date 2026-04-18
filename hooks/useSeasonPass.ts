import { createSignal, createEffect, onCleanup, createMemo } from 'solid-js';
import { useUser } from '../contexts/UserContext';

export const useSeasonPass = () => {
    const userContext = useUser();
    const [timeLeft, setTimeLeft] = createSignal({ dd: '00', hh: '00', mm: '00', ss: '00' });

    createEffect(() => {
        const data = userContext.seasonPassData();
        if (!data?.endDate) return;

        const updateTimer = () => {
            const now = new Date().getTime();
            const distance = new Date(data.endDate).getTime() - now;

            if (distance < 0) {
                setTimeLeft({ dd: '00', hh: '00', mm: '00', ss: '00' });
                return;
            }

            setTimeLeft({
                dd: String(Math.floor(distance / (1000 * 60 * 60 * 24))).padStart(2, '0'),
                hh: String(Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))).padStart(2, '0'),
                mm: String(Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0'),
                ss: String(Math.floor((distance % (1000 * 60)) / 1000)).padStart(2, '0')
            });
        };

        const interval = setInterval(updateTimer, 1000);
        updateTimer();
        onCleanup(() => clearInterval(interval));
    });

    const progress = createMemo(() => {
        const u = userContext.user;
        const data = userContext.seasonPassData();
        if (!u || !data) {
            return { currentLevel: 1, currentXP: 0, targetXP: 1000, percent: 0 };
        }
        
        const seasonId = data.id;
        const seasonData = u.seasonProgress?.[seasonId] || { level: 1, xp: 0 };
        
        const currentXP = seasonData.xp; 
        const targetXP = 1000;
        const percent = Math.min(100, (currentXP / targetXP) * 100);

        return {
            currentLevel: seasonData.level,
            currentXP,
            targetXP,
            percent
        };
    });

    return {
        user: () => userContext.user,
        seasonPassData: userContext.seasonPassData,
        isSeasonLoading: userContext.isSeasonLoading,
        timeLeft,
        progress,
        actions: {
            syncSeasonPass: userContext.syncSeasonPass,
            debugSwitchSeason: userContext.debugSwitchSeason
        }
    };
};
