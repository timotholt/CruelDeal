import { createSignal, onMount, Show, For } from 'solid-js';
import { useUser } from '../../contexts/UserContext';
import { StandardHeader } from '../ui/StandardHeader';
import { ScreenKey } from '../../types';
import { NewsCard } from '../menu/NewsCard';
import { UserProfileDropdown } from '../menu/UserProfileDropdown';
import { useUI } from '../../contexts/UIContext';
import { api } from '../../services/api';

interface MainMenuScreenProps {
  onNavigate: (screen: ScreenKey) => void;
  onLogout: () => void;
}

export const MainMenuScreen = (props: MainMenuScreenProps) => {
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
      props.onNavigate('STORE');
      setStoreScrollTarget(sectionId);
  };

  return (
    <Show when={content()}>
      {(data) => (
        <div class="w-full h-full flex flex-col relative bg-transparent">
          <StandardHeader 
              title={userContext.user.username}
              class="!pl-0.5 !pr-1"
              leftContent={<UserProfileDropdown onLogout={props.onLogout} onNavigate={props.onNavigate} />}
              showCurrency={true}
              onCreditClick={() => handleCurrencyClick('store-credits')}
              onGoldClick={() => handleCurrencyClick('store-gold')}
              onTokenClick={() => handleCurrencyClick('store-tokens')}
          />
          <div class="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24">
              <div class="mb-6">
                  <h1 class="text-2xl font-black text-white tracking-tight mb-1">{data().welcomeHeader}</h1>
                  <p class="text-xs text-slate-500 font-bold uppercase tracking-widest">{data().dailyBriefingLabel}</p>
              </div>
              <div 
                class="w-full aspect-video rounded-2xl bg-gradient-to-br from-indigo-900/60 to-slate-900/60 border border-indigo-500/30 backdrop-blur-sm relative overflow-hidden p-5 flex flex-col justify-end mb-6 shadow-2xl group cursor-pointer" 
                onClick={() => props.onNavigate('STORE')}
              >
                    <div class="absolute inset-0 bg-[url('https://picsum.photos/seed/space/400/200')] opacity-40 mix-blend-overlay group-hover:scale-105 transition-transform duration-700" />
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                    <div class="relative z-10">
                        <div class="inline-block bg-indigo-600 text-white text-[0.6rem] font-bold px-2 py-0.5 rounded mb-2 shadow-lg">{data().seasonPassLabel}</div>
                        <h2 class="text-3xl font-black text-white leading-none mb-1">{data().currentSeasonTheme}</h2>
                        <p class="text-indigo-200 text-xs max-w-[80%]">{data().seasonSubtitle}</p>
                    </div>
              </div>
              
              <For each={news().slice(0, 2)}>
                  {(item) => (
                      <NewsCard type={item.type} title={item.title} subtitle={item.subtitle} imageColor={item.color} />
                  )}
              </For>

              <div class="text-center py-6">
                  <div class="inline-block h-1 w-12 bg-white/10 rounded-full mb-2" />
                  <p class="text-[0.6rem] text-slate-600 font-bold uppercase tracking-[0.3em]">{data().endTransmissionLabel}</p>
              </div>
          </div>
        </div>
      )}
    </Show>
  );
};
