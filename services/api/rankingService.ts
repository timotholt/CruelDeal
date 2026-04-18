import { MOCK_LEADERBOARD_DATA, MOCK_PERSONAL_LADDER } from './mockData';
import { simulateNetwork } from './apiUtils';

export const rankingService = {
    async getLeaderboard() {
        await simulateNetwork(400, 800);
        return MOCK_LEADERBOARD_DATA;
    },

    async getPersonalLadderStats(_userId: string) {
        await simulateNetwork(200, 400);
        return MOCK_PERSONAL_LADDER;
    }
};