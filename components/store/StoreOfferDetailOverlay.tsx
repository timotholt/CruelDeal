
import React, { useState, useEffect } from 'react';
import { StoreOffer } from '../../types';
import { SlantedButton } from '../ui/SlantedButton';
import { OfferItemView } from './OfferItemView';
import { useUser } from '../../contexts/UserContext';
import { audio } from '../../services/audio';
import { ModalBackdrop } from '../ui/ModalBackdrop';
import { ModalFooter } from '../ui/ModalFooter';
import { api } from '../../services/api';
import { t } from '../../services/localization';

interface StoreOfferDetailOverlayProps {
    offer: StoreOffer;
    onClose: () => void;
}

export const StoreOfferDetailOverlay: React.FC<StoreOfferDetailOverlayProps> = ({ offer, onClose }) => {
    const context = useUser();
    
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [holdProgress, setHoldProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success'>('idle');

    const isFree = offer.priceType === 'free';

    useEffect(() => {
        if (status === 'success') {
            audio.play('sfx_victory', 0.6);
        }
    }, [status]);

    const handlePurchase = async (e: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (status !== 'idle') return;

        setIsPurchasing(true);
        
        // Corrected: api call structure
        const success = await context.performSynchronizedAction(
            () => api.store.offers.purchase(context.user.id, offer.id, `txn_${Math.random()}`),
            { visualDelay: 800 }
        );
        
        if (success) {
            setStatus('success');
            setTimeout(() => {
                onClose();
            }, 4000);
        } else {
            setIsPurchasing(false);
        }
    };

    return (
        <ModalBackdrop onClose={onClose} showCloseHint={status === 'idle'} blurAmount="lg" className="p-0">
            <div 
                className={`w-full h-full flex flex-col bg-slate-950/40 animate-pop relative ${status === 'success' ? 'pointer-events-none' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                {status === 'success' && (
                    <div className="absolute inset-0 bg-white/10 animate-pulse z-50 pointer-events-none" />
                )}

                <div className="relative h-48 shrink-0 overflow-hidden border-b border-slate-800">
                    <img src={offer.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                    
                    <div className="absolute bottom-4 left-6 right-6 z-10">
                        <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase drop-shadow-lg leading-none mb-1">
                            {t(offer.title)}
                        </h1>
                        <p className="text-xs text-slate-300 font-medium drop-shadow leading-relaxed">
                            {t(offer.description)}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-8">
                    <section>
                        <h3 className="text-[0.65rem] font-black text-slate-500 uppercase tracking-widest mb-4">Bundle Contents</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {offer.contents.map((item, idx) => (
                                <OfferItemView key={idx} item={item} />
                            ))}
                        </div>
                    </section>

                    <section className="pb-12 pt-4"> 
                        <div className="relative group">
                            <div className={`absolute -inset-1 rounded-lg blur opacity-25 transition duration-1000 ${status === 'success' ? 'bg-emerald-500 opacity-70' : 'bg-gradient-to-r from-emerald-600 to-indigo-600 group-hover:opacity-50'}`}></div>
                            
                            <div className="h-1 flex items-center justify-center mb-1 overflow-visible pointer-events-none">
                                {isHolding && status === 'idle' && !isFree && (
                                    <div className="relative font-black text-[0.6rem] uppercase tracking-widest">
                                        <span className="text-slate-600 whitespace-nowrap italic">{t('UI_HOLD_BUY')}</span>
                                        <div 
                                            className="absolute inset-0 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)] whitespace-nowrap overflow-hidden transition-all duration-75 ease-linear italic"
                                            style={{ width: `${holdProgress}%` }}
                                        >
                                            {t('UI_HOLD_BUY')}
                                        </div>
                                    </div>
                                )}
                                {status === 'success' && (
                                    <span className="text-[0.7rem] font-black text-emerald-400 uppercase tracking-[0.3em] italic animate-pulse drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]">TRANSACTION AUTHORIZED</span>
                                )}
                            </div>

                            <SlantedButton 
                                variant={status === 'success' ? 'success' : 'success'} 
                                fullWidth 
                                size="lg" 
                                onClick={handlePurchase}
                                disabled={isPurchasing || status === 'success'}
                                holdDuration={isFree ? 0 : 1000}
                                onHoldChange={setIsHolding}
                                onProgressChange={setHoldProgress}
                            >
                                {status === 'success' ? t('UI_SYNCED').toUpperCase() : (isPurchasing ? t('UI_SYNCING').toUpperCase() : offer.price)}
                            </SlantedButton>
                        </div>
                        <p className="mt-6 text-[0.6rem] text-slate-500 font-bold text-center uppercase tracking-[0.2em] leading-relaxed whitespace-pre-line">
                            {t('STORE_INSTANT_CREDIT_FOOTER')}
                        </p>
                    </section>
                </div>

                <ModalFooter onClose={onClose} />
            </div>
        </ModalBackdrop>
    );
};
