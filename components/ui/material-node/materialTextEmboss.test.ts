import { strict as assert } from 'node:assert';
import { materialTextEmbossShadow } from './materialTextEmboss';

assert.equal(materialTextEmbossShadow({ textEmbossMode: 'none', textEmbossStrength: 100 }), 'none');
assert.equal(
  materialTextEmbossShadow({
    contentTone: 'white',
    textEmbossMode: 'shadow',
    textEmbossStrength: 50,
    textEmbossOffset: 20,
    textEmbossBlur: 10,
  }),
  '2px 3px 2px rgb(0 0 0 / 0.45), 1px 2px 1px rgb(0 0 0 / 0.315)',
);
assert.equal(
  materialTextEmbossShadow({
    contentTone: 'muted',
    textEmbossMode: 'shadow',
    textEmbossStrength: 50,
    textEmbossOffset: 20,
    textEmbossBlur: 10,
  }),
  '2px 3px 2px rgb(255 255 255 / 0.325), 1px 2px 1px rgb(255 255 255 / 0.22749999999999998)',
);
