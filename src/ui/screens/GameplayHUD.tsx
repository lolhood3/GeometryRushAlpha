import { useState, useEffect, type SyntheticEvent } from 'react';
import { Pause, Flame, Target, Activity } from 'lucide-react';
import { GameStateManager } from '../../game/state/GameState.ts';
import { SoundManager } from '../../engine/audio/SoundManager.ts';

interface GameplayHUDProps {
  progress: number; // 0 to 100
  attempt: number;
  onPause: () => void;
}

export function GameplayHUD({ progress, attempt, onPause }: GameplayHUDProps) {
  const gameState = GameStateManager.getInstance();
  const settings = gameState.getSettings();

  const [fps, setFps] = useState(60);

  useEffect(() => {
    if (!settings.showFps) return;
    let frameCount = 0;
    let lastTime = performance.now();

    const calcFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 500) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(calcFps);
    };

    let animId = requestAnimationFrame(calcFps);
    return () => cancelAnimationFrame(animId);
  }, [settings.showFps]);

  const handlePause = (e?: SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
    }
    SoundManager.getInstance().playClick();
    onPause();
  };

  return (
    <div
      id="gameplay-hud"
      className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between safe-p select-none"
    >
      {/* Top Bar: Progress & Pause Button */}
      <div className="flex items-center justify-between gap-3 sm:gap-4 pointer-events-none">
        {/* Top-Left Attempt Counter */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div
            className={`flex items-center gap-2 rounded-2xl border px-3.5 py-1.5 backdrop-blur-md shadow-lg ${
              settings.highContrastHUD
                ? 'border-neutral-700 bg-black/95 text-white'
                : 'border-neutral-800/90 bg-neutral-950/80 text-neutral-300'
            }`}
          >
            <Target className="h-3.5 w-3.5 text-[#00E5FF]" />
            <span className="font-mono text-xs font-bold tracking-wider uppercase">
              Attempt <strong className="text-white">#{attempt}</strong>
            </span>
          </div>

          {/* Optional FPS Display */}
          {settings.showFps && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-2xl border border-neutral-800/90 bg-neutral-950/80 px-3 py-1.5 font-mono text-xs text-emerald-400 backdrop-blur-md shadow-lg">
              <Activity className="h-3 w-3" />
              <span>{fps} FPS</span>
            </div>
          )}
        </div>

        {/* Top-Center Sleek Linear Progress Bar */}
        {settings.showProgressPercentage && (
          <div className="flex flex-1 max-w-xs sm:max-w-md items-center gap-3">
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-neutral-900/90 border border-neutral-800/80 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-[#00E5FF] to-[#00FF88] transition-all duration-75 shadow-[0_0_12px_rgba(0,229,255,0.8)]"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
            <span className="font-mono text-xs font-black text-neutral-300 w-10 text-right">
              {Math.floor(progress)}%
            </span>
          </div>
        )}

        {/* Top-Right Pause Button with full propagation suppression */}
        <button
          id="btn-gameplay-pause"
          type="button"
          onClick={handlePause}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (e.pointerType === 'touch') {
              handlePause(e);
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseEnter={() => SoundManager.getInstance().playHover()}
          className="pointer-events-auto flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl border border-neutral-800/90 bg-neutral-950/90 text-neutral-300 backdrop-blur-md transition-all hover:scale-105 hover:border-neutral-600 hover:bg-neutral-900 hover:text-white active:scale-95 shadow-lg cursor-pointer"
          title="Pause [Esc]"
          aria-label="Pause Game"
        >
          <Pause className="h-4 w-4 fill-current" />
        </button>
      </div>

      {/* Bottom Area: Completely clear of clutter for pure gameplay visibility */}
      <div className="pointer-events-none" />
    </div>
  );
}
