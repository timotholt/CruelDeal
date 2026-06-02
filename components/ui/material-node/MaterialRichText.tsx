import { For, JSX, Show } from 'solid-js';

export type MaterialRichTextTag =
  | 'accent'
  | 'acc1'
  | 'acc2'
  | 'acc3'
  | 'acc4'
  | 'bright'
  | 'normal'
  | 'muted'
  | 'dim'
  | 'dark'
  | 'black'
  | 'white'
  | 'red'
  | 'cyan'
  | 'green'
  | 'small'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4';

export type MaterialRichTextToken =
  | { type: 'text'; text: string }
  | { type: 'break' }
  | { type: 'rule' }
  | { type: 'divider' }
  | { type: 'tag'; tag: MaterialRichTextTag; children: MaterialRichTextToken[] };

const richTextTagAliases: Record<string, MaterialRichTextTag | 'rule' | 'divider' | 'br' | undefined> = {
  accent: 'accent',
  accentcolor: 'accent',
  acc1: 'acc1',
  accent1: 'acc1',
  acc2: 'acc2',
  accent2: 'acc2',
  acc3: 'acc3',
  accent3: 'acc3',
  acc4: 'acc4',
  accent4: 'acc4',
  bright: 'bright',
  normal: 'normal',
  muted: 'muted',
  dim: 'dim',
  dark: 'dark',
  black: 'black',
  white: 'white',
  red: 'red',
  cyan: 'cyan',
  green: 'green',
  small: 'small',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  rule: 'rule',
  hr: 'rule',
  divider: 'divider',
  line: 'divider',
  br: 'br',
};

const normalizeRichTextTag = (value: string) => richTextTagAliases[value.trim().toLowerCase()];

export const parseMaterialRichText = (value: string): MaterialRichTextToken[] => {
  const root: MaterialRichTextToken[] = [];
  const stack: Array<{ tag?: MaterialRichTextTag; children: MaterialRichTextToken[] }> = [{ children: root }];
  const appendText = (text: string) => {
    if (!text) return;
    const parts = text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) stack[stack.length - 1].children.push({ type: 'break' });
      if (part) stack[stack.length - 1].children.push({ type: 'text', text: part });
    });
  };

  let cursor = 0;
  const tagPattern = /\[([/a-zA-Z0-9_-]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(value))) {
    appendText(value.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const rawTag = match[1];
    const isClose = rawTag.startsWith('/');
    const tag = normalizeRichTextTag(isClose ? rawTag.slice(1) : rawTag);
    if (!tag) {
      appendText(match[0]);
      continue;
    }
    if (tag === 'rule') {
      stack[stack.length - 1].children.push({ type: 'rule' });
      continue;
    }
    if (tag === 'divider') {
      stack[stack.length - 1].children.push({ type: 'divider' });
      continue;
    }
    if (tag === 'br') {
      stack[stack.length - 1].children.push({ type: 'break' });
      continue;
    }

    const top = stack[stack.length - 1];
    if ((isClose || top.tag === tag) && stack.length > 1) {
      const closingIndex = stack.map((entry) => entry.tag).lastIndexOf(tag);
      if (closingIndex > 0) {
        while (stack.length - 1 >= closingIndex) {
          const frame = stack.pop();
          if (!frame?.tag) break;
          stack[stack.length - 1].children.push({ type: 'tag', tag: frame.tag, children: frame.children });
        }
      }
      continue;
    }

    stack.push({ tag, children: [] });
  }
  appendText(value.slice(cursor));
  while (stack.length > 1) {
    const frame = stack.pop();
    if (!frame?.tag) break;
    stack[stack.length - 1].children.push({ type: 'tag', tag: frame.tag, children: frame.children });
  }
  return root;
};

export const MaterialRichText = (props: {
  value: string;
  class?: string;
  style?: JSX.CSSProperties;
  tagClass?: (tag: MaterialRichTextTag) => string;
  tagClassList?: (tag: MaterialRichTextTag) => Record<string, boolean>;
}) => {
  const tokens = () => parseMaterialRichText(props.value);
  const renderTokens = (items: MaterialRichTextToken[], insideTag = false): JSX.Element => (
    <For each={items}>
      {(token) => (
        <Show
          when={token.type === 'tag'}
          fallback={(
            <Show
              when={token.type === 'rule'}
              fallback={(
                <Show
                  when={token.type === 'divider'}
                  fallback={(
                    token.type === 'break'
                      ? <span class="main-material-rich-break" aria-hidden="true" />
                      : token.type === 'text'
                        ? insideTag ? token.text : <span class="main-material-rich-token main-material-rich-token--normal">{token.text}</span>
                        : null
                  )}
                >
                  <span class="main-material-rich-divider" aria-hidden="true" />
                </Show>
              )}
            >
              <span class="main-material-rich-rule" aria-hidden="true" />
            </Show>
          )}
        >
          {(() => {
            const tag = (token as { tag: MaterialRichTextTag }).tag;
            return (
              <span
                class={props.tagClass?.(tag) ?? `main-material-rich-token main-material-rich-token--${tag}`}
                classList={props.tagClassList?.(tag)}
              >
                {renderTokens((token as { children: MaterialRichTextToken[] }).children, true)}
              </span>
            );
          })()}
        </Show>
      )}
    </For>
  );

  return (
    <span class={props.class ?? 'main-material-rich-text'} style={props.style}>
      {renderTokens(tokens())}
    </span>
  );
};
