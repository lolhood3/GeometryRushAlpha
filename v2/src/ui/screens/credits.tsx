import { ScreenFrame } from '../components/controls.tsx';
import { useApp, useArrowNav, useKey } from '../context.ts';

const ROLES = ['Programming', 'Game Design', 'Level Design', 'UI / UX Design'];
const ENGINE: [string, string][] = [
  ['Simulation', 'Deterministic, 240 Hz fixed step, locked to song time'],
  ['Renderer', 'WebGL2 · instanced signed-distance shapes · procedural sky'],
  ['Audio', 'Web Audio synthesis · sample-accurate sequencer · zero audio files'],
  ['Levels', 'Authored in beats · every track machine-verified beatable'],
];

export function Credits() {
  const app = useApp();
  const nav = useArrowNav();
  useKey((e) => { if (e.key === 'Escape') { app.sound('back'); app.go('menu'); } });
  return (
    <div class="screen credits" ref={nav}>
      <ScreenFrame title="Credits" index="06" onBack={() => app.go('menu')}>
        <div class="credits__body">
          <section class="credits__lead">
            <span class="eyebrow">Created by</span>
            <h2>Ankan Barik</h2>
            <ul class="credits__roles">
              {ROLES.map((r) => <li key={r}><span>{r}</span><b>Ankan Barik</b></li>)}
            </ul>
          </section>
          <section class="credits__engine cut">
            <span class="eyebrow">Powered by</span>
            <h3>Rush Engine <em>2</em></h3>
            <p>Developed by Ankan Barik. Rebuilt from the ground up for Geometry Rush V.2.</p>
            <dl>
              {ENGINE.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </section>
          <p class="credits__fine">
            Typefaces: Unbounded, Geist and Geist Mono (SIL Open Font License). Geometry Rush V.2 · build {__APP_VERSION__}
          </p>
        </div>
      </ScreenFrame>
    </div>
  );
}
