import { Trophy, ArrowRight, RotateCcw, Layers, Home, Sparkles, Clock, Target, Check, Zap } from 'lucide-react';
import { ALL_LEVELS, type LevelData } from '../../game/levels/LevelData.ts';
import { ALL_SKINS } from '../../game/skins/SkinData.ts';
import { GameStateManager } from '../../game/state/GameState.ts';
import { SoundManager } from '../../engine/audio/SoundManager.ts';
import { MenuButton } from '../components/MenuButton.tsx';

interface LevelCompleteScreenProps {
  levelData: LevelData;
  attempts: number;
  elapsedTime: number;
  onNextLevel: (nextLevel: LevelData) => void;
  onRetry: () => void;
  onLevelSelect: () => void;
  onMainMenu: () => void;
}

export function LevelCompleteScreen({
  levelData,
  attempts,
  elapsedTime,
  onNextLevel,
  onRetry,
  onLevelSelect,
  onMainMenu,
}: LevelCompleteScreenProps) {
  const currentIdx = ALL_LEVELS.findIndex((l) => l.id === levelData.id);
  const nextLevel = currentIdx >= 0 && currentIdx < ALL_LEVELS.length - 1 ? ALL_LEVELS[currentIdx + 1] : null;

  // Check if a skin was unlocked by beating this level
  const newlyUnlockedSkin = ALL_SKINS.find((s) => s.requiredLevelId === levelData.id);
  const gameState = GameStateManager.getInstance();
  const isSkinEquipped = newlyUnlockedSkin ? gameState.getEquippedSkin().id === newlyUnlockedSkin.id : false;

  const handleEquipNewlyUnlockedSkin = () => {
    if (newlyUnlockedSkin) {
      gameState.equipSkin(newlyUnlockedSkin.id);
      SoundManager.getInstance().playEquip();
    }
  };

  return (
    <div
      id="level-complete-screen"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 safe-p backdrop-blur-md animate-in fade-in duration-300 select-none overflow-y-auto custom-scrollbar"
    >
      {/* Background celebration radial glow */}
      <div className="pointer-events-none absolute h-96 w-96 rounded-full bg-[#00FF88]/20 blur-3xl animate-pulse" />

      <div className="relative w-full max-w-md sm:max-w-lg rounded-2xl sm:rounded-3xl border border-neutral-800 bg-[#111827]/95 p-3.5 sm:p-6 text-center shadow-2xl my-auto">
        {/* Header Ribbon & Title */}
        <div className="flex items-center justify-center gap-2.5 sm:gap-3 mb-1.5 sm:mb-2">
          <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl border border-[#00FF88]/40 bg-[#00FF88]/15 text-[#00FF88] shadow-[0_0_25px_rgba(0,255,136,0.35)] shrink-0 animate-bounce">
            <Trophy className="h-4 w-4 sm:h-6 sm:w-6" />
          </div>
          <div className="text-left">
            <div className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span>Gauntlet Conquered</span>
            </div>
            <h2 className="text-base sm:text-2xl font-black uppercase tracking-wider text-white">LEVEL COMPLETE!</h2>
          </div>
        </div>
        <p className="text-[11px] sm:text-xs font-semibold text-neutral-300">{levelData.name}</p>

        {/* Stats Grid */}
        <div className="mt-2 sm:mt-3 grid grid-cols-2 gap-2 sm:gap-2.5 text-left">
          <div className="rounded-xl sm:rounded-2xl border border-neutral-800 bg-neutral-900/80 p-2.5 sm:p-3">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-neutral-400 mb-0.5">
              <Target className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#00E5FF]" />
              <span>Attempts</span>
            </div>
            <div className="font-mono text-sm sm:text-lg font-black text-white">#{attempts}</div>
          </div>

          <div className="rounded-xl sm:rounded-2xl border border-neutral-800 bg-neutral-900/80 p-2.5 sm:p-3">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-neutral-400 mb-0.5">
              <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#00FF88]" />
              <span>Clear Time</span>
            </div>
            <div className="font-mono text-sm sm:text-lg font-black text-white">{elapsedTime.toFixed(2)}s</div>
          </div>
        </div>

        {/* Newly Unlocked Skin Badge with Instant Equip */}
        {newlyUnlockedSkin && (
          <div className="mt-2 sm:mt-3 flex items-center justify-between rounded-xl sm:rounded-2xl border border-[#BF5AF2]/40 bg-[#BF5AF2]/10 p-2 sm:p-2.5 text-left">
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg border shadow-md flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: newlyUnlockedSkin.primaryColor,
                  borderColor: newlyUnlockedSkin.strokeColor,
                }}
              >
                <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-neutral-950 fill-current" />
              </div>
              <div>
                <div className="text-[9px] sm:text-[10px] font-bold uppercase text-[#BF5AF2]">Skin Unlocked!</div>
                <div className="text-xs font-black text-white">{newlyUnlockedSkin.name}</div>
              </div>
            </div>

            <button
              id="btn-equip-new-skin"
              onClick={handleEquipNewlyUnlockedSkin}
              className={`rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer min-h-[36px] ${
                isSkinEquipped
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-[#BF5AF2] text-neutral-950 hover:bg-[#d07aff] shadow-[0_0_15px_rgba(191,90,242,0.4)]'
              }`}
            >
              {isSkinEquipped ? 'Equipped' : 'Equip'}
            </button>
          </div>
        )}

        {/* Navigation Action Buttons Grid */}
        <div className="mt-2.5 sm:mt-4 grid grid-cols-2 gap-1.5 sm:gap-2">
          {/* 1. Next Level (if available) */}
          {nextLevel ? (
            <div className="col-span-2">
              <MenuButton
                id="complete-btn-next-level"
                variant="primary"
                size="md"
                soundType="confirm"
                onClick={() => onNextLevel(nextLevel)}
                iconRight={<ArrowRight className="h-4 w-4" />}
                className="w-full justify-center text-xs font-black min-h-[44px]"
              >
                Next: {nextLevel.name}
              </MenuButton>
            </div>
          ) : (
            <div className="col-span-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2 text-xs font-bold text-amber-300 shadow-md">
              🏆 All 5 Gauntlets Mastered!
            </div>
          )}

          {/* 2. Retry */}
          <MenuButton
            id="complete-btn-retry"
            variant="secondary"
            size="sm"
            soundType="click"
            onClick={onRetry}
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            className="w-full justify-center text-xs font-bold min-h-[40px]"
          >
            Retry
          </MenuButton>

          {/* 3. Level Select */}
          <MenuButton
            id="complete-btn-level-select"
            variant="secondary"
            size="sm"
            soundType="click"
            onClick={onLevelSelect}
            icon={<Layers className="h-3.5 w-3.5" />}
            className="w-full justify-center text-xs font-bold min-h-[40px]"
          >
            Tracks
          </MenuButton>

          {/* 4. Main Menu */}
          <div className="col-span-2">
            <MenuButton
              id="complete-btn-main-menu"
              variant="danger"
              size="sm"
              soundType="back"
              onClick={onMainMenu}
              icon={<Home className="h-3.5 w-3.5" />}
              className="w-full justify-center text-xs font-bold min-h-[40px]"
            >
              Main Menu
            </MenuButton>
          </div>
        </div>
      </div>
    </div>
  );
}
