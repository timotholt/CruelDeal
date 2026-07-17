import { For, Show } from 'solid-js';
import type {
  MissionBriefingComponentPlanV1,
  RuntimeContentV1,
  RuntimeNumberV1,
} from '../../semantic-compiler/mission-briefing/missionBriefingComponentCompiler';
import type { UiActionEventHandler } from '../actions/UiActionEvent';
import { CompiledFingerprintHoldAction } from '../fingerprint-hold/CompiledFingerprintHoldAction';
import type { FingerprintHoldState } from '../fingerprint-hold/fingerprintHoldController';
import { CompiledRichText } from '../rich-text/CompiledRichText';
import { compileCruelMarkupV1 } from '../../semantic-compiler/rich-text/cruelMarkupV1';
import type { AppearancePartId } from '../../semantic-compiler/paint/paintSource';
import type { PaintShellClassMapV1 } from '../../semantic-compiler/paint/paintCompiler';

const contentValue = (
  source: RuntimeContentV1 | undefined,
  resolveBinding?: (key: string) => string | number | undefined,
) => {
  if (!source) return '';
  return source.kind === 'literal' ? source.plainText : String(resolveBinding?.(source.key) ?? '');
};
const contentTokens = (
  source: RuntimeContentV1,
  resolveBinding?: (key: string) => string | number | undefined,
) => source.kind === 'literal'
  ? source.tokens
  : compileCruelMarkupV1(String(resolveBinding?.(source.key) ?? ''), 'plain').tokens;
const numericValue = (
  source: RuntimeNumberV1,
  resolveBinding?: (key: string) => string | number | undefined,
) => (source.kind === 'literal' ? source.value : resolveBinding?.(source.key) ?? '—');

const actionPaintClass = (
  plan: MissionBriefingComponentPlanV1,
  state: FingerprintHoldState,
) => {
  if (plan.component.action.disabled) return plan.classMap.primaryAction.disabled;
  if (state === 'holding') return plan.classMap.primaryAction.holding;
  if (state === 'complete') return plan.classMap.primaryAction.complete;
  return plan.classMap.primaryAction.idle;
};

const actionShellClass = (
  plan: MissionBriefingComponentPlanV1,
  state: FingerprintHoldState,
): PaintShellClassMapV1 => {
  const shell = plan.shellMap?.primaryAction;
  if (!shell) return {};
  if (plan.component.action.disabled) return shell.disabled;
  if (state === 'holding') return shell.holding;
  if (state === 'complete') return shell.complete;
  return shell.idle;
};

const CompiledPaintHelper = (props: {
  slot: 'underlay' | 'overlay';
  class?: string;
}) => (
  <Show when={props.class}>
    {(paintClass) => (
      <span
        class={`ui-paint-helper ui-paint-helper--${props.slot} ${paintClass()}`}
        data-paint-helper={props.slot}
        aria-hidden="true"
      />
    )}
  </Show>
);

export const MissionBriefingRuntime = (props: {
  plan: MissionBriefingComponentPlanV1;
  resolveBinding?: (key: string) => string | number | undefined;
  selectionClassForPart?: (part: AppearancePartId) => string;
  onAction: UiActionEventHandler;
}) => {
  const progressMarks = () => {
    const progress = props.plan.component.content.progress;
    return progress ? Array.from({ length: progress.total }, (_, index) => index < progress.completed) : [];
  };
  const content = () => props.plan.component.content;
  const terms = () => content().terms;
  const classForPart = (base: string, part: AppearancePartId) => (
    [base, props.selectionClassForPart?.(part)].filter(Boolean).join(' ')
  );
  return (
    <section
      class={classForPart(`mission-briefing-runtime ${props.plan.classMap.panel}`, 'panel')}
      data-semantic-component="MissionBriefing"
      data-component-instance-id={props.plan.component.componentInstanceId}
      data-compiled-plan-version={props.plan.compilerVersion}
      aria-labelledby={`${props.plan.component.componentInstanceId}-title`}
    >
      <CompiledPaintHelper slot="underlay" class={props.plan.shellMap?.panel.underlay} />
      <div class="mission-briefing-runtime__narrative">
        <Show when={contentValue(content().availabilityStatus, props.resolveBinding)}>
          {(value) => <p class={`mission-briefing-runtime__availability ${props.plan.classMap.typography.availability}`}><span>//</span> {value()}</p>}
        </Show>
        <h1 id={`${props.plan.component.componentInstanceId}-title`} class={props.plan.classMap.typography.title}>
          <CompiledRichText tokens={contentTokens(content().title, props.resolveBinding)} />
        </h1>
        <Show when={progressMarks().length}>
          <div class="mission-briefing-runtime__progress" aria-label={`${content().progress!.completed} of ${content().progress!.total}`}>
            <For each={progressMarks()}>{(complete) => <i class={complete ? 'is-complete' : ''} />}</For>
          </div>
        </Show>
        <p class={`mission-briefing-runtime__body ${props.plan.classMap.typography.body}`}><CompiledRichText tokens={contentTokens(content().body, props.resolveBinding)} /></p>
      </div>
      <div class={classForPart(`mission-briefing-runtime__footer ${props.plan.classMap.terms}`, 'terms')}>
        <CompiledPaintHelper slot="underlay" class={props.plan.shellMap?.terms.underlay} />
        <dl class="mission-briefing-runtime__terms">
          <Show when={terms().deposit}>
            {(deposit) => (
              <div><dt class={props.plan.classMap.typography.termLabel}>Deposit:</dt><dd class={props.plan.classMap.typography.termValue}>{numericValue(deposit().amount, props.resolveBinding)} <span>CR</span></dd></div>
            )}
          </Show>
          <div><dt class={props.plan.classMap.typography.termLabel}>Success:</dt><dd class={props.plan.classMap.typography.termValue}>{numericValue(terms().successReward.amount, props.resolveBinding)} <span>CR</span></dd></div>
        </dl>
        <CompiledFingerprintHoldAction
          plan={props.plan.component.action}
          class={classForPart(`mission-briefing-runtime__action ${props.plan.classMap.typography.actionLabel}`, 'primaryAction')}
          classForState={(state) => actionPaintClass(props.plan, state)}
          shellSlots={props.plan.shellMap?.primaryAction.slots}
          shellForState={(state) => actionShellClass(props.plan, state)}
          label={contentValue(content().primaryActionLabel, props.resolveBinding)}
          onAction={props.onAction}
        />
        <CompiledPaintHelper slot="overlay" class={props.plan.shellMap?.terms.overlay} />
      </div>
      <CompiledPaintHelper slot="overlay" class={props.plan.shellMap?.panel.overlay} />
    </section>
  );
};
