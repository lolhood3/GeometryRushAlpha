import '@fontsource-variable/unbounded/wght.css';
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import './ui/styles/base.css';
import './ui/styles/components.css';
import './ui/styles/screens.css';
import './ui/styles/hud.css';
import './ui/styles/settings.css';
import './ui/styles/records.css';
import { render } from 'preact';
// Imported first: the orientation gate must see input before the app does.
import { RotateGate } from './ui/components/rotate.tsx';
import { App } from './ui/app.tsx';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const root = document.getElementById('ui') as HTMLElement;
render(<App canvas={canvas} />, root);
render(<RotateGate />, document.getElementById('gate') as HTMLElement);
