import { createEffect, onCleanup, For } from 'solid-js';
import { useUser } from '../../contexts/UserContext';
import { SlantedButton } from '../ui/SlantedButton';
import { GameTextV3 as GameText } from '../ui/GameTextV3';
import { audio } from '../../services/audio';

interface DeckSelectorProps {
    activeDeckId: number;
    onSelectDeck: (id: number) => void;
}

const getRelativeTimeString = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    if (diffInMins < 1) return 'just now';
    if (diffInMins < 60) return `${diffInMins} ${diffInMins === 1 ? 'minute' : 'minutes'} ago`;
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    if (diffInHours < 24) return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks === 1) return 'a week ago';
    if (diffInWeeks < 4) return `${diffInWeeks} weeks ago`;
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths === 1) return 'a month ago';
    if (diffInMonths < 12) return `${diffInMonths} months ago`;
    return 'a long time ago';
};

/**
 * DECK SELECTOR 3D
 * Cylindrical drum interface for high-performance deck selection.
 */
export const DeckSelector3D = (props: DeckSelectorProps) => {
    const user = useUser();
    const deckIds = () => Object.keys(user.user.decks).map(Number).sort((a, b) => a - b);
    const count = () => deckIds().length;
    const angleStep = () => 360 / Math.max(1, count());
    const radius = 110;

    let drumRef: HTMLDivElement | undefined;
    const itemsRef: (HTMLDivElement | null)[] = [];
    
    let rotation = 0; // Initialize in effect
    let velocity = 0;
    let isDragging = false;
    let lastPointerY = 0;
    let lastTime = 0;
    let requestId: number | null = null;
    
    let lastCenteredIndex = -1;
    let lastTickStep = -1;
    let lastAudioTime = 0;
    let canPlayAudio = true;

    const updateDom = (rot: number) => {
        if (!drumRef) return;
        drumRef.style.transform = `translate3d(0, 0, -${radius}px) rotateX(${rot}deg)`;
        let currentCenterI = -1;
        const step = angleStep();
        for (let i = 0; i < itemsRef.length; i++) {
            const item = itemsRef[i];
            if (!item) continue;
            const angle = -i * step;
            let normalizedAngle = (angle + rot) % 360;
            if (normalizedAngle > 180) normalizedAngle -= 360;
            else if (normalizedAngle < -180) normalizedAngle += 360;
            const absAngle = Math.abs(normalizedAngle);
            if (absAngle < 110) {
                const distanceScale = 1 - (absAngle / 100) * 0.35;
                const opacity = 1 - (absAngle / 130);
                item.style.transform = `rotateX(${angle}deg) translate3d(0, 0, ${radius}px) scale(${distanceScale})`;
                item.style.opacity = Math.max(0.05, opacity).toString();
                item.style.visibility = 'visible';
                if (absAngle < (step / 2)) currentCenterI = i;
            } else {
                if (item.style.visibility !== 'hidden') {
                    item.style.visibility = 'hidden';
                    item.style.opacity = '0';
                }
            }
        }
        if (currentCenterI !== -1 && currentCenterI !== lastCenteredIndex) {
            const prevItem = itemsRef[lastCenteredIndex];
            const nextItem = itemsRef[currentCenterI];
            if (prevItem) { prevItem.classList.remove('is-visually-center'); prevItem.style.zIndex = '10'; }
            if (nextItem) { nextItem.classList.add('is-visually-center'); nextItem.style.zIndex = '50'; }
            lastCenteredIndex = currentCenterI;
        }
        const currentStep = Math.round(rot / step);
        if (currentStep !== lastTickStep) {
            const now = performance.now();
            const elapsed = now - lastAudioTime;
            if (!isDragging && elapsed > 1000) canPlayAudio = false;
            if (canPlayAudio && elapsed > 12) {
                audio.play('sfx_ui_click', 0.45);
                lastAudioTime = now;
            }
            lastTickStep = currentStep;
        }
    };

    const animate = () => {
        const step = () => {
            if (isDragging) return;
            velocity *= 0.95;
            rotation += velocity;
            const aStep = angleStep();
            if (Math.abs(velocity) < 0.35) {
                const targetIndex = Math.round(rotation / aStep);
                const targetRotation = targetIndex * aStep;
                const diff = targetRotation - rotation;
                rotation += diff * 0.45;
                if (Math.abs(diff) < 0.15) {
                    rotation = targetRotation;
                    velocity = 0;
                    updateDom(rotation);
                    const c = count();
                    const finalId = ((targetIndex % c + c) % c) + 1;
                    if (finalId !== props.activeDeckId) props.onSelectDeck(finalId);
                    return;
                }
            }
            updateDom(rotation);
            requestId = requestAnimationFrame(step);
        };
        step();
    };

    createEffect(() => {
        const activeId = props.activeDeckId;
        if (!isDragging && velocity === 0) {
            rotation = (activeId - 1) * angleStep();
            updateDom(rotation);
        }
    });

    const handlePointerDown = (e: PointerEvent) => {
        if (requestId !== null) cancelAnimationFrame(requestId);
        isDragging = true;
        canPlayAudio = true;
        lastAudioTime = performance.now();
        lastPointerY = e.clientY;
        lastTime = performance.now();
    };

    const handlePointerMove = (e: PointerEvent) => {
        if (!isDragging) return;
        const now = performance.now();
        const deltaY = e.clientY - lastPointerY;
        const deltaTime = now - lastTime;
        const rotationDelta = -(deltaY / 100) * angleStep();
        rotation += rotationDelta;
        updateDom(rotation);
        if (deltaTime > 0) {
            const instantVelocity = rotationDelta / (deltaTime / 16.67);
            velocity = velocity * 0.2 + instantVelocity * 0.8;
        }
        lastPointerY = e.clientY;
        lastTime = now;
    };

    const handlePointerUp = () => {
        if (!isDragging) return;
        isDragging = false;
        requestId = requestAnimationFrame(animate);
    };

    onCleanup(() => {
        if (requestId !== null) cancelAnimationFrame(requestId);
    });

    return (
        <div 
            class="w-full h-64 flex items-center justify-center perspective-[1200px] overflow-hidden select-none touch-none bg-slate-950/40 border-y border-slate-800/50"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            <div ref={(el) => drumRef = el} class="relative w-64 h-24 transform-style-3d pointer-events-none will-change-transform">
                <For each={deckIds()}>
                    {(id, i) => {
                        const deckName = () => user.user.deckNames[id] || 'UNTITLED';
                        const stats = () => user.user.deckStats[id];
                        const dateStr = () => stats() ? getRelativeTimeString(stats()!.lastModified) : 'some time ago';
                        const isInitialCenter = () => props.activeDeckId === id;
                        const isValid = () => (user.user.decks[id]?.length || 0) === 12;
                        const statsText = () => `conquest: ${stats()?.conquestWins || 0}/${stats()?.conquestTotal || 0} (${stats()?.conquestWinRate || 0}%) - ladder ${stats()?.ladderWins || 0}/${stats()?.ladderLosses || 0} (${stats()?.ladderWinRate || 0}%)`;

                        return (
                            <div 
                                ref={el => itemsRef[i()] = el} 
                                class={`absolute inset-0 backface-hidden transition-opacity duration-300 transform-style-3d will-change-transform ${isInitialCenter() ? 'is-visually-center' : ''} ${isValid() ? 'deck-valid' : 'deck-invalid'}`} 
                                style={{ 
                                    transform: `rotateX(${-i() * angleStep()}deg) translate3d(0, 0, ${radius}px)`, 
                                    opacity: isInitialCenter() ? 1 : 0.5, 
                                    "z-index": isInitialCenter() ? 50 : 10 
                                }}
                            >
                                <SlantedButton variant="secondary" fullWidth size="lg" class="!h-full shadow-2xl drum-item-button">
                                    <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none px-4 py-2">
                                        <div class="w-full h-8 flex items-center justify-center">
                                            <GameText text={deckName()} baseFontSize={1.4} maxLines={1} class="text-white" />
                                        </div>
                                        <div class="w-full h-5 flex items-center justify-center opacity-80">
                                            <GameText text={statsText()} baseFontSize={0.75} maxLines={1} class="text-white font-bold" />
                                        </div>
                                        <div class="w-full h-3 mt-0.5 opacity-50">
                                            <GameText text={`Changed ${dateStr()}`} baseFontSize={0.65} class="text-white lowercase italic" />
                                        </div>
                                    </div>
                                </SlantedButton>
                            </div>
                        );
                    }}
                </For>
            </div>
            <div class="absolute left-0 right-0 h-24 border-y border-white/10 pointer-events-none z-0 bg-gradient-to-b from-transparent via-indigo-500/5 to-transparent" />
            <style>{`.transform-style-3d { transform-style: preserve-3d; } .backface-hidden { backface-visibility: hidden; } .is-visually-center.deck-valid .drum-item-button > div:first-child { background: linear-gradient(to bottom, #059669, #064e3b) !important; border-color: #34d399 !important; box-shadow: 0 0.2rem 0 #064e3b, 0 0 20px rgba(16, 185, 129, 0.3) !important; } .is-visually-center.deck-invalid .drum-item-button > div:first-child { background: linear-gradient(to bottom, #dc2626, #7f1d1d) !important; border-color: #f87171 !important; box-shadow: 0 0.2rem 0 #7f1d1d, 0 0 20px rgba(239, 68, 68, 0.3) !important; } .is-visually-center { filter: grayscale(0) !important; } div:not(.is-visually-center) { filter: grayscale(0.3); }`}</style>
        </div>
    );
};
