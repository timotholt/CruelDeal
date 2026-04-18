import { createContext, useContext, JSX } from 'solid-js';
import { useGameController } from '../hooks/useGameController';

// Infer the return type from the hook
type GameController = ReturnType<typeof useGameController>;

const GameContext = createContext<GameController>();

export const GameProvider = (props: { children: JSX.Element; onExit?: () => void }) => {
    const controller = useGameController(() => props.onExit?.());

    return (
        <GameContext.Provider value={controller}>
            {props.children}
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
