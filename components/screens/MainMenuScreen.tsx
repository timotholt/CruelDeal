import { createSignal, onMount, Show, For } from 'solid-js';
import { useUser } from '../../contexts/UserContext';
import { ScreenKey } from '../../types';
import { UserProfileDropdown } from '../menu/UserProfileDropdown';
import { useUI } from '../../contexts/UIContext';
import { api } from '../../services/api';
import { useNavigate } from '@tanstack/solid-router';
import '../../src/styles/main-material-preview.css';
import {
  MaterialButton,
  MaterialPanel,
  createMaterialRecipe,
  materialRecipeToSurfaceProps,
} from '../ui/material-lab';

interface MainMenuScreenProps {
  onNavigate?: (screen: ScreenKey) => void;
  onLogout: () => void;
}

const mainBackdropSurface = createMaterialRecipe({
  material: 'white',
  texture: 'background01',
  textureStrength: 100,
  textureScale: 512,
  glass: false,
  tint: 'none',
  tintStrength: 0,
  gradient: 'none',
  border: [],
  borderOpacity: 0,
  lightStrength: 0,
  darkStrength: 0,
  edgeWearTexture: 'none',
  edgeWearOpacity: 0,
  radius: 0,
});

const mainTopBarSurface = createMaterialRecipe({
  material: 'white',
  texture: 'stone04',
  textureStrength: 38,
  textureScale: 512,
  glass: true,
  glassOpacity: 26,
  glassBlur: 6,
  tint: 'gold',
  tintStrength: 12,
  gradient: 'top-light',
  borderOpacity: 44,
  lightStrength: 42,
  darkStrength: 14,
  radius: 6,
});

const mainProfileSurface = createMaterialRecipe({
  material: 'white',
  texture: 'stone03',
  textureStrength: 44,
  textureScale: 256,
  glass: false,
  tint: 'none',
  tintStrength: 0,
  gradient: 'bottom-dark',
  borderOpacity: 36,
  lightStrength: 18,
  darkStrength: 54,
  radius: 5,
});

const mainCurrencySurface = createMaterialRecipe({
  material: 'white',
  texture: 'stone04',
  textureStrength: 26,
  textureScale: 256,
  glass: true,
  glassOpacity: 16,
  glassBlur: 3,
  tint: 'white',
  tintStrength: 8,
  gradient: 'top-light',
  borderOpacity: 28,
  lightStrength: 34,
  darkStrength: 14,
  radius: 4,
  contentTone: 'black',
  textSizeRem: 0.6875,
});

const mainFeedSurface = createMaterialRecipe({
  material: 'white',
  texture: 'stone04',
  textureStrength: 46,
  textureScale: 256,
  glass: true,
  glassOpacity: 44,
  glassBlur: 8,
  tint: 'white',
  tintStrength: 8,
  gradient: 'both',
  borderOpacity: 18,
  lightStrength: 22,
  darkStrength: 8,
  edgeWearTexture: 'edge-bw-chips-fine',
  edgeWearOpacity: 7,
  edgeWearWidth: 5,
  radius: 7,
});

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
          <MaterialPanel
            {...materialRecipeToSurfaceProps(mainBackdropSurface)}
            padded={false}
            class="main-material-backdrop-surface"
          >
            <div class="main-material-wash" />
            <div class="main-material-grain" />
          </MaterialPanel>

          <div class="main-material-frame">
            <MaterialPanel
              {...materialRecipeToSurfaceProps(mainTopBarSurface)}
              padded={false}
              class="main-material-topbar"
            >
              <MaterialPanel
                {...materialRecipeToSurfaceProps(mainProfileSurface)}
                padded={false}
                class="main-material-profile-slot"
              >
                <UserProfileDropdown onLogout={props.onLogout} onNavigate={handleInternalNavigate} />
              </MaterialPanel>
              <div class="main-material-commander">{userContext.user.username}</div>
              <div class="main-material-currencies">
                <MaterialButton
                  {...materialRecipeToSurfaceProps(mainCurrencySurface)}
                  size="sm"
                  class="main-material-currency-chip main-material-currency-chip--credits"
                  icon={<span class="main-material-currency-icon main-material-currency-icon--credits" />}
                  onClick={() => handleCurrencyClick('store-credits')}
                >
                  {userContext.user.credits}
                </MaterialButton>
                <MaterialButton
                  {...materialRecipeToSurfaceProps(mainCurrencySurface)}
                  size="sm"
                  class="main-material-currency-chip main-material-currency-chip--gold"
                  icon={<span class="main-material-currency-icon main-material-currency-icon--gold" />}
                  onClick={() => handleCurrencyClick('store-gold')}
                >
                  {userContext.user.gold}
                </MaterialButton>
                <MaterialButton
                  {...materialRecipeToSurfaceProps(mainCurrencySurface)}
                  size="sm"
                  class="main-material-currency-chip main-material-currency-chip--tokens"
                  icon={<span class="main-material-currency-icon main-material-currency-icon--tokens" />}
                  onClick={() => handleCurrencyClick('store-tokens')}
                >
                  {userContext.user.tokens}
                </MaterialButton>
              </div>
            </MaterialPanel>

            <div class="main-material-scroll">
              <div class="main-material-title-block">
                <h1>{data().welcomeHeader}</h1>
                <p>{data().dailyBriefingLabel}</p>
              </div>

              <MaterialPanel
                {...materialRecipeToSurfaceProps(mainFeedSurface)}
                padded={false}
                class="main-material-hero"
              >
                <button
                  type="button"
                  class="main-material-hero-hitbox"
                  aria-label={data().currentSeasonTheme}
                  onClick={() => handleInternalNavigate('STORE')}
                />
                <div class="main-material-hero-content">
                  <div class="main-material-tag">{data().seasonPassLabel}</div>
                  <h2>{data().currentSeasonTheme}</h2>
                  <p>{data().seasonSubtitle}</p>
                </div>
              </MaterialPanel>

              <div class="main-material-news-list">
                <For each={news().slice(0, 2)}>
                  {(item, index) => (
                    <MaterialPanel
                      {...materialRecipeToSurfaceProps(mainFeedSurface)}
                      padded={false}
                      class={`main-material-news-card ${index() === 0 ? 'main-material-news-card--dark' : ''}`}
                    >
                      <div class="main-material-tag">{item.type}</div>
                      <h3>{item.title}</h3>
                      <p>{item.subtitle}</p>
                    </MaterialPanel>
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
