import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import { StandardHeader } from '../ui/StandardHeader';
import { StoreResourceItem } from '../store/StoreResourceItem';
import { StoreSection } from '../store/StoreSection';
import { DailyOfferCard } from '../store/DailyOfferCard';
import { StoreOfferDetailOverlay } from '../store/StoreOfferDetailOverlay';
import { StoreOffer } from '../../types';
import { useUser } from '../../contexts/UserContext';
import { useUI } from '../../contexts/UIContext';

export const StoreScreen = () => {
    const { storeData, isStoreLoading } = useUser();
    const ui = useUI();
    const [selectedOffer, setSelectedOffer] = createSignal<StoreOffer | null>(null);
    let scrollContainerRef: HTMLDivElement | undefined;

    const handleJumpToSection = (id: string) => {
        const el = document.getElementById(id);
        const container = scrollContainerRef;
        if (el && container) {
            const targetTop = el.offsetTop - 8;
            container.scrollTo({ 
                top: targetTop, 
                behavior: 'smooth' 
            });
        }
    };

    createEffect(() => {
        const target = ui.storeScrollTarget;
        if (target) {
            const t = setTimeout(() => {
                handleJumpToSection(target);
                ui.setStoreScrollTarget(null);
            }, 150);
            onCleanup(() => clearTimeout(t));
        }
    });

    const offers = () => storeData()?.offers || [];

    createEffect(() => {
        console.log("StoreScreen: offers loaded:", offers().length, "IsLoading:", isStoreLoading());
    });

    const getCurrencyAmount = (offer: StoreOffer) => {
        const item = offer.contents.find(c => c.type === 'currency');
        if (item && 'amount' in item) return item.amount;
        return 0;
    };

    const featuredOffers = () => offers().filter(o => o.category === 'featured');
    
    const creditOffers = () => offers().filter(o => 
        o.category === 'daily' && 
        o.contents.some(c => c.type === 'currency' && c.currencyType === 'credits')
    );
    
    const goldOffers = () => offers().filter(o => 
        o.category === 'daily' && 
        o.contents.some(c => c.type === 'currency' && c.currencyType === 'gold')
    );
    
    const tokenOffers = () => offers().filter(o => 
        o.category === 'daily' && 
        o.contents.some(c => c.type === 'currency' && c.currencyType === 'tokens')
    );

    return (
        <div class="w-full h-full flex flex-col bg-transparent overflow-hidden relative">
            <StandardHeader 
                title={"\u00A0\u00A0STORE"} 
                class="!pl-0.5 !pr-1"
                showCurrency={true}
                onCreditClick={() => handleJumpToSection('store-credits')}
                onGoldClick={() => handleJumpToSection('store-gold')}
                onTokenClick={() => handleJumpToSection('store-tokens')}
            />

            <div 
                ref={(el) => scrollContainerRef = el}
                class="flex-1 overflow-y-auto p-4 pb-32 space-y-10 relative"
            >
                {/* 1. FEATURED SECTION */}
                <Show when={featuredOffers().length > 0}>
                    <StoreSection id="store-featured" title="Featured" colorClass="text-indigo-400">
                        <div class="space-y-4">
                            <For each={featuredOffers()}>
                                {(offer) => (
                                    <DailyOfferCard 
                                        title={offer.title}
                                        description={offer.description}
                                        price={offer.price}
                                        discount={offer.discountLabel}
                                        backgroundImage={offer.imageUrl}
                                        onClick={() => setSelectedOffer(offer)}
                                    />
                                )}
                            </For>
                        </div>
                    </StoreSection>
                </Show>

                {/* 2. CREDITS SECTION */}
                <StoreSection id="store-credits" title="Credits" colorClass="text-blue-400">
                    <div class="grid grid-cols-3 gap-2">
                        <For each={creditOffers()}>
                            {(offer) => (
                                <StoreResourceItem 
                                    type="credits"
                                    amount={getCurrencyAmount(offer)}
                                    costLabel={offer.price}
                                    costAmount={offer.priceAmount}
                                    costType={offer.priceType as any}
                                    offerId={offer.id}
                                    availableAt={offer.availableAt}
                                />
                            )}
                        </For>
                    </div>
                </StoreSection>

                {/* 3. GOLD SECTION */}
                <StoreSection id="store-gold" title="Gold" colorClass="text-amber-400">
                    <div class="grid grid-cols-3 gap-2">
                        <For each={goldOffers()}>
                            {(offer) => (
                                <StoreResourceItem 
                                    type="gold"
                                    amount={getCurrencyAmount(offer)}
                                    costLabel={offer.price}
                                    costAmount={offer.priceAmount}
                                    costType={offer.priceType as any}
                                    offerId={offer.id}
                                />
                            )}
                        </For>
                    </div>
                </StoreSection>

                {/* 4. TOKENS SECTION */}
                <StoreSection id="store-tokens" title="Tokens" colorClass="text-red-400">
                    <div class="grid grid-cols-3 gap-2">
                        <For each={tokenOffers()}>
                            {(offer) => (
                                <StoreResourceItem 
                                    type="tokens"
                                    amount={getCurrencyAmount(offer)}
                                    costLabel={offer.price}
                                    costAmount={offer.priceAmount}
                                    costType={offer.priceType as any}
                                    offerId={offer.id}
                                    availableAt={offer.availableAt}
                                />
                            )}
                        </For>
                    </div>
                </StoreSection>

                <Show when={isStoreLoading()}>
                    <div class="text-center py-4 animate-pulse">
                        <span class="text-[0.55rem] font-black text-indigo-400/50 uppercase tracking-[0.3em]">Refreshing Market Manifest...</span>
                    </div>
                </Show>

                <div class="text-center text-[0.55rem] font-bold text-white/10 py-6 uppercase tracking-[0.5em]">
                    End of Transmissions
                </div>
            </div>

            <Show when={selectedOffer()}>
                <StoreOfferDetailOverlay 
                    offer={selectedOffer()!} 
                    onClose={() => setSelectedOffer(null)} 
                />
            </Show>
        </div>
    );
};
