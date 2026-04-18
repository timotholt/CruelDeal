
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, ReactNode } from 'react';
import { useGameController } from '../hooks/useGameController';

// Infer the return type from the hook
type GameController = ReturnType<typeof useGameController>;

const GameContext = createContext<GameController | null>(null);

export const GameProvider: React.FC<{ children: ReactNode; onExit?: () => void }> = ({ children, onExit }) => {
    const controller = useGameController(onExit);

    return (
        <GameContext.Provider value={controller}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};
