import { MODE_NAME, modeMix, type Route } from '../../game/levels/route.ts';

const pct = (v: number): string => `${(Math.max(0, Math.min(1, v)) * 100).toFixed(2)}%`;
const whole = (v: number): number => Math.floor(Math.max(0, Math.min(1, v)) * 100 + 1e-6);
const modeClass = (mode: number): string => MODE_NAME[mode].toLowerCase();

export interface RouteMarks {
  /** Best run on record, 0..1. */
  best?: number;
  /** Where the last crash happened, 0..1. */
  crash?: number;
}

/**
 * A track drawn as a strip: which vehicle you are in along the way (raised
 * where gravity is turned over), split into the parts of its song. The parts
 * are buttons; choosing one is how a practice run from that part is set up.
 */
export function RouteBar({ route, selected, onSelect, marks, label = 'Parts of the track' }: {
  route: Route;
  selected: number;
  onSelect?: (index: number) => void;
  marks?: RouteMarks;
  label?: string;
}) {
  const best = marks?.best ?? 0;
  const crash = marks?.crash ?? -1;
  const part = route.sections[Math.max(0, Math.min(route.sections.length - 1, selected))];
  return (
    <div class="route">
      <div class="route__track" aria-hidden="true">
        {route.spans.map((s, i) => (
          <i key={i} class={`route__span route__span--${modeClass(s.mode)} ${s.flipped ? 'is-flipped' : ''}`} style={{ left: pct(s.start), width: pct(s.end - s.start) }} />
        ))}
        {best > 0 && best < 1 && <i class="route__mark route__mark--best" style={{ left: pct(best) }} />}
        {crash >= 0 && <i class="route__mark route__mark--crash" style={{ left: pct(crash) }} />}
      </div>
      <div class="route__parts" role="group" aria-label={label}>
        {route.sections.map((s) => (
          <button type="button" key={s.index} class={`route__part ${s.index === part.index ? 'is-on' : ''}`} data-part={s.index}
            style={{ flexGrow: Math.max(0.001, s.end - s.start) }} disabled={!onSelect} aria-pressed={s.index === part.index}
            aria-label={`${s.name}, from ${whole(s.start)}%${s.modes.length ? `, ${s.modes.map((m) => MODE_NAME[m]).join(' and ')}` : ''}`}
            title={`${s.name} · ${whole(s.start)}%`} onClick={() => onSelect?.(s.index)}>
            <span class="route__no">{s.index + 1}</span>
            <span class="route__name">{s.name}</span>
          </button>
        ))}
      </div>
      <p class="route__cap">
        <b>{part.name}</b>
        <span class="mono">{whole(part.start)}–{whole(part.end)}%</span>
        <span>{part.modes.map((m) => MODE_NAME[m]).join(' · ')}</span>
        {crash >= 0 && crash >= part.start && crash < part.end && <em>Last crash {whole(crash)}%</em>}
        {best > 0 && best < 1 && best >= part.start && best < part.end && <em class="is-best">Best {whole(best)}%</em>}
      </p>
    </div>
  );
}

/** What a track is made of: vehicles by share of the run, gravity flips, speed and obstacle counts. */
export function RouteMix({ route, extra = [] }: { route: Route; extra?: string[] }) {
  const [lo, hi] = route.speed;
  const speed = (v: number) => `${Number(v.toFixed(2))}×`;
  return (
    <ul class="mix" aria-label="What this track is made of">
      {modeMix(route).map((m) => (
        <li key={m.mode} class="mix__mode"><i class={`mix__swatch route__span--${modeClass(m.mode)}`} />{m.name}<b class="mono">{Math.max(1, Math.round(m.share * 100))}%</b></li>
      ))}
      <li>Gravity flips<b class="mono">{route.flips}</b></li>
      <li>Speed<b class="mono">{hi > lo ? `${speed(lo)}–${speed(hi)}` : speed(lo)}</b></li>
      <li>Hazards<b class="mono">{route.hazards}</b></li>
      {extra.map((e) => <li key={e}>{e}</li>)}
    </ul>
  );
}
