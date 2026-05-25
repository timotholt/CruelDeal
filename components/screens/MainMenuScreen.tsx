import { createSignal, onMount, Show, For } from 'solid-js';
import { useUser } from '../../contexts/UserContext';
import { ScreenKey } from '../../types';
import { UserProfileDropdown } from '../menu/UserProfileDropdown';
import { useUI } from '../../contexts/UIContext';
import { api } from '../../services/api';
import { useNavigate } from '@tanstack/solid-router';
import '../../src/styles/main-material-preview.css';

interface MainMenuScreenProps {
  onNavigate?: (screen: ScreenKey) => void;
  onLogout: () => void;
}

export const MainMenuScreen = (props: MainMenuScreenProps) => {
  const navigate = useNavigate();
  const { setStoreScrollTarget } = useUI();
  const userContext = useUser();
  const [content, setContent] = createSignal<any>(null);
  const [news, setNews] = createSignal<any[]>([]);

  onMount(async () => {
      try {
          const [menuRes, newsRes] = await Promise.all([
              api.cms.menu('en'),
              api.cms.news('en')
          ]);
          if (menuRes.success) setContent(menuRes.data);
          if (newsRes.success) setNews(newsRes.data || []);
      } catch (e) {
          console.error("Main Menu Sync Failed", e);
      }
  });

  const handleCurrencyClick = (sectionId: string) => {
      navigate({ to: '/store' });
      setStoreScrollTarget(sectionId);
  };

  const handleInternalNavigate = (screen: ScreenKey) => {
      const path = screen === 'MENU' ? '/' : `/${screen.toLowerCase()}`;
      navigate({ to: path });
  };

  return (
    <Show when={content()}>
      {(data) => (
        <div class="main-material-screen main-screen-phone">
          <img class="main-material-bg" src="/art/login/cruel-company-final-login.png" alt="" />
          <div class="main-material-wash" />
          <div class="main-material-grain" />

          <div class="main-material-frame">
            <header class="main-material-topbar">
              <div class="main-material-profile-slot">
                <UserProfileDropdown onLogout={props.onLogout} onNavigate={handleInternalNavigate} />
              </div>
              <div class="main-material-commander">{userContext.user.username}</div>
              <div class="main-material-currencies">
                <button type="button" class="main-material-currency-chip main-material-currency-chip--credits" onClick={() => handleCurrencyClick('store-credits')}>
                  {userContext.user.credits}
                </button>
                <button type="button" class="main-material-currency-chip main-material-currency-chip--gold" onClick={() => handleCurrencyClick('store-gold')}>
                  {userContext.user.gold}
                </button>
                <button type="button" class="main-material-currency-chip main-material-currency-chip--tokens" onClick={() => handleCurrencyClick('store-tokens')}>
                  {userContext.user.tokens}
                </button>
              </div>
            </header>

            <div class="main-material-scroll">
              <div class="main-material-title-block">
                <h1>{data().welcomeHeader}</h1>
                <p>{data().dailyBriefingLabel}</p>
              </div>

              <button
                type="button"
                class="main-material-hero w-full text-left"
                onClick={() => handleInternalNavigate('STORE')}
              >
                <div class="main-material-hero-content">
                  <div class="main-material-tag">{data().seasonPassLabel}</div>
                  <h2>{data().currentSeasonTheme}</h2>
                  <p>{data().seasonSubtitle}</p>
                </div>
              </button>

              <div class="main-material-news-list">
                <For each={news().slice(0, 2)}>
                  {(item, index) => (
                    <article class={`main-material-news-card ${index() === 0 ? 'main-material-news-card--dark' : ''}`}>
                      <div class="main-material-tag">{item.type}</div>
                      <h3>{item.title}</h3>
                      <p>{item.subtitle}</p>
                    </article>
                  )}
                </For>
              </div>

              <div class="main-material-end">{data().endTransmissionLabel}</div>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};
