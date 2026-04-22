/**
 * PlayScreen — top-level shell for the /play route.
 *
 * The actual gameplay surface lives in `./play/PlayBoard`. This file only
 * stands up the VFX host + game-state provider so the real UI modules
 * stay isolated from engine/provider changes.
 */

import { VfxHost } from '../game/VfxHost';
import { PlayGameProvider } from '@/contexts/PlayGameContext';
import { BoardSizer } from './play/BoardSizer';
import { PlayBoard } from './play/PlayBoard';

interface PlayScreenProps {
  onExit?: () => void;
}

export const PlayScreen = (props: PlayScreenProps) => {
  return (
    <div
      class="playgame-root board-hidden"
      style={{ width: '100%', height: '100%', background: '#000' }}
    >
      <VfxHost class="board-wrap" id="boardWrap">
        <PlayGameProvider>
          <BoardSizer />
          <PlayBoard onExit={props.onExit} />
        </PlayGameProvider>
      </VfxHost>
    </div>
  );
};
