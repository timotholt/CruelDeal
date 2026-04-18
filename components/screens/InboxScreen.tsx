
import React, { useState, useEffect } from 'react';
import { StandardHeader } from '../ui/StandardHeader';
import { InboxItem } from '../inbox/InboxItem';
import { NewsCard } from '../menu/NewsCard';
import { SlantedButton } from '../ui/SlantedButton';
import { t } from '../../services/localization';
import { api } from '../../services/api';
import { useUser } from '../../contexts/UserContext';

export const InboxScreen: React.FC = () => {
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState<'REWARDS' | 'BROADCASTS'>('REWARDS');
    const [messages, setMessages] = useState<any[]>([]);
    const [news, setNews] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
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
    }, [user.id]);

    return (
        <div className="w-full h-full flex flex-col bg-transparent overflow-hidden">
            <StandardHeader 
                title={`\u00A0\u00A0${t('NAV_INBOX')}`} 
                rightContent={
                    <div className="flex gap-1 items-center mr-1">
                        <SlantedButton 
                            variant={activeTab === 'REWARDS' ? 'primary' : 'secondary'} 
                            size="xs"
                            onClick={() => setActiveTab('REWARDS')}
                            className="!w-[14vw] max-w-[3.5rem] !h-[1.5rem]"
                        >
                            MAIL
                        </SlantedButton>
                        <SlantedButton 
                            variant={activeTab === 'BROADCASTS' ? 'primary' : 'secondary'} 
                            size="xs"
                            onClick={() => setActiveTab('BROADCASTS')}
                            className="!w-[14vw] max-w-[3.5rem] !h-[1.5rem]"
                        >
                            NEWS
                        </SlantedButton>
                    </div>
                }
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 opacity-20">
                         <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : activeTab === 'REWARDS' ? (
                    <div className="space-y-3 animate-pop">
                        {messages.map((msg) => (
                            <InboxItem 
                                key={msg.id}
                                type={msg.type}
                                title={msg.title} 
                                message={msg.body} 
                                isRead={msg.isRead}
                                rewardLabel={msg.ctaLabel}
                                onClaim={() => console.log('Claimed', msg.id)}
                            />
                        ))}
                        
                        {messages.length === 0 && (
                            <div className="text-center py-20 opacity-30">
                                <p className="text-[0.6rem] font-black text-slate-500 uppercase tracking-widest italic">{t('INBOX_EMPTY')}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 animate-pop">
                        <div className="px-1 mb-2">
                            <h2 className="text-[0.6rem] font-black text-indigo-400 uppercase tracking-[0.4em]">{t('NEWS_SECTOR_ANNOUNCE')}</h2>
                        </div>
                        {news.map(item => (
                            <NewsCard key={item.id} type={item.type} title={item.title} subtitle={item.subtitle} imageColor={item.color} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
