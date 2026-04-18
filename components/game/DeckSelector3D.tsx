import React, { useEffect, useRef, useCallback } from 'react';
import { useUser } from '../../contexts/UserContext';
import { SlantedButton } from '../ui/SlantedButton';
import { GameText } from '../ui/GameText';
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

export const DeckSelector3D: React.FC<DeckSelectorProps> = ({ activeDeckId, onSelectDeck }) => {
    const { user } = useUser();
    const deckIds = Object.keys(user.decks).map(Number).sort((a, b) => a - b);
    const count = deckIds.length;
    const angleStep = 360 / count;
    const radius = 110;

    const drumRef = useRef<HTMLDivElement>(null);
    const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
    
    const setItemRef = useCallback((el: HTMLDivElement | null, i: number) => {
        itemsRef.current[i] = el;
    }, []);

    const rotationRef = useRef((activeDeckId - 1) * angleStep);
    const velocityRef = useRef(0);
    const isDraggingRef = useRef(false);
    const lastPointerY = useRef(0);
    const lastTime = useRef(0);
    const requestRef = useRef<number | null>(null);
    
    const lastCenteredIndexRef = useRef<number>(activeDeckId - 1);
    const lastTickStepRef = useRef<number>(activeDeckId - 1);
    const lastAudioTimeRef = useRef<number>(0);
    const canPlayAudioRef = useRef<boolean>(true);

    const updateDom = useCallback((rot: number) => {
        if (!drumRef.current) return;
        drumRef.current.style.transform = `translate3d(0, 0, -${radius}px) rotateX(${rot}deg)`;
        let currentCenterI = -1;
        for (let i = 0; i < itemsRef.current.length; i++) {
            const item = itemsRef.current[i];
            if (!item) continue;
            const angle = -i * angleStep;
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
                if (absAngle < (angleStep / 2)) currentCenterI = i;
            } else {
                if (item.style.visibility !== 'hidden') {
                    item.style.visibility = 'hidden';
                    item.style.opacity = '0';
                }
            }
        }
        if (currentCenterI !== -1 && currentCenterI !== lastCenteredIndexRef.current) {
            const prevItem = itemsRef.current[lastCenteredIndexRef.current];
            const nextItem = itemsRef.current[currentCenterI];
            if (prevItem) { prevItem.classList.remove('is-visually-center'); prevItem.style.zIndex = '10'; }
            if (nextItem) { nextItem.classList.add('is-visually-center'); nextItem.style.zIndex = '50'; }
            lastCenteredIndexRef.current = currentCenterI;
        }
        const currentStep = Math.round(rot / angleStep);
        if (currentStep !== lastTickStepRef.current) {
            const now = performance.now();
            const elapsed = now - lastAudioTimeRef.current;
            if (!isDraggingRef.current && elapsed > 1000) canPlayAudioRef.current = false;
            if (canPlayAudioRef.current && elapsed > 12) {
                audio.play('sfx_ui_click', 0.45);
                lastAudioTimeRef.current = now;
            }
            lastTickStepRef.current = currentStep;
        }
    }, [angleStep, radius]);

    const animate = useCallback(() => {
        function step() {
            if (isDraggingRef.current) return;
            velocityRef.current *= 0.95;
            rotationRef.current += velocityRef.current;
            if (Math.abs(velocityRef.current) < 0.35) {
                const targetIndex = Math.round(rotationRef.current / angleStep);
                const targetRotation = targetIndex * angleStep;
                const diff = targetRotation - rotationRef.current;
                rotationRef.current += diff * 0.45;
                if (Math.abs(diff) < 0.1) {
                    rotationRef.current = targetRotation;
                    velocityRef.current = 0;
                    updateDom(rotationRef.current);
                    const finalId = ((targetIndex % count + count) % count) + 1;
                    if (finalId !== activeDeckId) onSelectDeck(finalId);
                    return;
                }
            }
            updateDom(rotationRef.current);
            requestRef.current = requestAnimationFrame(step);
        }
        step();
    }, [angleStep, count, activeDeckId, onSelectDeck, updateDom]);

    useEffect(() => {
        if (!isDraggingRef.current && velocityRef.current === 0) {
            rotationRef.current = (activeDeckId - 1) * angleStep;
            updateDom(rotationRef.current);
        }
    }, [activeDeckId, angleStep, updateDom]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        isDraggingRef.current = true;
        canPlayAudioRef.current = true;
        lastAudioTimeRef.current = performance.now();
        lastPointerY.current = e.clientY;
        lastTime.current = performance.now();
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;
        const now = performance.now();
        const deltaY = e.clientY - lastPointerY.current;
        const deltaTime = now - lastTime.current;
        const rotationDelta = -(deltaY / 100) * angleStep;
        rotationRef.current += rotationDelta;
        updateDom(rotationRef.current);
        if (deltaTime > 0) {
            const instantVelocity = rotationDelta / (deltaTime / 16.67);
            velocityRef.current = velocityRef.current * 0.2 + instantVelocity * 0.8;
        }
        lastPointerY.current = e.clientY;
        lastTime.current = now;
    };

    const handlePointerUp = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        requestRef.current = requestAnimationFrame(animate);
    };

    return (
        <div 
            className="w-full h-64 flex items-center justify-center perspective-[1200px] overflow-hidden select-none touch-none bg-slate-950/40 border-y border-slate-800/50"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            <div ref={drumRef} className="relative w-64 h-24 transform-style-3d pointer-events-none will-change-transform">
                {deckIds.map((id, i) => {
                    const deckName = user.deckNames[id] || 'UNTITLED';
                    const stats = user.deckStats[id];
                    const dateStr = stats ? getRelativeTimeString(stats.lastModified) : 'some time ago';
                    const isInitialCenter = activeDeckId === id;
                    const isValid = (user.decks[id]?.length || 0) === 12;
                    const statsText = `conquest: ${stats?.conquestWins || 0}/${stats?.conquestTotal || 0} (${stats?.conquestWinRate || 0}%) - ladder ${stats?.ladderWins || 0}/${stats?.ladderLosses || 0} (${stats?.ladderWinRate || 0}%)`;

                    return (
                        // Fixed: Ref callback wrapped in braces to return void
                        <div key={id} ref={el => setItemRef(el, i)} className={`absolute inset-0 backface-hidden transition-opacity duration-300 transform-style-3d will-change-transform ${isInitialCenter ? 'is-visually-center' : ''} ${isValid ? 'deck-valid' : 'deck-invalid'}`} style={{ transform: `rotateX(${-i * angleStep}deg) translate3d(0, 0, ${radius}px)`, opacity: isInitialCenter ? 1 : 0.5, zIndex: isInitialCenter ? 50 : 10 }}>
                            <SlantedButton variant="secondary" fullWidth size="lg" className="!h-full shadow-2xl drum-item-button">
                                <div className="flex flex-col items-center justify-center w-full h-full pointer-events-none px-4 py-2">
                                    <div className="w-full h-8 flex items-center justify-center">
                                        <GameText text={deckName} baseFontSize={1.4} maxLines={1} className="text-white" />
                                    </div>
                                    <div className="w-full h-5 flex items-center justify-center opacity-80">
                                        <GameText text={statsText} baseFontSize={0.75} maxLines={1} className="text-white font-bold" />
                                    </div>
                                    <div className="w-full h-3 mt-0.5 opacity-50">
                                        <GameText text={`Changed ${dateStr}`} baseFontSize={0.65} className="text-white lowercase italic" />
                                    </div>
                                </div>
                            </SlantedButton>
                        </div>
                    );
                })}
            </div>
            <div className="absolute left-0 right-0 h-24 border-y border-white/10 pointer-events-none z-0 bg-gradient-to-b from-transparent via-indigo-500/5 to-transparent" />
            <style>{`.transform-style-3d { transform-style: preserve-3d; } .backface-hidden { backface-visibility: hidden; } .is-visually-center.deck-valid .drum-item-button > div:first-child { background: linear-gradient(to bottom, #059669, #064e3b) !important; border-color: #34d399 !important; box-shadow: 0 0.2rem 0 #064e3b, 0 0 20px rgba(16, 185, 129, 0.3) !important; } .is-visually-center.deck-invalid .drum-item-button > div:first-child { background: linear-gradient(to bottom, #dc2626, #7f1d1d) !important; border-color: #f87171 !important; box-shadow: 0 0.2rem 0 #7f1d1d, 0 0 20px rgba(239, 68, 68, 0.3) !important; } .is-visually-center { filter: grayscale(0) !important; } div:not(.is-visually-center) { filter: grayscale(0.3); }`}</style>
        </div>
    );
};