import { createSignal, Show, For } from 'solid-js';
import { StoreOffer } from '../../types';
import { SlantedButton } from '../ui/SlantedButton';
import { OfferItemView } from './OfferItemView';
import { useUser } from '../../contexts/UserContext';
import { ModalBackdrop } from '../ui/ModalBackdrop';
import { ModalFooter } from '../ui/ModalFooter';
import { api } from '../../services/api';
import { t } from '../../services/localization';

interface StoreOfferDetailOverlayProps {
    offer: StoreOffer;
    onClose: () => void;
}

export const StoreOfferDetailOverlay = (props: StoreOfferDetailOverlayProps) => {
    const context = useUser();
    
    const [isPurchasing, setIsPurchasing] = createSignal(false);
    const [holdProgress, setHoldProgress] = createSignal(0);
    const [isHolding, setIsHolding] = createSignal(false);
    const [status, setStatus] = createSignal<'idle' | 'success'>('idle');

    const isFree = () => props.offer.priceType === 'free';

    const handlePurchase = async (e?: MouseEvent) => {
        if (e) e.stopPropagation();
        if (status() !== 'idle') return;

        setIsPurchasing(true);
        
        // Use proxy accessor for user.id
        const userId = context.user.id;
        const offerId = props.offer.id;
        const success = await context.performSynchronizedAction(
            () => api.store.offers.purchase(userId, offerId, `txn_${Math.random()}`),
            { visualDelay: 800 }
        );
        
        if (success) {
            setStatus('success');
            setTimeout(() => {
                props.onClose();
            }, 4000);
        } else {
            setIsPurchasing(false);
        }
    };

    return (
        <ModalBackdrop onClose={() => props.onClose()} showCloseHint={status() === 'idle'} blurAmount="lg" class="p-0">
            <div 
                class={`w-full h-full flex flex-col bg-slate-950/40 animate-pop relative ${status() === 'success' ? 'pointer-events-none' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                <Show when={status() === 'success'}>
                    <div class="absolute inset-0 bg-white/10 animate-pulse z-50 pointer-events-none" />
                </Show>

                <div class="relative h-48 shrink-0 overflow-hidden border-b border-slate-800">
                    <img 
                        src={props.offer.imageUrl} 
                        class="absolute inset-0 w-full h-full object-cover opacity-60" 
                        alt="" 
                        referrerPolicy="no-referrer"
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                    
                    <div class="absolute bottom-4 left-6 right-6 z-10">
                        <h1 class="text-3xl font-black text-white italic tracking-tighter uppercase drop-shadow-lg leading-none mb-1">
                            {t(props.offer.title)}
                        </h1>
                        <p class="text-xs text-slate-300 font-medium drop-shadow leading-relaxed">
                            {t(props.offer.description)}
                        </p>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto p-4 space-y-8">
                    <section>
                        <h3 class="text-[0.65rem] font-black text-slate-500 uppercase tracking-widest mb-4">Bundle Contents</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <For each={props.offer.contents}>
                                {(item) => <OfferItemView item={item} />}
                            </For>
                        </div>
                    </section>

                    <section class="pb-12 pt-4"> 
                        <div class="relative group">
                            <div class={`absolute -inset-1 rounded-lg blur opacity-25 transition duration-1000 ${status() === 'success' ? 'bg-emerald-500 opacity-70' : 'bg-gradient-to-r from-emerald-600 to-indigo-600 group-hover:opacity-50'}`} />
                            
                            <div class="h-1 flex items-center justify-center mb-1 overflow-visible pointer-events-none">
                                <Show when={isHolding() && status() === 'idle' && !isFree()}>
                                    <div class="relative font-black text-[0.6rem] uppercase tracking-widest">
                                        <span class="text-slate-600 whitespace-nowrap italic">{t('UI_HOLD_BUY')}</span>
                                        <div 
                                            class="absolute inset-0 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)] whitespace-nowrap overflow-hidden transition-all duration-75 ease-linear italic"
                                            style={{ width: `${holdProgress()}%` }}
                                        >
                                            {t('UI_HOLD_BUY')}
                                        </div>
                                    </div>
                                </Show>
                                <Show when={status() === 'success'}>
                                    <span class="text-[0.7rem] font-black text-emerald-400 uppercase tracking-[0.3em] italic animate-pulse drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]">TRANSACTION AUTHORIZED</span>
                                </Show>
                            </div>

                            <SlantedButton 
                                variant="success" 
                                fullWidth 
                                size="lg" 
                                onClick={handlePurchase}
                                disabled={isPurchasing() || status() === 'success'}
                                holdDuration={isFree() ? 0 : 1000}
                                onHoldChange={setIsHolding}
                                onProgressChange={setHoldProgress}
                            >
                                {status() === 'success' ? t('UI_SYNCED').toUpperCase() : (isPurchasing() ? t('UI_SYNCING').toUpperCase() : props.offer.price)}
                            </SlantedButton>
                        </div>
                        <p class="mt-6 text-[0.6rem] text-slate-500 font-bold text-center uppercase tracking-[0.2em] leading-relaxed whitespace-pre-line">
                            {t('STORE_INSTANT_CREDIT_FOOTER')}
                        </p>
                    </section>
                </div>

                <ModalFooter onClose={() => props.onClose()} />
            </div>
        </ModalBackdrop>
    );
};
