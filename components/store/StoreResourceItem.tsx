
import React, { useEffect, useState, useMemo } from 'react';
import { SlantedButton } from '../ui/SlantedButton';
import { GameText } from '../ui/GameText';
import { useUser } from '../../contexts/UserContext';
import { useSynchronizedAction } from '../../hooks/useSynchronizedAction';
import { CreditIcon, GoldIcon, TokenIcon } from '../ui/CurrencyIcons';
import { api } from '../../services/api';
import { t } from '../../services/localization';

interface StoreResourceItemProps {
    type: 'gold' | 'credits' | 'tokens';
    amount: number;
    costLabel: string;
    costAmount?: number;
    // Fix: Expanded costType to include 'tokens' and 'credits' to match possible price types and avoid invalid comparison errors
    costType: 'gold' | 'real' | 'free' | 'tokens' | 'credits';
    offerId?: string;
    availableAt?: string;
}

const SUCCESS_WINDOW = 800; 
const THEATRICAL_RESET_DELAY = 4000; 

export const StoreResourceItem: React.FC<StoreResourceItemProps> = ({ 
    type, amount, costLabel, costAmount, costType, offerId, availableAt 
}) => {
    const { user, storeData, performSynchronizedAction, syncStore } = useUser();
    const [timeLeft, setTimeLeft] = useState<number>(0);

    // Fix: expanded costType union to include tokens and credits
    const isFree = costType === 'free';
    const hasFunds = isFree || costType === 'real' || 
                     (costType === 'gold' && user.gold >= (costAmount || 0)) || 
                     (costType === 'tokens' && user.tokens >= (costAmount || 0)) ||
                     (costType === 'credits' && user.credits >= (costAmount || 0));

    const effectiveAvailableAt = useMemo(() => {
        const userClaimedAt = offerId ? user.lastClaimedDates[offerId] : null;
        if (userClaimedAt) {
            const userTime = new Date(userClaimedAt).getTime();
            const manifestTime = availableAt ? new Date(availableAt).getTime() : 0;
            return userTime > manifestTime ? userClaimedAt : availableAt;
        }
        return availableAt;
    }, [availableAt, user.lastClaimedDates, offerId]);

    useEffect(() => {
        if (!effectiveAvailableAt) return;
        const updateTimer = () => {
            const now = Date.now();
            const target = new Date(effectiveAvailableAt).getTime();
            const diff = Math.max(0, Math.floor((target - now) / 1000));
            setTimeLeft(diff);
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [effectiveAvailableAt]);

    const { status, holdProgress, isHolding, execute, bind } = useSynchronizedAction({
        holdDuration: isFree ? 0 : 800,
        resetDelay: THEATRICAL_RESET_DELAY,
        onAction: async () => {
            if (!hasFunds) {
                syncStore();
                return false;
            }
            if (!offerId) return false;
            
            // Corrected: api call structure
            return await performSynchronizedAction(
                () => api.store.offers.purchase(user.id, offerId, `txn_${Math.random()}`),
                { visualDelay: SUCCESS_WINDOW }
            );
        }
    });

    const isLocked = timeLeft > 0;
    const isSuccess = status === 'success';
    const isProcessing = status === 'processing';

    const isPermanentlyClaimed = useMemo(() => {
        const offer = storeData?.offers.find(o => o.id === offerId);
        return offer?.isOneTime && user.purchasedOfferIds.includes(offerId || '');
    }, [user.purchasedOfferIds, offerId, storeData]);

    const showSuccess = isSuccess || isPermanentlyClaimed;
    
    const colors = type === 'gold' 
        ? { text: 'text-amber-500', bg: 'bg-amber-400/30' } 
        : (type === 'tokens' ? { text: 'text-red-500', bg: 'bg-red-400/30' } : { text: 'text-blue-400', bg: 'bg-blue-400/30' });

    return (
        <div 
            className={`bg-gradient-to-b from-slate-800 via-slate-900 to-black border-2 transition-all duration-300 rounded p-2 flex flex-col items-center justify-between h-[10.5rem] relative overflow-hidden shadow-2xl ${showSuccess ? 'border-emerald-400 ring-2 ring-emerald-500/50 bg-emerald-950' : (isLocked ? 'border-slate-800 grayscale-[0.3]' : 'border-slate-700')}`}
            {...(isFree || isLocked || isPermanentlyClaimed ? {} : bind)}
        >
            {isSuccess && <div className="absolute inset-0 bg-white/20 animate-pulse z-40 pointer-events-none" />}

            {holdProgress > 0 && status === 'idle' && !isLocked && !isPermanentlyClaimed && (
                <div className={`absolute inset-y-0 left-0 z-0 pointer-events-none ${colors.bg}`} style={{ width: `${holdProgress}%` }} />
            )}

            <div className="relative z-10 text-center w-full px-1">
                <div className="h-6 w-full mb-0.5">
                    <GameText text={amount.toLocaleString()} baseFontSize={1.1} className="text-white drop-shadow-md" />
                </div>
                <div className={`text-[0.45rem] font-black uppercase tracking-[0.2em] leading-none ${colors.text}`}>
                    {t(type === 'gold' ? 'STORE_GOLD' : (type === 'tokens' ? 'STORE_TOKENS' : 'STORE_CREDITS'))}
                </div>
            </div>

            <div className="relative z-10 flex-1 flex items-center justify-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${showSuccess ? 'bg-emerald-500 border-emerald-300 scale-110 shadow-[0_0_20px_rgba(16,185,129,0.8)]' : (isLocked ? 'bg-slate-950 border-slate-800 opacity-40' : 'bg-slate-900 border-slate-700')}`}>
                    {showSuccess ? (
                        <svg className="w-7 h-7 text-white animate-pop" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                        type === 'gold' ? <GoldIcon size="md" /> : (type === 'tokens' ? <TokenIcon size="md" /> : <CreditIcon size="md" />)
                    )}
                </div>
            </div>

            <div className="w-full relative z-10">
                <div className="h-3 flex items-center justify-center mb-0.5 overflow-visible">
                    {isHolding && !isLocked && !isPermanentlyClaimed ? (
                         <span className="text-[0.45rem] font-black text-white uppercase tracking-widest animate-pulse drop-shadow-black">
                            {t('UI_HOLD_BUY')}
                         </span>
                    ) : isProcessing ? (
                         <span className="text-[0.45rem] font-black text-cyan-300 uppercase tracking-[0.3em] leading-none animate-pulse drop-shadow-cyan">
                            {t('UI_SYNCING')}
                         </span>
                    ) : showSuccess ? (
                         <span className="text-[0.45rem] font-black text-emerald-400 uppercase tracking-[0.3em] leading-none animate-bounce drop-shadow-emerald">
                            {t('UI_SYNCED')}
                         </span>
                    ) : isLocked ? (
                         <span className="text-[0.45rem] font-black text-slate-500 uppercase tracking-[0.3em] leading-none">Cooldown</span>
                    ) : null}
                </div>

                {isLocked && !showSuccess ? (
                    <div className="h-7 w-full bg-slate-900 border border-slate-700 rounded flex items-center justify-center gap-1.5 grayscale opacity-60">
                         <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         <span className="text-[0.6rem] font-black tabular-nums">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                    </div>
                ) : (
                    <SlantedButton 
                        variant={showSuccess ? 'success' : (type === 'gold' ? 'primary' : (type === 'tokens' ? 'danger' : 'blue'))} 
                        size="sm" 
                        fullWidth
                        onClick={execute}
                        disabled={isProcessing || showSuccess || isLocked}
                    >
                        {isProcessing ? t('UI_SYNCING').toUpperCase() : (showSuccess ? t('UI_SYNCED').toUpperCase() : costLabel)}
                    </SlantedButton>
                )}
            </div>
        </div>
    );
};
