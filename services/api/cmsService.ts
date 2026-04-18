import { MOCK_INBOX_DATA, MOCK_NEWS_DATA, MOCK_MAIN_MENU_DATA, MOCK_PREMIUM_MODAL_DATA } from './mockData';
import { simulateNetwork } from './apiUtils';

export const cmsService = {
    async getInbox(userId: string, locale: string = 'en') {
        await simulateNetwork(200, 400);
        return (MOCK_INBOX_DATA as any)[locale] || MOCK_INBOX_DATA.en;
    },

    async getNews(locale: string = 'en') {
        await simulateNetwork(300, 500);
        return (MOCK_NEWS_DATA as any)[locale] || MOCK_NEWS_DATA.en;
    },

    async getMainMenuContent(locale: string = 'en') {
        await simulateNetwork(100, 300);
        return (MOCK_MAIN_MENU_DATA as any)[locale] || MOCK_MAIN_MENU_DATA.en;
    },

    async getPremiumModalContent(locale: string = 'en') {
        await simulateNetwork(200, 500);
        return (MOCK_PREMIUM_MODAL_DATA as any)[locale] || MOCK_PREMIUM_MODAL_DATA.en;
    }
};