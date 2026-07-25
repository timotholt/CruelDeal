import { CruelCompanyCardBackArtwork } from './CruelCompanyCardBackArtwork';
import { CruelCompanyCardBackFinish } from './CruelCompanyCardBackFinish';
import { CruelCompanyCardBackReflection } from './CruelCompanyCardBackReflection';
import { CruelCompanyCardBackThree } from './CruelCompanyCardBackThree';
import type { CardBackDesign } from './cardBackTypes';

export const CRUEL_COMPANY_CARD_BACK_DESIGN: CardBackDesign = {
  id: 'cruel-company-master-01',
  defaultCopy: {
    caption: 'CC',
    emblem: 'CC',
    microTextA: 'REF. CC-001 [CO 07]',
    microTextB: 'CRUEL COMPANY / UNIT 01',
  },
  Surface: CruelCompanyCardBackThree,
  Artwork: CruelCompanyCardBackArtwork,
  Finish: CruelCompanyCardBackFinish,
  Reflection: CruelCompanyCardBackReflection,
};
