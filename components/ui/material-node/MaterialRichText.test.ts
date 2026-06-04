import { strict as assert } from 'node:assert';
import { parseMaterialRichText } from './MaterialRichText';

const parsed = parseMaterialRichText('[body]Copy[/body] [button]Not a CTA[/button]');

assert.deepEqual(parsed[0], {
  type: 'tag',
  tag: 'body',
  children: [{ type: 'text', text: 'Copy' }],
});
assert.equal(parsed.slice(1).some((token) => token.type === 'tag' && (token.tag as string) === 'button'), false);
assert.equal(
  parsed.map((token) => token.type === 'text' ? token.text : '').join('').includes('[button]Not a CTA[/button]'),
  true,
);
