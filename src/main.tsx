import '@fontsource-variable/unbounded/wght.css';
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import './ui/styles/base.css';
import './ui/styles/components.css';
import './ui/styles/screens.css';
import './ui/styles/hud.css';
import { render } from 'preact';
import { App } from './ui/app.tsx';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const root = document.getElementById('ui') as HTMLElement;
render(<App canvas={canvas} />, root);
