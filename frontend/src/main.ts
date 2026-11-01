import './style.css';
import { startApp } from './ui/app';

let dispose: (() => void) | undefined;
startApp().then(cleanup => { dispose = cleanup; }).catch(error => {
  const root = document.getElementById('app')!;
  root.replaceChildren();
  const panel = document.createElement('main'); panel.className = 'startup-error';
  const title = document.createElement('h1'); title.textContent = 'Unable to open this architecture.';
  const message = document.createElement('p'); message.textContent = (error as Error).message;
  const hint = document.createElement('p'); hint.textContent = 'Check public/architecture.json, then reload the page.';
  panel.append(title, message, hint); root.append(panel);
});
if (import.meta.hot) import.meta.hot.dispose(() => dispose?.());
