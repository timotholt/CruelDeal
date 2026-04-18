
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ScreenKey } from '../../types';
import { useUser } from '../../contexts/UserContext';
import { SlantedButton } from '../ui/SlantedButton';
import { audio } from '../../services/audio';
import { Portal } from '../ui/Portal';
import { GameText } from '../ui/GameText';

interface HomeCommandBarProps {
    onNavigate: (screen: ScreenKey) => void;
    isActive: boolean;
}

const getRelativeTimeString = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    if (diffInDays <= 0) return 'today';
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return 'a long time ago';
};

export const HomeCommandBar: React.FC<HomeCommandBarProps> = ({ onNavigate, isActive }) => {
    const { user, activeDeck, setActiveDeck } = useUser();
    const [isRollerOpen, setIsRollerOpen] = useState(false);

    useEffect(() => {
        if (!isActive && isRollerOpen) {
            const timer = setTimeout(() => setIsRollerOpen(false), 0);
            return () => clearTimeout(timer);
        }
    }, [isActive, isRollerOpen]);

    const activeDeckId = user.activeDeckId;
    const activeDeckName = user.deckNames[activeDeckId] || 'UNTITLED';
    const isMainDeckValid = activeDeck.length === 12;

    const deckIds = Object.keys(user.decks).map(Number).sort((a, b) => a - b);
    const count = deckIds.length;
    const angleStep = 360 / count;
    const radius = 130;

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
                item.style.opacity = Math.max(0.1, opacity).toString();
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
            if (prevItem) prevItem.classList.remove('is-visually-center');
            if (nextItem) nextItem.classList.add('is-visually-center');
            lastCenteredIndexRef.current = currentCenterI;
        }
        const currentStep = Math.round(rot / angleStep);
        if (currentStep !== lastTickStepRef.current) {
            const now = performance.now();
            const elapsed = now - lastAudioTimeRef.current;
            if (!isDraggingRef.current && elapsed > 1000) canPlayAudioRef.current = false;
            if (canPlayAudioRef.current && elapsed > 15) {
                audio.play('sfx_ui_click', 0.4);
                lastAudioTimeRef.current = now;
            }
            lastTickStepRef.current = currentStep;
        }
    }, [angleStep, radius]);

    const animate = useCallback(() => {
        function step() {
            if (isDraggingRef.current) return;
            velocityRef.current *= 0.96;
            rotationRef.current += velocityRef.current;
            if (Math.abs(velocityRef.current) < 0.4) {
                const targetIndex = Math.round(rotationRef.current / angleStep);
                const targetRotation = targetIndex * angleStep;
                const diff = targetRotation - rotationRef.current;
                rotationRef.current += diff * 0.5;
                if (Math.abs(diff) < 0.15) {
                    rotationRef.current = targetRotation;
                    velocityRef.current = 0;
                    updateDom(rotationRef.current);
                    const finalId = ((targetIndex % count + count) % count) + 1;
                    if (finalId !== user.activeDeckId) setActiveDeck(finalId);
                    return;
                }
            }
            updateDom(rotationRef.current);
            requestRef.current = requestAnimationFrame(step);
        }
        step();
    }, [angleStep, count, user.activeDeckId, setActiveDeck, updateDom]);

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
            velocityRef.current = velocityRef.current * 0.25 + instantVelocity * 0.75;
        }
        lastPointerY.current = e.clientY;
        lastTime.current = now;
    };

    const handlePointerUp = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        if (isRollerOpen) {
            const t = setTimeout(() => updateDom(rotationRef.current), 50);
            return () => clearTimeout(t);
        }
    }, [isRollerOpen, updateDom]);

    return (
        <div className="w-full h-full flex items-end px-1 pb-1.5 gap-1.5 pointer-events-none relative overflow-visible">
            {isRollerOpen && (
                <Portal>
                    <div className="fixed inset-0 z-[600] pointer-events-auto bg-black/40 backdrop-blur-md flex flex-col items-center justify-center" onClick={() => setIsRollerOpen(false)} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
                        <div className="w-full h-[32rem] perspective-[1500px] flex items-center justify-center select-none touch-none animate-pop overflow-visible">
                            <div ref={drumRef} className="relative w-64 h-24 transform-style-3d pointer-events-none will-change-transform" style={{ transform: `translate3d(0, 0, -${radius}px) rotateX(${(activeDeckId - 1) * angleStep}deg)` }}>
                                {deckIds.map((id, i) => {
                                    const stats = user.deckStats[id];
                                    const dateStr = stats ? getRelativeTimeString(stats.lastModified) : 'some time ago';
                                    const isInitialCenter = user.activeDeckId === id;
                                    const isValid = (user.decks[id]?.length || 0) === 12;
                                    const statsText = `CQ: ${stats?.conquestWins || 0}/${stats?.conquestTotal || 0} - LD: ${stats?.ladderWins || 0}/${stats?.ladderLosses || 0}`;
                                    return (
                                        <div key={id} ref={el => setItemRef(el, i)} className={`absolute inset-0 backface-hidden transform-style-3d will-change-transform ${isInitialCenter ? 'is-visually-center' : ''} ${isValid ? 'deck-valid' : 'deck-invalid'}`} style={{ transform: `rotateX(${-i * angleStep}deg) translate3d(0, 0, ${radius}px)`, opacity: isInitialCenter ? 1 : 0.4, zIndex: i === (activeDeckId - 1) ? 50 : 10 }}>
                                            <SlantedButton variant="secondary" fullWidth size="lg" className="!h-full shadow-2xl drum-item-button">
                                                <div className="flex flex-col items-stretch justify-center w-full h-full pointer-events-none px-4 py-2 min-w-0">
                                                    <div className="flex-[3] w-full min-h-0">
                                                        <GameText text={user.deckNames[id] || 'UNTITLED'} baseFontSize={1.4} className="text-white font-black italic tracking-tighter uppercase" maxLines={2} />
                                                    </div>
                                                    <div className="flex-[2] w-full min-h-0 flex items-center justify-center opacity-90">
                                                        <GameText text={statsText} baseFontSize={0.7} maxLines={1} className="text-white font-bold italic tracking-tighter uppercase" />
                                                    </div>
                                                    <div className="flex-1 w-full min-h-0 opacity-50">
                                                        <GameText text={`Changed ${dateStr}`} baseFontSize={0.6} className="lowercase italic font-black tracking-tighter" />
                                                    </div>
                                                </div>
                                            </SlantedButton>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* WEIGHTED BUTTON: Battle History Log */}
            <div className="flex-[0.5] pointer-events-auto min-w-0 h-full flex items-end">
                <SlantedButton 
                    variant="blue" 
                    size="sm" 
                    fullWidth 
                    onClick={() => onNavigate('HISTORY')} 
                    className="shadow-blue-900/40" 
                    icon={
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    } 
                />
            </div>

            <div className="flex-1 pointer-events-auto min-w-0 h-full flex items-end">
                <SlantedButton 
                    variant="blue" 
                    fullWidth 
                    size="md" 
                    onClick={() => onNavigate('GAME')} 
                    className="shadow-blue-900/50" 
                >
                    {`PLAY\nCONQUEST`}
                </SlantedButton>
            </div>

            <div className="flex-1 pointer-events-auto relative z-[70] min-w-0 h-full flex items-end">
                <SlantedButton 
                    variant={isMainDeckValid ? 'success' : 'danger'} 
                    fullWidth 
                    size="md" 
                    onClick={() => onNavigate('DECK')} 
                    className="shadow-slate-900/40 transition-transform"
                    icon={!isMainDeckValid ? <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" /> : undefined}
                >
                    {`DECK\n${activeDeckName}`}
                </SlantedButton>
            </div>

            <div className="flex-1 pointer-events-auto min-w-0 h-full flex items-end">
                <SlantedButton 
                    variant="blue" 
                    fullWidth 
                    size="md" 
                    onClick={() => onNavigate('GAME')} 
                    className="shadow-blue-900/50"
                >
                    {`PLAY\nLADDER`}
                </SlantedButton>
            </div>

            <div className="flex-[0.5] pointer-events-auto min-w-0 h-full flex items-end">
                <SlantedButton 
                    variant="blue" 
                    size="sm" 
                    fullWidth
                    onClick={() => onNavigate('RANK')} 
                    className="shadow-blue-900/40"
                >
                    {user.rank.toString()}
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
