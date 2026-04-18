
import { useState } from 'react';
import { ScreenKey } from '../types';
import { WORLDS } from '../config/spatialMap';
import { audio } from '../services/audio';

export const useSpatialNavigation = () => {
    const [activeScreen, setActiveScreen] = useState<ScreenKey>('MENU');
    const [prevScreen, setPrevScreen] = useState<ScreenKey | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const navigateTo = (target: ScreenKey) => {
        if (target === activeScreen || isTransitioning) return;

        audio.playUiHover();

        setPrevScreen(activeScreen);
        setActiveScreen(target);
        setIsTransitioning(true);

        // Match the App.tsx duration-500
        setTimeout(() => {
            setIsTransitioning(false);
            setPrevScreen(null); 
        }, 500); 
    };

    const resetToMenu = () => {
        setActiveScreen('MENU');
        setPrevScreen(null);
        setIsTransitioning(false);
    };

    const activeConfig = WORLDS[activeScreen];
    const cameraX = activeConfig.x * -100;
    const cameraY = activeConfig.y * -100;
    
    const containerStyle = { 
        transform: `translate3d(${cameraX}%, ${cameraY}%, 0)` 
    };

    return {
        activeScreen,
        prevScreen,
        isTransitioning,
        containerStyle,
        navigateTo,
        resetToMenu,
        WORLDS
    };
};
