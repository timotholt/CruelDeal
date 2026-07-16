export const cruelMarkupTags = [
  'accent', 'acc1', 'acc2', 'acc3', 'acc4', 'bright', 'normal', 'muted',
  'dim', 'dark', 'black', 'white', 'red', 'cyan', 'green', 'body', 'small',
  'h1', 'h2', 'h3', 'h4', 'gold', 'silver', 'bronze', 'kan', 'credit', 'mark',
] as const;

export type CruelMarkupTag = typeof cruelMarkupTags[number];

export type CruelMarkupTokenV1 =
  | { type: 'text'; text: string }
  | { type: 'break' }
  | { type: 'rule' }
  | { type: 'divider' }
  | { type: 'tag'; tag: CruelMarkupTag; children: CruelMarkupTokenV1[] };

const aliases: Record<string, CruelMarkupTag | 'rule' | 'divider' | 'br' | undefined> = {
  ...Object.fromEntries(cruelMarkupTags.map((tag) => [tag, tag])),
  accentcolor: 'accent', accent1: 'acc1', accent2: 'acc2', accent3: 'acc3', accent4: 'acc4',
  hr: 'rule', rule: 'rule', line: 'divider', divider: 'divider', br: 'br',
};

const normalizeTag = (value: string) => aliases[value.trim().toLowerCase()];

export const parseCruelMarkupV1 = (value: string): CruelMarkupTokenV1[] => {
  const root: CruelMarkupTokenV1[] = [];
  const stack: Array<{ tag?: CruelMarkupTag; children: CruelMarkupTokenV1[] }> = [{ children: root }];
  const appendText = (text: string) => {
    if (!text) return;
    text.split('\n').forEach((part, index) => {
      if (index) stack.at(-1)!.children.push({ type: 'break' });
      if (part) stack.at(-1)!.children.push({ type: 'text', text: part });
    });
  };

  let cursor = 0;
  const pattern = /\[([/a-zA-Z0-9_-]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    appendText(value.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    const raw = match[1];
    const closing = raw.startsWith('/');
    const tag = normalizeTag(closing ? raw.slice(1) : raw);
    if (!tag) {
      appendText(match[0]);
      continue;
    }
    if (tag === 'rule' || tag === 'divider') {
      stack.at(-1)!.children.push({ type: tag });
      continue;
    }
    if (tag === 'br') {
      stack.at(-1)!.children.push({ type: 'break' });
      continue;
    }
    const top = stack.at(-1)!;
    if ((closing || top.tag === tag) && stack.length > 1) {
      const closingIndex = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (closingIndex > 0) {
        while (stack.length - 1 >= closingIndex) {
          const frame = stack.pop()!;
          stack.at(-1)!.children.push({ type: 'tag', tag: frame.tag!, children: frame.children });
        }
      }
      continue;
    }
    stack.push({ tag, children: [] });
  }
  appendText(value.slice(cursor));
  while (stack.length > 1) {
    const frame = stack.pop()!;
    stack.at(-1)!.children.push({ type: 'tag', tag: frame.tag!, children: frame.children });
  }
  return root;
};

export const plainTextFromCruelMarkupV1 = (tokens: CruelMarkupTokenV1[]): string => tokens.map((token) => {
  if (token.type === 'text') return token.text;
  if (token.type === 'break') return '\n';
  if (token.type === 'rule' || token.type === 'divider') return ' ';
  return plainTextFromCruelMarkupV1(token.children);
}).join('');

export const compileCruelMarkupV1 = (value: string, format: 'plain' | 'cruel-markup-v1') => {
  const tokens = format === 'cruel-markup-v1'
    ? parseCruelMarkupV1(value)
    : value.split('\n').flatMap<CruelMarkupTokenV1>((part, index) => [
      ...(index ? [{ type: 'break' as const }] : []),
      ...(part ? [{ type: 'text' as const, text: part }] : []),
    ]);
  return { tokens, plainText: format === 'plain' ? value : plainTextFromCruelMarkupV1(tokens) };
};
