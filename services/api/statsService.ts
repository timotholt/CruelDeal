import { MOCK_HISTORY_DATA, MOCK_ACCOUNT_STATS } from './mockData';
import { simulateNetwork } from './apiUtils';

export const statsService = {
    async getBattleHistory(_userId: string) {
        await simulateNetwork(300, 600);
        return MOCK_HISTORY_DATA;
    },

    async getAccountStats(_userId: string) {
        await simulateNetwork(400, 700);
        return MOCK_ACCOUNT_STATS;
    }
};