import { createSignal, createMemo, onCleanup, Show, onMount } from 'solid-js';
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
    costType: 'gold' | 'real' | 'free' | 'tokens' | 'credits';
    offerId?: string;
    availableAt?: string;
}

const SUCCESS_WINDOW = 800; 
const THEATRICAL_RESET_DELAY = 4000; 

export const StoreResourceItem = (props: StoreResourceItemProps) => {
    const user = useUser();
    const [timeLeft, setTimeLeft] = createSignal<number>(0);

    const isFree = () => props.costType === 'free';
    const hasFunds = () => isFree() || props.costType === 'real' || 
                      (props.costType === 'gold' && user.user.gold >= (props.costAmount || 0)) || 
                      (props.costType === 'tokens' && user.user.tokens >= (props.costAmount || 0)) ||
                      (props.costType === 'credits' && user.user.credits >= (props.costAmount || 0));

    const effectiveAvailableAt = createMemo(() => {
        const userClaimedAt = props.offerId ? user.user.lastClaimedDates[props.offerId] : null;
        if (userClaimedAt) {
            const userTime = new Date(userClaimedAt).getTime();
            const manifestTime = props.availableAt ? new Date(props.availableAt).getTime() : 0;
            return userTime > manifestTime ? userClaimedAt : props.availableAt;
        }
        return props.availableAt;
    });

    onMount(() => {
        const updateTimer = () => {
            const now = Date.now();
            const available = effectiveAvailableAt();
            if (!available) return;
            const target = new Date(available).getTime();
            const diff = Math.max(0, Math.floor((target - now) / 1000));
            setTimeLeft(diff);
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        onCleanup(() => clearInterval(interval));
    });

    const action = useSynchronizedAction({
        holdDuration: isFree() ? 0 : 800,
        resetDelay: THEATRICAL_RESET_DELAY,
        onAction: async () => {
            if (!hasFunds()) {
                user.syncStore();
                return false;
            }
            const userId = user.user.id;
            const offerId = props.offerId;
            if (!offerId) return false;
            
            const success = await user.performSynchronizedAction(
                () => api.store.offers.purchase(userId, offerId, `txn_${Math.random()}`),
                { visualDelay: SUCCESS_WINDOW }
            );

            return success;
        }
    });

    const isLocked = () => timeLeft() > 0;
    const isSuccess = () => action.status() === 'success';
    const isProcessing = () => action.status() === 'processing';

    const isPermanentlyClaimed = createMemo(() => {
        const offer = user.storeData()?.offers.find(o => o.id === props.offerId);
        return offer?.isOneTime && user.user.purchasedOfferIds.includes(props.offerId || '');
    });

    const showSuccess = () => isSuccess() || isPermanentlyClaimed();
    
    const colors = () => props.type === 'gold' 
        ? { text: 'text-amber-500', bg: 'bg-amber-400/30' } 
        : (props.type === 'tokens' ? { text: 'text-red-500', bg: 'bg-red-400/30' } : { text: 'text-blue-400', bg: 'bg-blue-400/30' });

    return (
        <div 
            class={`bg-gradient-to-b from-slate-800 via-slate-900 to-black border-2 transition-all duration-300 rounded p-2 flex flex-col items-center justify-between h-[10.5rem] relative overflow-hidden shadow-2xl ${showSuccess() ? 'border-emerald-400 ring-2 ring-emerald-500/50 bg-emerald-950' : (isLocked() ? 'border-slate-800 grayscale-[0.3]' : 'border-slate-700')}`}
            {...(isFree() || isLocked() || isPermanentlyClaimed() ? {} : action.bind)}
        >
            <Show when={isSuccess()}>
                <div class="absolute inset-0 bg-white/20 animate-pulse z-40 pointer-events-none" />
            </Show>

            <Show when={action.holdProgress() > 0 && action.status() === 'idle' && !isLocked() && !isPermanentlyClaimed()}>
                <div class={`absolute inset-y-0 left-0 z-0 pointer-events-none ${colors().bg}`} style={{ width: `${action.holdProgress()}%` }} />
            </Show>

            <div class="relative z-10 text-center w-full px-1">
                <div class="h-6 w-full mb-0.5">
                    <GameText text={props.amount.toLocaleString()} baseFontSize={1.1} class="text-white drop-shadow-md" />
                </div>
                <div class={`text-[0.45rem] font-black uppercase tracking-[0.2em] leading-none ${colors().text}`}>
                    {t(props.type === 'gold' ? 'STORE_GOLD' : (props.type === 'tokens' ? 'STORE_TOKENS' : 'STORE_CREDITS'))}
                </div>
            </div>

            <div class="relative z-10 flex-1 flex items-center justify-center">
                <div class={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${showSuccess() ? 'bg-emerald-500 border-emerald-300 scale-110 shadow-[0_0_20px_rgba(16,185,129,0.8)]' : (isLocked() ? 'bg-slate-950 border-slate-800 opacity-40' : 'bg-slate-900 border-slate-700')}`}>
                    <Show when={showSuccess()} fallback={
                        props.type === 'gold' ? <GoldIcon size="md" /> : (props.type === 'tokens' ? <TokenIcon size="md" /> : <CreditIcon size="md" />)
                    }>
                        <svg class="w-7 h-7 text-white animate-pop" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={4} d="M5 13l4 4L19 7" /></svg>
                    </Show>
                </div>
            </div>

            <div class="w-full relative z-10">
                <div class="h-3 flex items-center justify-center mb-0.5 overflow-visible">
                    <Show when={action.isHolding() && !isLocked() && !isPermanentlyClaimed()}>
                        <span class="text-[0.45rem] font-black text-white uppercase tracking-widest animate-pulse drop-shadow-black">
                            {t('UI_HOLD_BUY')}
                        </span>
                    </Show>
                    <Show when={isProcessing()}>
                         <span class="text-[0.45rem] font-black text-cyan-300 uppercase tracking-[0.3em] leading-none animate-pulse drop-shadow-cyan">
                            {t('UI_SYNCING')}
                         </span>
                    </Show>
                    <Show when={showSuccess() && !isPermanentlyClaimed() /* Only bounce if just happened */}>
                         <span class="text-[0.45rem] font-black text-emerald-400 uppercase tracking-[0.3em] leading-none animate-bounce drop-shadow-emerald">
                            {t('UI_SYNCED')}
                         </span>
                    </Show>
                    <Show when={isLocked()}>
                         <span class="text-[0.45rem] font-black text-slate-500 uppercase tracking-[0.3em] leading-none">Cooldown</span>
                    </Show>
                </div>

                <Show when={isLocked() && !showSuccess()} fallback={
                    <SlantedButton 
                        variant={showSuccess() ? 'success' : (props.type === 'gold' ? 'primary' : (props.type === 'tokens' ? 'danger' : 'blue'))} 
                        size="sm" 
                        fullWidth
                        onClick={() => action.execute()}
                        disabled={isProcessing() || showSuccess() || isLocked()}
                    >
                        {isProcessing() ? t('UI_SYNCING').toUpperCase() : (showSuccess() ? t('UI_SYNCED').toUpperCase() : props.costLabel)}
                    </SlantedButton>
                }>
                    <div class="h-7 w-full bg-slate-900 border border-slate-700 rounded flex items-center justify-center gap-1.5 grayscale opacity-60">
                         <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         <span class="text-[0.6rem] font-black tabular-nums">{Math.floor(timeLeft() / 60)}:{(timeLeft() % 60).toString().padStart(2, '0')}</span>
                    </div>
                </Show>
            </div>
        </div>
    );
};
