import { useRef } from 'preact/hooks';
import { getLevel, LEVEL_IDS, TOTAL_SHARDS } from '../../game/levels/index.ts';
import { ACHIEVEMENTS } from '../../game/progression/achievements.ts';
import { findChassis, findPaint, starsEarned, totalStars } from '../../game/progression/cosmetics.ts';
import { completedCount, isLevelUnlocked, totalShards } from '../../game/progression/profile.ts';
import { ChassisIcon } from '../components/chassis.tsx';
import { IconArrow, IconPlay, IconShard, IconStar, IconVolume } from '../components/icons.tsx';
import { type ScreenId, useApp, useArrowNav, useFrame, useProfile } from '../context.ts';

const ITEMS: { id: ScreenId; label: string; note: string }[] = [
  { id: 'levels', label: 'Levels', note: 'Five tracks' },
  { id: 'garage', label: 'Garage', note: 'Chassis · paint · trails' },
  { id: 'records', label: 'Records', note: 'Stats · achievements' },
  { id: 'settings', label: 'Settings', note: 'Audio · video · sync' },
  { id: 'credits', label: 'Credits', note: 'Rush Engine 2' },
];

export function MainMenu() {
  const app = useApp();
  const profile = useProfile();
  const nav = useArrowNav();
  const mark = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (mark.current) mark.current.style.setProperty('--pulse', app.game.live.pulse.toFixed(3));
  });

  // "Play" resumes where the player left off: the last level, or the next one once it is cleared.
  let target = profile.lastLevel;
  const idx = (LEVEL_IDS as readonly string[]).indexOf(target);
  const next = LEVEL_IDS[idx + 1];
  if (profile.levels[target].completed && next && isLevelUnlocked(profile, next) && !profile.levels[next].completed) target = next;
  if (!isLevelUnlocked(profile, target)) target = LEVEL_IDS[0];
  const level = getLevel(target);
  const rec = profile.levels[target];
  const fresh = rec.attempts === 0;
  const unseen = app.store.unseen().length;
  const achieved = Object.keys(profile.achievements).length;
  const chassis = findChassis(profile.loadout.chassis);

  return (
    <div class="screen menu" ref={nav}>
      <header class="menu__top">
        <div class="brand" ref={mark}>
          <span class="brand__mark" />
          <span class="brand__text">RUSH ENGINE <b>2</b></span>
        </div>
        <div class="menu__status">
          <span class="stat-chip" title="Stars earned"><IconStar size={14} /><b>{starsEarned(profile)}</b><i>/{totalStars()}</i></span>
          <span class="stat-chip" title="Shards banked"><IconShard size={13} /><b>{totalShards(profile)}</b><i>/{TOTAL_SHARDS}</i></span>
          <button type="button" class="icon-btn" aria-label={profile.settings.muted ? 'Unmute' : 'Mute'}
            onClick={() => app.store.updateSettings({ muted: !profile.settings.muted })}>
            <IconVolume muted={profile.settings.muted} />
          </button>
        </div>
      </header>

      <main class="menu__main">
        <h1 class="logo" aria-label="Geometry Rush V.2">
          <span class="logo__line">GEOMETRY</span>
          <span class="logo__line logo__line--rush">RUSH<em>V.2</em></span>
        </h1>
        <p class="menu__tagline">One button. Five tracks. Everything on the beat.</p>

        <button type="button" class="play-card cut" data-autofocus
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') app.sound('hover'); }}
          onClick={() => { app.sound('start'); app.play(target, false); }}>
          <span class="play-card__icon"><IconPlay size={22} /></span>
          <span class="play-card__text">
            <span class="play-card__label">{fresh ? 'Play' : rec.completed ? 'Replay' : 'Continue'}</span>
            <span class="play-card__level">
              <span class="mono">{String(level.meta.index + 1).padStart(2, '0')}</span> {level.meta.name}
              <span class="play-card__pct">{rec.completed ? 'Cleared' : fresh ? level.meta.difficulty : `Best ${rec.best}%`}</span>
            </span>
          </span>
          <span class="play-card__bar"><span style={{ width: `${rec.best}%` }} /></span>
        </button>

        <nav class="menu__list" aria-label="Main">
          {ITEMS.map((item, i) => (
            <button type="button" key={item.id} class="menu-item"
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') app.sound('hover'); }}
              onClick={() => { app.sound('click'); app.go(item.id); }}>
              <span class="menu-item__index mono">{String(i + 2).padStart(2, '0')}</span>
              <span class="menu-item__label">{item.label}</span>
              {item.id === 'garage' && unseen > 0 && <span class="badge">{unseen} new</span>}
              <span class="menu-item__note">{item.note}</span>
              <IconArrow class="menu-item__arrow" size={18} />
            </button>
          ))}
        </nav>
      </main>

      <footer class="menu__foot">
        <button type="button" class="pilot" onClick={() => { app.sound('click'); app.go('garage'); }} aria-label="Open garage">
          <ChassisIcon chassis={chassis} primary={findPaint(profile.loadout.primary).hex} secondary={findPaint(profile.loadout.secondary).hex} size={34} />
          <span>
            <b>{chassis.name}</b>
            <i>{completedCount(profile)}/{LEVEL_IDS.length} cleared · {achieved}/{ACHIEVEMENTS.length} achievements</i>
          </span>
        </button>
        <span class="menu__credit">Created by <b>Ankan Barik</b></span>
      </footer>
    </div>
  );
}
