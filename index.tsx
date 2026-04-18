import { render } from 'solid-js/web';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

document.fonts.ready.then(() => {
  document.body.classList.add('fonts-ready');
});

render(() => <App />, rootElement);