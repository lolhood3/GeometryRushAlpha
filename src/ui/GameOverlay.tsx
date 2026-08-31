import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Engine } from '../engine/core/Engine.ts';
import type { PlayableScene } from '../game/scenes/PlayableScene.ts';
import type { LevelData } from '../game/levels/LevelData.ts';
import { GameStateManager } from '../game/state/GameState.ts';
import { SoundManager } from '../engine/audio/SoundManager.ts';
import { RotateDeviceOverlay } from './components/RotateDeviceOverlay.tsx';
import { CrossPlatformDebugOverlay } from './components/CrossPlatformDebugOverlay.tsx';

// Individual Screens
import { SplashScreen } from './screens/SplashScreen.tsx';
import { MainMenuScreen } from './screens/MainMenuScreen.tsx';
import { LevelSelectScreen } from './screens/LevelSelectScreen.tsx';
import { SkinsScreen } from './screens/SkinsScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { CreditsScreen } from './screens/CreditsScreen.tsx';
import { UpdatesScreen } from './screens/UpdatesScreen.tsx';
import { WhatsNewModal } from './components/WhatsNewModal.tsx';
import { UpdateManager } from '../game/updates/updateManager.ts';
import { GameplayHUD } from './screens/GameplayHUD.tsx';
import { PauseMenu } from './screens/PauseMenu.tsx';
import { LevelCompleteScreen } from './screens/LevelCompleteScreen.tsx';

export type GameScreen =
  | 'splash'
  | 'main_menu'
  | 'level_select'
  | 'skins'
  | 'settings'
  | 'credits'
  | 'updates'
  | 'gameplay'
  | 'pause'
  | 'level_complete';

interface GameOverlayProps {
  isEngineReady?: boolean;
}

interface GameplayMetrics {
  progress: number;
  attempts: number;
  isVictory: boolean;
  levelName: string;
  difficulty: string;
  elapsedTime: number;
}

export function GameOverlay({ isEngineReady }: GameOverlayProps) {
  // Primary Navigation State (Defaults strictly to SPLASH)
  const [currentScreen, setCurrentScreen] = useState<GameScreen>('splash');
  const previousScreenRef = useRef<GameScreen>('main_menu');
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | undefined>(undefined);
  const [showWhatsNew, setShowWhatsNew] = useState<boolean>(false);

  const gameState = GameStateManager.getInstance();
  const updateManager = UpdateManager.getInstance();
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(() => gameState.getSettings().showCrossPlatformDebug);

  // Live Gameplay Metrics polled from PlayableScene
  const [metrics, setMetrics] = useState<GameplayMetrics>({
    progress: 0,
    attempts: 1,
    isVictory: false,
    levelName: 'Level 1: Genesis',
    difficulty: 'Easy',
    elapsedTime: 0,
  });

  const getActiveScene = (): PlayableScene | null => {
    const engine = Engine.currentInstance;
    if (!engine) return null;
    return (engine.sceneManager?.currentScene as PlayableScene) || null;
  };

  // Sync debug setting changes
  useEffect(() => {
    const checkSettings = () => {
      setShowDebugOverlay(gameState.getSettings().showCrossPlatformDebug);
    };
    window.addEventListener('focus', checkSettings);
    return () => window.removeEventListener('focus', checkSettings);
  }, [gameState]);

  // Poll active scene metrics only when needed (gameplay, pause, level_complete)
  useEffect(() => {
    if (currentScreen !== 'gameplay' && currentScreen !== 'pause') return;

    const interval = setInterval(() => {
      const scene = getActiveScene();
      if (!scene) return;

      const progress = scene.getProgress ? scene.getProgress() : 0;
      const attempts = scene.attempts ?? 1;
      const isVictory = Boolean(scene.isVictory || scene.player?.hasWon);
      const levelName = scene.levelData?.name ?? 'Level 1: Genesis';
      const difficulty = scene.levelData?.difficulty ?? 'Easy';
      const elapsedTime = scene.elapsedTime ?? 0;

      setMetrics((prev) => {
        if (
          prev.progress === progress &&
          prev.attempts === attempts &&
          prev.isVictory === isVictory &&
          prev.levelName === levelName &&
          prev.difficulty === difficulty &&
          Math.abs(prev.elapsedTime - elapsedTime) < 0.1
        ) {
          return prev;
        }
        return { progress, attempts, isVictory, levelName, difficulty, elapsedTime };
      });

      // Automatically trigger Level Complete screen if victory achieved during gameplay
      if (isVictory && currentScreen === 'gameplay') {
        setCurrentScreen('level_complete');
      }
    }, 60);

    return () => clearInterval(interval);
  }, [isEngineReady, currentScreen]);

  // Global Keyboard Navigation (e.g. Pause key [Escape] and Diagnostics [F3])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (currentScreen === 'gameplay') {
          handlePause();
        } else if (currentScreen === 'pause') {
          handleResume();
        }
      } else if (e.code === 'F3' || e.key === 'F3') {
        e.preventDefault();
        setShowDebugOverlay((prev) => {
          const nextVal = !prev;
          gameState.updateSettings({ showCrossPlatformDebug: nextVal });
          return nextVal;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentScreen, gameState]);

  // Tab / App focus & visibility handler for mobile and desktop backgrounding
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && currentScreen === 'gameplay') {
        handlePause();
      }
    };

    const handleWindowBlur = () => {
      if (currentScreen === 'gameplay') {
        handlePause();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [currentScreen]);

  const handleOrientationChange = (isPortrait: boolean) => {
    if (isPortrait && currentScreen === 'gameplay') {
      handlePause();
    }
  };

  /* =========================================================================
   * SCREEN TRANSITION HANDLERS
   * ========================================================================= */

  // 1. Splash -> Main Menu
  const handleSplashEnter = () => {
    setCurrentScreen('main_menu');
    if (updateManager.shouldShowWhatsNew()) {
      setShowWhatsNew(true);
    }
  };

  // 2. Main Menu: Play (Continues from highest unlocked level)
  const handlePlayFromMainMenu = () => {
    const highestLevel = gameState.getHighestUnlockedLevel();
    const scene = getActiveScene();
    if (scene) {
      scene.loadLevel(highestLevel, true);
      scene.resume();
    }
    setCurrentScreen('gameplay');
  };

  // 3. Main Menu -> Level Select
  const handleOpenLevelSelect = () => {
    const scene = getActiveScene();
    if (scene) scene.pause();
    setCurrentScreen('level_select');
  };

  // 4. Level Select -> Start chosen level
  const handleSelectLevel = (level: LevelData) => {
    const scene = getActiveScene();
    if (scene) {
      scene.loadLevel(level, true);
      scene.resume();
    }
    setCurrentScreen('gameplay');
  };

  // 5. Main Menu -> Skins
  const handleOpenSkins = () => {
    const scene = getActiveScene();
    if (scene) scene.pause();
    setCurrentScreen('skins');
  };

  // 6. Settings (Can be opened from Main Menu OR Pause Menu)
  const handleOpenSettings = (fromScreen: GameScreen = currentScreen) => {
    previousScreenRef.current = fromScreen;
    const scene = getActiveScene();
    if (scene) scene.pause();
    setCurrentScreen('settings');
  };

  // 7. Settings -> Back
  const handleCloseSettings = () => {
    setCurrentScreen(previousScreenRef.current);
  };

  // 8. Main Menu -> Credits
  const handleOpenCredits = () => {
    const scene = getActiveScene();
    if (scene) scene.pause();
    setCurrentScreen('credits');
  };

  // 8b. Main Menu -> Updates & News
  const handleOpenUpdates = (updateId?: string) => {
    const scene = getActiveScene();
    if (scene) scene.pause();
    setSelectedUpdateId(updateId);
    setCurrentScreen('updates');
  };

  // 9. Return to Main Menu
  const handleReturnToMainMenu = () => {
    const scene = getActiveScene();
    if (scene) scene.pause();
    SoundManager.getInstance().stopMusic();
    setCurrentScreen('main_menu');
  };

  // 10. Exit -> Splash Screen
  const handleExitToSplash = () => {
    const scene = getActiveScene();
    if (scene) scene.pause();
    SoundManager.getInstance().stopMusic();
    setCurrentScreen('splash');
  };

  // 11. Gameplay -> Pause Menu
  const handlePause = () => {
    const scene = getActiveScene();
    if (scene) scene.pause();
    setCurrentScreen('pause');
  };

  // 12. Pause Menu -> Resume Gameplay
  const handleResume = () => {
    const scene = getActiveScene();
    if (scene) scene.resume();
    setCurrentScreen('gameplay');
  };

  // 13. Pause/Complete -> Restart Current Level
  const handleRestartLevel = () => {
    const scene = getActiveScene();
    if (scene) {
      scene.restart();
      scene.resume();
    }
    setCurrentScreen('gameplay');
  };

  // 14. Level Complete -> Next Level
  const handleNextLevel = (nextLevel: LevelData) => {
    const scene = getActiveScene();
    if (scene) {
      scene.loadLevel(nextLevel, true);
      scene.resume();
    }
    setCurrentScreen('gameplay');
  };

  const activeLevelData = getActiveScene()?.levelData || gameState.getHighestUnlockedLevel();

  return (
    <div
      id="game-frontend-root"
      className={`absolute inset-0 z-20 overflow-hidden ${
        currentScreen === 'gameplay' ? 'pointer-events-none' : 'pointer-events-auto'
      }`}
    >
      <AnimatePresence mode="wait">
        {/* 1. SPLASH SCREEN */}
        {currentScreen === 'splash' && (
          <motion.div
            key="screen-splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="h-full w-full pointer-events-auto"
          >
            <SplashScreen onEnter={handleSplashEnter} />
          </motion.div>
        )}

        {/* 2. MAIN MENU */}
        {currentScreen === 'main_menu' && (
          <motion.div
            key="screen-main-menu"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full pointer-events-auto"
          >
            <MainMenuScreen
              onPlay={handlePlayFromMainMenu}
              onOpenLevelSelect={handleOpenLevelSelect}
              onOpenSettings={() => handleOpenSettings('main_menu')}
              onOpenSkins={handleOpenSkins}
              onOpenCredits={handleOpenCredits}
              onOpenUpdates={() => handleOpenUpdates()}
              onExit={handleExitToSplash}
            />
          </motion.div>
        )}

        {/* 3. LEVEL SELECT SCREEN */}
        {currentScreen === 'level_select' && (
          <motion.div
            key="screen-level-select"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full pointer-events-auto"
          >
            <LevelSelectScreen
              onSelectLevel={handleSelectLevel}
              onBack={handleReturnToMainMenu}
            />
          </motion.div>
        )}

        {/* 4. SKINS SCREEN */}
        {currentScreen === 'skins' && (
          <motion.div
            key="screen-skins"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full pointer-events-auto"
          >
            <SkinsScreen onBack={handleReturnToMainMenu} />
          </motion.div>
        )}

        {/* 5. SETTINGS SCREEN */}
        {currentScreen === 'settings' && (
          <motion.div
            key="screen-settings"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full pointer-events-auto"
          >
            <SettingsScreen onBack={handleCloseSettings} />
          </motion.div>
        )}

        {/* 6. CREDITS SCREEN */}
        {currentScreen === 'credits' && (
          <motion.div
            key="screen-credits"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full pointer-events-auto"
          >
            <CreditsScreen onBack={handleReturnToMainMenu} />
          </motion.div>
        )}

        {/* 6b. UPDATES & NEWS SCREEN */}
        {currentScreen === 'updates' && (
          <motion.div
            key="screen-updates"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full pointer-events-auto"
          >
            <UpdatesScreen
              initialSelectedUpdateId={selectedUpdateId}
              onBack={handleReturnToMainMenu}
            />
          </motion.div>
        )}

        {/* 7. GAMEPLAY (Pure Minimal HUD: Progress, Attempt Counter, Pause Button) */}
        {currentScreen === 'gameplay' && (
          <motion.div
            key="screen-gameplay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full w-full pointer-events-none"
          >
            <GameplayHUD
              progress={metrics.progress}
              attempt={metrics.attempts}
              onPause={handlePause}
            />
          </motion.div>
        )}

        {/* 8. PAUSE MENU (Dedicated Screen) */}
        {currentScreen === 'pause' && (
          <motion.div
            key="screen-pause"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full w-full pointer-events-auto"
          >
            <PauseMenu
              levelName={metrics.levelName}
              difficulty={metrics.difficulty}
              attempt={metrics.attempts}
              progress={metrics.progress}
              onResume={handleResume}
              onRestart={handleRestartLevel}
              onOpenSettings={() => handleOpenSettings('pause')}
              onMainMenu={handleReturnToMainMenu}
            />
          </motion.div>
        )}

        {/* 9. LEVEL COMPLETE SCREEN (Dedicated Victory Screen) */}
        {currentScreen === 'level_complete' && (
          <motion.div
            key="screen-level-complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.25 }}
            className="h-full w-full pointer-events-auto"
          >
            <LevelCompleteScreen
              levelData={activeLevelData}
              attempts={metrics.attempts}
              elapsedTime={metrics.elapsedTime}
              onNextLevel={handleNextLevel}
              onRetry={handleRestartLevel}
              onLevelSelect={handleOpenLevelSelect}
              onMainMenu={handleReturnToMainMenu}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* "What's New" Release Announcement Popup */}
      {showWhatsNew && currentScreen === 'main_menu' && (
        <WhatsNewModal
          onClose={() => setShowWhatsNew(false)}
          onViewUpdate={(updateId) => {
            setShowWhatsNew(false);
            handleOpenUpdates(updateId);
          }}
        />
      )}

      {/* Portrait Mode Landscape Enforcer Overlay (Mobile & Tablets) */}
      <RotateDeviceOverlay onOrientationChange={handleOrientationChange} />

      {/* Developer & Engine Diagnostics Overlay (F3 Toggle) */}
      {showDebugOverlay && (
        <CrossPlatformDebugOverlay
          onClose={() => {
            setShowDebugOverlay(false);
            gameState.updateSettings({ showCrossPlatformDebug: false });
          }}
        />
      )}
    </div>
  );
}
