
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';

export const Recruit: CardDefinition = {
  id: 'c1',
  name: 'Recruit',
  rarity: 'Common',
  baseCost: 1,
  basePower: 2,
  tags: [],
  baseText: 'No ability.',
  effect: 'None',
  imageUrl: getImg(1),
  
  // Assets
  sfxOnPlay: 'sfx_deploy_soldier',
};
