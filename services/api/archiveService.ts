import { MOCK_COMIC_DATA, MOCK_INVENTORY_DATA } from './mockData';
import { simulateNetwork } from './apiUtils';

export const archiveService = {
    async getComicArchive() {
        await simulateNetwork(300, 500);
        return MOCK_COMIC_DATA;
    },

    async getInventoryStash(_userId: string) {
        await simulateNetwork(200, 400);
        return MOCK_INVENTORY_DATA;
    }
};