import { createSignal, onMount, Show, For } from 'solid-js';
import { StandardHeader } from '../ui/StandardHeader';
import { InboxItem } from '../inbox/InboxItem';
import { NewsCard } from '../menu/NewsCard';
import { SlantedButton } from '../ui/SlantedButton';
import { t } from '../../services/localization';
import { api } from '../../services/api';
import { useUser } from '../../contexts/UserContext';

export const InboxScreen = () => {
    const { user } = useUser();
    const [activeTab, setActiveTab] = createSignal<'REWARDS' | 'BROADCASTS'>('REWARDS');
    const [messages, setMessages] = createSignal<any[]>([]);
    const [news, setNews] = createSignal<any[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);

    onMount(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [inboxRes, newsRes] = await Promise.all([
                    api.cms.inbox(user.id, 'en'),
                    api.cms.news('en')
                ]);
                if (inboxRes.success) setMessages(inboxRes.data || []);
                if (newsRes.success) setNews(newsRes.data || []);
            } catch (err) {
                console.error("Data Sync Failed", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    });

    return (
        <div class="w-full h-full flex flex-col bg-transparent overflow-hidden">
            <StandardHeader 
                title={`\u00A0\u00A0${t('NAV_INBOX')}`} 
                rightContent={
                    <div class="flex gap-1 items-center mr-1">
                        <SlantedButton 
                            variant={activeTab() === 'REWARDS' ? 'primary' : 'secondary'} 
                            size="xs"
                            onClick={() => setActiveTab('REWARDS')}
                            class="!w-[14vw] max-w-[3.5rem] !h-[1.5rem]"
                        >
                            MAIL
                        </SlantedButton>
                        <SlantedButton 
                            variant={activeTab() === 'BROADCASTS' ? 'primary' : 'secondary'} 
                            size="xs"
                            onClick={() => setActiveTab('BROADCASTS')}
                            class="!w-[14vw] max-w-[3.5rem] !h-[1.5rem]"
                        >
                            NEWS
                        </SlantedButton>
                    </div>
                }
            />

            <div class="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                <Show when={!isLoading()} fallback={
                    <div class="flex items-center justify-center py-20 opacity-20">
                         <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                }>
                    <Show when={activeTab() === 'REWARDS'} fallback={
                        <div class="space-y-4 animate-pop">
                            <div class="px-1 mb-2">
                                <h2 class="text-[0.6rem] font-black text-indigo-400 uppercase tracking-[0.4em]">{t('NEWS_SECTOR_ANNOUNCE')}</h2>
                            </div>
                            <For each={news()}>
                                {(item) => (
                                    <NewsCard type={item.type} title={item.title} subtitle={item.subtitle} imageColor={item.color} />
                                )}
                            </For>
                        </div>
                    }>
                        <div class="space-y-3 animate-pop">
                            <For each={messages()}>
                                {(msg) => (
                                    <InboxItem 
                                        type={msg.type}
                                        title={msg.title} 
                                        message={msg.body} 
                                        isRead={msg.isRead}
                                        rewardLabel={msg.ctaLabel}
                                        onClaim={() => console.log('Claimed', msg.id)}
                                    />
                                )}
                            </For>
                            
                            <Show when={messages().length === 0}>
                                <div class="text-center py-20 opacity-30">
                                    <p class="text-[0.6rem] font-black text-slate-500 uppercase tracking-widest italic">{t('INBOX_EMPTY')}</p>
                                </div>
                            </Show>
                        </div>
                    </Show>
                </Show>
            </div>
        </div>
    );
};
