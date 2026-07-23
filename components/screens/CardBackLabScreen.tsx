import { createSignal, For, Show } from 'solid-js';
import { CardBackMaterial, type CardBackMotion, type CardBackVariant } from '../game-surfaces/system/CardBackMaterial';
import { enableGyro, gyroActive } from '../ui/shiny';
import '../../src/styles/card-back-lab.css';

const variants: CardBackVariant[] = ['onyx', 'ivory'];
const motionModes: CardBackMotion[] = ['dynamic', 'static', 'off'];

export const CardBackLabScreen = () => {
  const [variant, setVariant] = createSignal<CardBackVariant>('onyx');
  const [motion, setMotion] = createSignal<CardBackMotion>('dynamic');
  const [showMask, setShowMask] = createSignal(false);
  const [gyroDenied, setGyroDenied] = createSignal(false);

  const requestGyro = async () => {
    const enabled = await enableGyro();
    setGyroDenied(!enabled);
  };

  return (
    <main class="card-back-lab" data-show-mask={showMask()}>
      <header class="card-back-lab__toolbar">
        <div>
          <span>Material proof 04</span>
          <h1>Card Back Optics</h1>
        </div>

        <div class="card-back-lab__controls">
          <div class="card-back-lab__segments" aria-label="Card-back color">
            <For each={variants}>{item => (
              <button classList={{ active: variant() === item }} onClick={() => setVariant(item)}>{item}</button>
            )}</For>
          </div>
          <div class="card-back-lab__segments" aria-label="Reflection quality">
            <For each={motionModes}>{item => (
              <button classList={{ active: motion() === item }} onClick={() => setMotion(item)}>{item}</button>
            )}</For>
          </div>
          <label class="card-back-lab__toggle">
            <input type="checkbox" checked={showMask()} onInput={event => setShowMask(event.currentTarget.checked)} />
            Mask
          </label>
          <button class="card-back-lab__command" disabled={gyroActive()} onClick={() => void requestGyro()}>
            {gyroActive() ? 'Tilt active' : 'Enable tilt'}
          </button>
        </div>
      </header>

      <Show when={gyroDenied()}>
        <div class="card-back-lab__notice">Device orientation is unavailable or permission was declined.</div>
      </Show>

      <section class="card-back-lab__stage">
        <div class="card-back-lab__hero">
          <CardBackMaterial variant={variant()} motion={motion()} />
        </div>
        <aside class="card-back-lab__notes">
          <div><span>01</span><strong>Base artwork</strong><small>Photographic dimension and substrate</small></div>
          <div><span>02</span><strong>Gold response</strong><small>Soft mask reinforces the metal</small></div>
          <div><span>03</span><strong>Key light</strong><small>Upper-right studio source</small></div>
          <div><span>04</span><strong>Reflection film</strong><small>Pointer and device orientation</small></div>
        </aside>
      </section>

      <section class="card-back-lab__scale-proof">
        <header><span>Gameplay proof</span><strong>Same component, production scales</strong></header>
        <div class="card-back-lab__scale-row">
          <For each={[58, 74, 104, 148]}>{width => (
            <figure style={{ width: `${width}px` }}>
              <CardBackMaterial variant={variant()} motion={motion()} />
              <figcaption>{width}px</figcaption>
            </figure>
          )}</For>
        </div>
      </section>

      <img class="card-back-lab__mask-preview" src="/art/card-backs/scg-back-gold-mask.png" alt="Generated gold response mask" />
    </main>
  );
};
