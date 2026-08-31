import { useEffect, useRef } from 'react';
import { Engine } from '../engine/core/Engine.ts';
import { PlayableScene } from '../game/scenes/PlayableScene.ts';
import { GAME_CONFIG } from '../game/config/gameConfig.ts';

interface CanvasContainerProps {
  onEngineReady?: () => void;
}

/**
 * React container component hosting the single HTML5 Canvas element.
 * Manages the lifecycle of the underlying Rush Engine instance.
 * Dynamically enforces touch-action: none post-initialization to block mobile gesture conflicts.
 */
export function CanvasContainer({ onEngineReady }: CanvasContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const onEngineReadyRef = useRef(onEngineReady);
  onEngineReadyRef.current = onEngineReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas) return;

    // Helper to dynamically apply and lock non-gesture touch styles
    const applyTouchLock = (element: HTMLElement | null) => {
      if (!element) return;
      element.style.touchAction = 'none';
      element.style.setProperty('touch-action', 'none', 'important');
      element.style.setProperty('-webkit-touch-callout', 'none', 'important');
      element.style.setProperty('-webkit-user-select', 'none', 'important');
      element.style.setProperty('user-select', 'none', 'important');
    };

    // Pre-initialization touch lockdown
    applyTouchLock(canvas);
    applyTouchLock(container);

    // Bootstrap Rush Engine directly with PlayableScene
    const engine = Engine.bootstrap({
      canvas,
      initialScene: new PlayableScene(),
      canvasOptions: {
        autoResize: GAME_CONFIG.autoResize,
        maxDpr: GAME_CONFIG.maxDpr,
      },
      rendererOptions: {
        backgroundColor: GAME_CONFIG.backgroundColor,
      },
      loopOptions: {
        fixedDeltaTime: GAME_CONFIG.fixedTimeStep,
      },
    });

    engineRef.current = engine;
    engine.start();

    // Post-initialization validation: verify and re-enforce touch-action: none
    applyTouchLock(canvas);
    applyTouchLock(container);

    if (typeof window !== 'undefined') {
      const computed = window.getComputedStyle(canvas);
      if (computed.touchAction !== 'none') {
        canvas.style.setProperty('touch-action', 'none', 'important');
      }
    }

    if (onEngineReadyRef.current) {
      onEngineReadyRef.current();
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return (
    <div
      id="game-canvas-container"
      ref={containerRef}
      style={{ touchAction: 'none' }}
      className="game-touch-surface relative w-full h-full overflow-hidden bg-black select-none touch-none"
    >
      <canvas
        id="game-canvas"
        ref={canvasRef}
        style={{ touchAction: 'none' }}
        onContextMenu={(e) => e.preventDefault()}
        className="game-touch-surface block w-full h-full cursor-pointer touch-none outline-none"
        tabIndex={0}
      />
    </div>
  );
}
