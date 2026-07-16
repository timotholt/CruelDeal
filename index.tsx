import { render } from 'solid-js/web';
import App from './App';
import '@fontsource/ibm-plex-sans-condensed/latin-400.css';
import '@fontsource/ibm-plex-sans-condensed/latin-600.css';
import '@fontsource/ibm-plex-sans-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-400.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
// The /play game's CSS (ported wholesale from the vfx-engine demo).
// Imported BEFORE index.css so Tailwind's @import and the font @import
// in index.css are not split across other statements in the bundled output.
import './src/styles/playgame.css';
import './index.css';
import './src/styles/app-viewport.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

document.fonts.ready.then(() => {
  document.body.classList.add('fonts-ready');
});

render(() => <App />, rootElement);
