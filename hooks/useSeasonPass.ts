
import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../contexts/UserContext';

export const useSeasonPass = () => {
    const { user, seasonPassData, isSeasonLoading, syncSeasonPass, debugSwitchSeason } = useUser();
    const [timeLeft, setTimeLeft] = useState({ dd: '00', hh: '00', mm: '00', ss: '00' });

    // 1. Timer Logic
    useEffect(() => {
        if (!seasonPassData?.endDate) return;

        const updateTimer = () => {
            const now = new Date().getTime();
            const distance = new Date(seasonPassData.endDate).getTime() - now;

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
        return () => clearInterval(interval);
    }, [seasonPassData]);

    // 2. High-Precision Progress Logic - Fully Synced with specific season ID
    const progress = useMemo(() => {
        if (!user || !seasonPassData) {
            return { currentLevel: 1, currentXP: 0, targetXP: 1000, percent: 0 };
        }
        
        // Determine user level for THIS specific season
        const seasonId = seasonPassData.id;
        const seasonData = user.seasonProgress[seasonId] || { level: 1, xp: 0 };
        
        const currentXP = seasonData.xp; 
        const targetXP = 1000;
        const percent = Math.min(100, (currentXP / targetXP) * 100);

        return {
            currentLevel: seasonData.level,
            currentXP,
            targetXP,
            percent
        };
    }, [user, seasonPassData]);

    return {
        user,
        seasonPassData,
        isSeasonLoading,
        timeLeft,
        progress,
        actions: {
            syncSeasonPass,
            debugSwitchSeason
        }
    };
};
