import { useUser } from '../../contexts/UserContext';
import { ScreenKey } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { useNavigate } from '@tanstack/solid-router';
import '../../src/styles/main-material-preview.css';
import '../ui/semantic-artifacts/mission-briefing-v1/mission-v2-r0/appearance.css';
import { MissionBriefingRuntime } from '../ui/semantic-runtime/mission-briefing/MissionBriefingRuntime';
import { missionV2CompiledPlan } from '../ui/semantic-runtime/mission-briefing/missionV2Artifact';
import {
  MissionBriefingScreenContext,
  type MissionShellDestination,
} from '../ui/semantic-runtime/mission-briefing/MissionBriefingScreenContext';

interface MainMenuScreenProps {
  onNavigate?: (screen: ScreenKey) => void;
  onLogout: () => void;
}

export const MainMenuScreen = (props: MainMenuScreenProps) => {
  const navigate = useNavigate();
  const { setStoreScrollTarget } = useUI();
  const userContext = useUser();
  const handleCurrencyClick = (sectionId: string) => {
      navigate({ to: '/store' });
      setStoreScrollTarget(sectionId);
  };

  const handleInternalNavigate = (screen: ScreenKey) => {
      if (props.onNavigate) {
        props.onNavigate(screen);
        return;
      }
      const path = screen === 'MENU' ? '/' : `/${screen.toLowerCase()}`;
      navigate({ to: path });
  };

  const destinationScreen: Record<MissionShellDestination, ScreenKey> = {
    messages: 'INBOX',
    news: 'MENU',
    missions: 'PLAY',
    events: 'SEASON',
    collection: 'DECK',
    operations: 'PLAY',
    home: 'MENU',
    market: 'STORE',
    profile: 'PROFILE',
  };
  const seasonProgress = () => Object.values(userContext.user.seasonProgress)[0];

  return (
    <div class="main-material-screen main-screen-phone">
      <div class="main-material-frame mission-briefing-product-shell">
        <MissionBriefingScreenContext
          data={{
            playerName: userContext.user.username || 'NETRUNNER_07',
            level: userContext.user.level || 24,
            currentXp: seasonProgress()?.xp ?? 18450,
            targetXp: Math.max((seasonProgress()?.xp ?? 18450) + 5550, 24000),
            credits: userContext.user.credits,
            data: userContext.user.tokens,
          }}
          onNavigate={(destination) => handleInternalNavigate(destinationScreen[destination])}
          onAddResource={() => handleCurrencyClick('store-credits')}
        />
        <MissionBriefingRuntime
          plan={missionV2CompiledPlan}
          onAction={(event) => window.dispatchEvent(new CustomEvent('cruel-deal:ui-action', { detail: event }))}
        />
      </div>
    </div>
  );
};
