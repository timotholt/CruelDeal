
import React, { useState, useEffect } from 'react';
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

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({ onNavigate, onLogout }) => {
  const { setStoreScrollTarget } = useUI();
  const [content, setContent] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
      const fetchData = async () => {
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
      };
      fetchData();
  }, []);

  const handleCurrencyClick = (sectionId: string) => {
      onNavigate('STORE');
      setStoreScrollTarget(sectionId);
  };

  if (!content) return null;

  return (
    <div className="w-full h-full flex flex-col relative bg-transparent">
      <StandardHeader 
          title="MAIN"
          className="!pl-0.5 !pr-1"
          leftContent={<UserProfileDropdown onLogout={onLogout} onNavigate={onNavigate} />}
          showCurrency={true}
          onCreditClick={() => handleCurrencyClick('store-credits')}
          onGoldClick={() => handleCurrencyClick('store-gold')}
          onTokenClick={() => handleCurrencyClick('store-tokens')}
      />
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24">
          <div className="mb-6">
              <h1 className="text-2xl font-black text-white tracking-tight mb-1">{content.welcomeHeader}</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{content.dailyBriefingLabel}</p>
          </div>
          <div className="w-full aspect-video rounded-2xl bg-gradient-to-br from-indigo-900/60 to-slate-900/60 border border-indigo-500/30 backdrop-blur-sm relative overflow-hidden p-5 flex flex-col justify-end mb-6 shadow-2xl group cursor-pointer" onClick={() => onNavigate('STORE')}>
                <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/space/400/200')] opacity-40 mix-blend-overlay group-hover:scale-105 transition-transform duration-700"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-indigo-600 text-white text-[0.6rem] font-bold px-2 py-0.5 rounded mb-2 shadow-lg">{content.seasonPassLabel}</div>
                    <h2 className="text-3xl font-black text-white leading-none mb-1">{content.currentSeasonTheme}</h2>
                    <p className="text-indigo-200 text-xs max-w-[80%]">{content.seasonSubtitle}</p>
                </div>
          </div>
          
          {news.slice(0, 2).map(item => (
              <NewsCard key={item.id} type={item.type} title={item.title} subtitle={item.subtitle} imageColor={item.color} />
          ))}

          <div className="text-center py-6">
              <div className="inline-block h-1 w-12 bg-white/10 rounded-full mb-2"></div>
              <p className="text-[0.6rem] text-slate-600 font-bold uppercase tracking-[0.3em]">{content.endTransmissionLabel}</p>
          </div>
      </div>
    </div>
  );
};
