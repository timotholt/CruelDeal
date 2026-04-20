import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import { ScreenKey } from '../../types';
import { useUser } from '../../contexts/UserContext';
import { SlantedButton } from '../ui/SlantedButton';
import { audio } from '../../services/audio';
import { Portal } from '../ui/Portal';
import { GameText } from '../ui/GameText';
import { useNavigate } from '@tanstack/solid-router';

interface HomeCommandBarProps {
    onNavigate?: (screen: ScreenKey) => void;
    isActive: boolean;
}

const getRelativeTimeString = (isoString: string) => {
// ... existing helper ...
    const date = new Date(isoString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    if (diffInDays <= 0) return 'today';
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return 'a long time ago';
};

export const HomeCommandBar = (props: HomeCommandBarProps) => {
    const user = useUser();
    const navigate = useNavigate();
    const [isRollerOpen, setIsRollerOpen] = createSignal(false);

    const internalNavigate = (screen: ScreenKey) => {
        audio.play('sfx_ui_navigate');
        const path = screen === 'MENU' ? '/' : `/${screen.toLowerCase()}`;
        navigate({ to: path });
    };

    createEffect(() => {
        if (!props.isActive && isRollerOpen()) {
            const timer = setTimeout(() => setIsRollerOpen(false), 0);
            onCleanup(() => clearTimeout(timer));
        }
    });

    const activeDeckId = () => user.user?.activeDeckId ?? 1;
    const activeDeckName = () => (user.user?.deckNames?.[activeDeckId()] ?? 'UNTITLED');
    const isMainDeckValid = () => (user.activeDeck?.()?.length ?? 0) === 12;

    const deckIds = () => {
        const decks = user.user?.decks || {};
        return Object.keys(decks).map(Number).sort((a, b) => a - b);
    };
    const count = () => Math.max(1, deckIds().length);
    const angleStep = () => 360 / count();
    const radius = 130;

    let drumRef: HTMLDivElement | undefined;
    const itemsRef: (HTMLDivElement | null)[] = [];
    
    let rotation = ((user.user?.activeDeckId ?? 1) - 1) * angleStep();
    let velocity = 0;
    let isDragging = false;
    let lastPointerY = 0;
    let lastTime = 0;
    let requestFrameId: number | null = null;
    
    let lastCenteredIndex = (user.user?.activeDeckId ?? 1) - 1;
    let lastTickStep = (user.user?.activeDeckId ?? 1) - 1;
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
                item.style.opacity = Math.max(0.1, opacity).toString();
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
            if (prevItem) prevItem.classList.remove('is-visually-center');
            if (nextItem) nextItem.classList.add('is-visually-center');
            lastCenteredIndex = currentCenterI;
        }
        const currentStep = Math.round(rot / step);
        if (currentStep !== lastTickStep) {
            const now = performance.now();
            const elapsed = now - lastAudioTime;
            if (!isDragging && elapsed > 1000) canPlayAudio = false;
            if (canPlayAudio && elapsed > 15) {
                audio.play('sfx_ui_click', 0.4);
                lastAudioTime = now;
            }
            lastTickStep = currentStep;
        }
    };

    const animate = () => {
        const step = () => {
            if (isDragging) return;
            velocity *= 0.96;
            rotation += velocity;
            const aStep = angleStep();
            if (Math.abs(velocity) < 0.4) {
                const targetIndex = Math.round(rotation / aStep);
                const targetRotation = targetIndex * aStep;
                const diff = targetRotation - rotation;
                rotation += diff * 0.5;
                if (Math.abs(diff) < 0.15) {
                    rotation = targetRotation;
                    velocity = 0;
                    updateDom(rotation);
                    const c = count();
                    const finalId = ((targetIndex % c + c) % c) + 1;
                    if (finalId !== (user.user?.activeDeckId ?? 1)) user.setActiveDeck(finalId);
                    return;
                }
            }
            updateDom(rotation);
            requestFrameId = requestAnimationFrame(step);
        };
        step();
    };

    const handlePointerDown = (e: PointerEvent) => {
        if (requestFrameId !== null) cancelAnimationFrame(requestFrameId);
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
            velocity = velocity * 0.25 + instantVelocity * 0.75;
        }
        lastPointerY = e.clientY;
        lastTime = now;
    };

    const handlePointerUp = () => {
        if (!isDragging) return;
        isDragging = false;
        requestFrameId = requestAnimationFrame(animate);
    };

    createEffect(() => {
        if (isRollerOpen()) {
            const t = setTimeout(() => updateDom(rotation), 50);
            onCleanup(() => clearTimeout(t));
        }
    });

    onCleanup(() => {
        if (requestFrameId !== null) cancelAnimationFrame(requestFrameId);
    });

    return (
        <div class="w-full h-full flex items-end px-1 pb-1.5 gap-1.5 pointer-events-none relative overflow-visible">
            <Show when={isRollerOpen()}>
                <Portal>
                    <div 
                        class="fixed inset-0 z-[600] pointer-events-auto bg-black/40 backdrop-blur-md flex flex-col items-center justify-center" 
                        onClick={() => setIsRollerOpen(false)} 
                        onPointerDown={handlePointerDown} 
                        onPointerMove={handlePointerMove} 
                        onPointerUp={handlePointerUp} 
                        onPointerLeave={handlePointerUp}
                    >
                        <div class="w-full h-[32rem] perspective-[1500px] flex items-center justify-center select-none touch-none animate-pop overflow-visible">
                            <div 
                                ref={(el) => drumRef = el} 
                                class="relative w-64 h-24 transform-style-3d pointer-events-none will-change-transform" 
                                style={{ transform: `translate3d(0, 0, -${radius}px) rotateX(${((user.user?.activeDeckId ?? 1) - 1) * angleStep()}deg)` }}
                            >
                                <For each={deckIds()}>
                                    {(id, i) => {
                                        const stats = () => user.user.deckStats ? user.user.deckStats[id] : null;
                                        const dateStr = () => stats() ? getRelativeTimeString(stats()!.lastModified) : 'some time ago';
                                        const isInitialCenter = () => (user.user?.activeDeckId ?? 1) === id;
                                        const isValid = () => {
                                            const decks = user.user?.decks || {};
                                            return (decks[id]?.length || 0) === 12;
                                        };
                                        const statsText = () => {
                                            const s = stats();
                                            return `CQ: ${s?.conquestWins || 0}/${s?.conquestTotal || 0} - LD: ${s?.ladderWins || 0}/${s?.ladderLosses || 0}`;
                                        };
                                        return (
                                            <div 
                                                ref={el => itemsRef[i()] = el} 
                                                class={`absolute inset-0 backface-hidden transform-style-3d will-change-transform ${isInitialCenter() ? 'is-visually-center' : ''} ${isValid() ? 'deck-valid' : 'deck-invalid'}`} 
                                                style={{ 
                                                    transform: `rotateX(${-i() * angleStep()}deg) translate3d(0, 0, ${radius}px)`, 
                                                    opacity: isInitialCenter() ? 1 : 0.4, 
                                                    "z-index": i() === ((user.user?.activeDeckId ?? 1) - 1) ? 50 : 10 
                                                }}
                                            >
                                                <SlantedButton variant="secondary" fullWidth size="lg" class="!h-full shadow-2xl drum-item-button">
                                                    <div class="flex flex-col items-stretch justify-center w-full h-full pointer-events-none px-4 py-2 min-w-0">
                                                        <div class="flex-[3] w-full min-h-0">
                                                            <GameText text={user.user?.deckNames?.[id] || 'UNTITLED'} baseFontSize={1.4} class="text-white font-black italic tracking-tighter uppercase" maxLines={2} />
                                                        </div>
                                                        <div class="flex-[2] w-full min-h-0 flex items-center justify-center opacity-90">
                                                            <GameText text={statsText()} baseFontSize={0.7} maxLines={1} class="text-white font-bold italic tracking-tighter uppercase" />
                                                        </div>
                                                        <div class="flex-1 w-full min-h-0 opacity-50">
                                                            <GameText text={`Changed ${dateStr()}`} baseFontSize={0.6} class="lowercase italic font-black tracking-tighter" />
                                                        </div>
                                                    </div>
                                                </SlantedButton>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </div>
                    </div>
                </Portal>
            </Show>

            <div class="flex-[0.5] pointer-events-auto min-w-0 h-full flex items-end">
                <SlantedButton 
                    variant="blue" 
                    size="sm" 
                    fullWidth 
                    onClick={() => internalNavigate('HISTORY')} 
                    class="shadow-blue-900/40" 
                    icon={
                        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    } 
                />
            </div>

            <div class="flex-1 pointer-events-auto min-w-0 h-full flex items-end">
                <SlantedButton 
                    variant="blue" 
                    fullWidth 
                    size="md" 
                    padding="0.5rem"
                    onClick={() => internalNavigate('PLAY')} 
                    class="shadow-blue-900/50" 
                >
                    {`NEW\nGAME`}
                </SlantedButton>
            </div>

            <div class="flex-1 pointer-events-auto relative z-[70] min-w-0 h-full flex items-end">
                <SlantedButton 
                    variant={isMainDeckValid() ? 'success' : 'danger'} 
                    fullWidth 
                    size="md" 
                    padding="0.5rem"
                    onClick={() => internalNavigate('DECK')} 
                    holdDuration={500}
                    onHoldComplete={() => setIsRollerOpen(true)}
                    class="shadow-slate-900/40 transition-transform"
                    icon={!isMainDeckValid() ? <div class="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" /> : undefined}
                >
                    {`DECK\n${activeDeckName()}`}
                </SlantedButton>
            </div>

            <div class="flex-1 pointer-events-auto min-w-0 h-full flex items-end">
                <SlantedButton 
                    variant="blue" 
                    fullWidth 
                    size="md" 
                    padding="0.5rem"
                    onClick={() => internalNavigate('GAME')} 
                    class="shadow-blue-900/50"
                >
                    {`PLAY\n\u00A0\u00A0LADDER\u00A0\u00A0`}
                </SlantedButton>
            </div>

            <div class="flex-[0.5] pointer-events-auto min-w-0 h-full flex items-end">
                <SlantedButton 
                    variant="blue" 
                    size="sm" 
                    fullWidth
                    onClick={() => internalNavigate('RANK')} 
                    class="shadow-blue-900/40"
                >
                    {user.user?.rank?.toString() ?? '10'}
                </SlantedButton>
            </div>

            <style>{`
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .is-visually-center.deck-valid .drum-item-button > div:first-child { background: linear-gradient(to bottom, #059669, #064e3b) !important; border-color: #34d399 !important; box-shadow: 0 0.2rem 0 #064e3b, 0 0 20px rgba(16, 185, 129, 0.3) !important; }
                .is-visually-center.deck-invalid .drum-item-button > div:first-child { background: linear-gradient(to bottom, #dc2626, #7f1d1d) !important; border-color: #f87171 !important; box-shadow: 0 0.2rem 0 #7f1d1d, 0 0 20px rgba(239, 68, 68, 0.3) !important; }
                .is-visually-center { filter: grayscale(0) !important; }
            `}</style>
        </div>
    );
};
