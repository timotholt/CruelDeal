
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';

export const Titan: CardDefinition = {
    id: 'c6',
    name: 'Titan',
    rarity: 'Epic',
    baseCost: 6,
    basePower: 12,
    tags: [],
    baseText: 'Big stats.',
    effect: 'None',
    imageUrl: getImg(6),
};
