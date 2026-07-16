import { For, Match, Switch, type JSX } from 'solid-js';
import type { CruelMarkupTokenV1 } from '../../semantic-compiler/rich-text/cruelMarkupV1';

const renderTokens = (tokens: CruelMarkupTokenV1[]): JSX.Element => (
  <For each={tokens}>{(token) => (
    <Switch>
      <Match when={token.type === 'text'}>{token.type === 'text' ? token.text : null}</Match>
      <Match when={token.type === 'break'}><br /></Match>
      <Match when={token.type === 'rule'}><span class="mission-rich-rule" aria-hidden="true" /></Match>
      <Match when={token.type === 'divider'}><span class="mission-rich-divider" aria-hidden="true" /></Match>
      <Match when={token.type === 'tag'}>
        {token.type === 'tag' ? <span class={`mission-rich-token mission-rich-token--${token.tag}`}>{renderTokens(token.children)}</span> : null}
      </Match>
    </Switch>
  )}</For>
);

export const CompiledRichText = (props: { tokens: CruelMarkupTokenV1[]; class?: string }) => (
  <span class={props.class}>{renderTokens(props.tokens)}</span>
);
