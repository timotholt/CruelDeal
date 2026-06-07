import { For, JSX, Show } from 'solid-js';
import type { FeedCardTypeRecipe, FeedTextSlotStyle } from './mainMaterialFeedModel';
import {
  feedRichTextVars,
  parseFeedRichText,
  richTextTagOverridesOpacity,
  type FeedRichTextTag,
  type FeedRichTextToken,
} from './mainMaterialFeedText';

export const FeedRichText = (props: { value: string; cardType: FeedCardTypeRecipe; style: FeedTextSlotStyle }) => {
  const tokens = () => parseFeedRichText(props.value);
  const renderTokens = (items: FeedRichTextToken[], insideTag = false): JSX.Element => (
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
            const tag = (token as { tag: FeedRichTextTag }).tag;
            return (
              <span
                class={`main-material-rich-token main-material-rich-token--${tag}`}
                classList={{ 'main-material-rich-token--opacity-override': richTextTagOverridesOpacity(props.cardType, tag) }}
              >
                {renderTokens((token as { children: FeedRichTextToken[] }).children, true)}
              </span>
            );
          })()}
        </Show>
      )}
    </For>
  );
  return (
    <span class="main-material-rich-text" style={feedRichTextVars(props.cardType, props.style)}>
      {renderTokens(tokens())}
    </span>
  );
};
