import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StandardHeader } from '../ui/StandardHeader';
import { StoreResourceItem } from '../store/StoreResourceItem';
import { StoreSection } from '../store/StoreSection';
import { DailyOfferCard } from '../store/DailyOfferCard';
import { StoreOfferDetailOverlay } from '../store/StoreOfferDetailOverlay';
import { StoreOffer } from '../../types';
import { useUser } from '../../contexts/UserContext';
// Added useUI to access storeScrollTarget
import { useUI } from '../../contexts/UIContext';

export const StoreScreen: React.FC = () => {
    const { storeData, isStoreLoading } = useUser();
    // Fixed: Migration of scroll target state from useUser to useUI
    const { storeScrollTarget, setStoreScrollTarget } = useUI();
    const [selectedOffer, setSelectedOffer] = useState<StoreOffer | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleJumpToSection = useCallback((id: string) => {
        const el = document.getElementById(id);
        const container = scrollContainerRef.current;
        if (el && container) {
            const targetTop = el.offsetTop - 8;
            container.scrollTo({ 
                top: targetTop, 
                behavior: 'smooth' 
            });
        }
    }, []);

    useEffect(() => {
        if (storeScrollTarget) {
            const t = setTimeout(() => {
                handleJumpToSection(storeScrollTarget);
                setStoreScrollTarget(null);
            }, 150);
            return () => clearTimeout(t);
        }
    }, [storeScrollTarget, setStoreScrollTarget, handleJumpToSection]);

    const offers = storeData?.offers || [];

    const getCurrencyAmount = (offer: StoreOffer) => {
        const item = offer.contents.find(c => c.type === 'currency');
        if (item && 'amount' in item) return item.amount;
        return 0;
    };

    /**
     * Filter functions - We trust the SERVER'S order, so we just filter by type.
     */
    const featuredOffers = offers.filter(o => o.category === 'featured');
    
    const creditOffers = offers.filter(o => 
        o.category === 'daily' && 
        o.contents.some(c => c.type === 'currency' && c.currencyType === 'credits')
    );
    
    const goldOffers = offers.filter(o => 
        o.category === 'daily' && 
        o.contents.some(c => c.type === 'currency' && c.currencyType === 'gold')
    );
    
    const tokenOffers = offers.filter(o => 
        o.category === 'daily' && 
        o.contents.some(c => c.type === 'currency' && c.currencyType === 'tokens')
    );

    return (
        <div className="w-full h-full flex flex-col bg-transparent overflow-hidden relative">
            <StandardHeader 
                title={"\u00A0\u00A0STORE"} 
                className="!pl-0.5 !pr-1"
                showCurrency={true}
                onCreditClick={() => handleJumpToSection('store-credits')}
                onGoldClick={() => handleJumpToSection('store-gold')}
                onTokenClick={() => handleJumpToSection('store-tokens')}
            />

            <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 pb-32 space-y-10 relative"
            >
                {/* 1. FEATURED SECTION */}
                {featuredOffers.length > 0 && (
                    <StoreSection id="store-featured" title="Featured" colorClass="text-indigo-400">
                        <div className="space-y-4">
                            {featuredOffers.map(offer => (
                                <DailyOfferCard 
                                    key={offer.id}
                                    title={offer.title}
                                    description={offer.description}
                                    price={offer.price}
                                    discount={offer.discountLabel}
                                    backgroundImage={offer.imageUrl}
                                    onClick={() => setSelectedOffer(offer)}
                                />
                            ))}
                        </div>
                    </StoreSection>
                )}

                {/* 2. CREDITS SECTION */}
                <StoreSection id="store-credits" title="Credits" colorClass="text-blue-400">
                    <div className="grid grid-cols-3 gap-2">
                        {creditOffers.map(offer => (
                            <StoreResourceItem 
                                key={offer.id}
                                type="credits"
                                amount={getCurrencyAmount(offer)}
                                costLabel={offer.price}
                                costAmount={offer.priceAmount}
                                costType={offer.priceType as any}
                                offerId={offer.id}
                                availableAt={offer.availableAt}
                            />
                        ))}
                    </div>
                </StoreSection>

                {/* 3. GOLD SECTION */}
                <StoreSection id="store-gold" title="Gold" colorClass="text-amber-400">
                    <div className="grid grid-cols-3 gap-2">
                        {goldOffers.map(offer => (
                            <StoreResourceItem 
                                key={offer.id}
                                type="gold"
                                amount={getCurrencyAmount(offer)}
                                costLabel={offer.price}
                                costAmount={offer.priceAmount}
                                costType={offer.priceType as any}
                                offerId={offer.id}
                            />
                        ))}
                    </div>
                </StoreSection>

                {/* 4. TOKENS SECTION */}
                <StoreSection id="store-tokens" title="Tokens" colorClass="text-red-400">
                    <div className="grid grid-cols-3 gap-2">
                        {tokenOffers.map(offer => (
                            <StoreResourceItem 
                                key={offer.id}
                                type="tokens"
                                amount={getCurrencyAmount(offer)}
                                costLabel={offer.price}
                                costAmount={offer.priceAmount}
                                costType={offer.priceType as any}
                                offerId={offer.id}
                                availableAt={offer.availableAt}
                            />
                        ))}
                    </div>
                </StoreSection>

                {isStoreLoading && (
                    <div className="text-center py-4 animate-pulse">
                        <span className="text-[0.55rem] font-black text-indigo-400/50 uppercase tracking-[0.3em]">Refreshing Market Manifest...</span>
                    </div>
                )}

                <div className="text-center text-[0.55rem] font-bold text-white/10 py-6 uppercase tracking-[0.5em]">
                    End of Transmissions
                </div>
            </div>

            {selectedOffer && (
                <StoreOfferDetailOverlay 
                    offer={selectedOffer} 
                    onClose={() => setSelectedOffer(null)} 
                />
            )}
        </div>
    );
};