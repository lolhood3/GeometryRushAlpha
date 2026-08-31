import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  Play,
  Trophy,
  Zap,
  Clock,
  Target,
  Sparkles,
  Flame,
  Layers,
} from 'lucide-react';
import { ALL_LEVELS, type LevelData } from '../../game/levels/LevelData.ts';
import { GameStateManager } from '../../game/state/GameState.ts';
import { SoundManager } from '../../engine/audio/SoundManager.ts';
import { MenuBackground } from '../components/MenuBackground.tsx';
import { MenuButton } from '../components/MenuButton.tsx';

interface LevelSelectScreenProps {
  onSelectLevel: (level: LevelData) => void;
  onBack: () => void;
}

type LevelFilter = 'all' | 'unlocked' | 'completed';

export function LevelSelectScreen({ onSelectLevel, onBack }: LevelSelectScreenProps) {
  const gameState = GameStateManager.getInstance();
  const [filter, setFilter] = useState<LevelFilter>('all');
  const [hoveredLevelId, setHoveredLevelId] = useState<string | null>(null);

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return {
          color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
          barColor: 'bg-emerald-400',
          accent: '#00FF88',
        };
      case 'Medium':
        return {
          color: 'text-sky-400 border-sky-500/40 bg-sky-500/10 shadow-[0_0_15px_rgba(56,189,248,0.2)]',
          barColor: 'bg-sky-400',
          accent: '#00E5FF',
        };
      case 'Hard':
        return {
          color: 'text-purple-400 border-purple-500/40 bg-purple-500/10 shadow-[0_0_15px_rgba(191,90,242,0.2)]',
          barColor: 'bg-purple-400',
          accent: '#BF5AF2',
        };
      case 'Expert':
        return {
          color: 'text-amber-400 border-amber-500/40 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)]',
          barColor: 'bg-amber-400',
          accent: '#FFD60A',
        };
      case 'Master':
        return {
          color: 'text-rose-400 border-rose-500/40 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.2)]',
          barColor: 'bg-rose-400',
          accent: '#FF2D55',
        };
      default:
        return {
          color: 'text-neutral-400 border-neutral-700 bg-neutral-800',
          barColor: 'bg-neutral-400',
          accent: '#9CA3AF',
        };
    }
  };

  const handleLaunch = (level: LevelData, isUnlocked: boolean) => {
    if (!isUnlocked) {
      SoundManager.getInstance().playError();
      return;
    }
    SoundManager.getInstance().playConfirm();
    onSelectLevel(level);
  };

  const filteredLevels = ALL_LEVELS.filter((lvl) => {
    const isUnlocked = gameState.isLevelUnlocked(lvl.id);
    const isCompleted = gameState.getLevelProgress(lvl.id).completed;
    if (filter === 'unlocked') return isUnlocked && !isCompleted;
    if (filter === 'completed') return isCompleted;
    return true;
  });

  const totalCompleted = gameState.getCompletedLevelsCount();
  const activeAccent = hoveredLevelId
    ? ALL_LEVELS.find((l) => l.id === hoveredLevelId)?.accentColor || '#00E5FF'
    : '#00E5FF';

  return (
    <div
      id="level-select-screen"
      className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0E17] safe-p text-white select-none"
    >
      {/* Live Animated Background tuned to active level accent */}
      <MenuBackground accentColor={activeAccent} secondaryColor="#BF5AF2" />

      {/* Top Header & Navigation Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 mx-auto flex w-full max-w-5xl lg:max-w-6xl items-center justify-between border-b border-neutral-800/80 pb-2 sm:pb-3 shrink-0"
      >
        <MenuButton
          id="level-select-back-btn"
          variant="secondary"
          size="sm"
          soundType="back"
          onClick={onBack}
          icon={<ArrowLeft className="h-4 w-4" />}
          className="min-h-[38px] px-3 py-1.5"
        >
          Menu
        </MenuButton>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl sm:rounded-2xl bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 shadow-[0_0_20px_rgba(0,229,255,0.2)]">
            <Zap className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-lg font-black tracking-wider uppercase text-white leading-tight">
              Level Select
            </h1>
            <p className="text-[10px] sm:text-[11px] font-mono text-neutral-400 hidden xs:block">5 Precision Gauntlets</p>
          </div>
        </div>

        {/* Cleared Stats Badge */}
        <div
          id="level-select-cleared-badge"
          className="flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-neutral-800/90 bg-neutral-900/80 px-2.5 sm:px-4 py-1.5 sm:py-2 font-mono text-[11px] sm:text-xs text-neutral-300 backdrop-blur-md shadow-lg"
        >
          <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#00FF88]" />
          <span>
            Cleared: <strong className="text-white font-bold">{totalCompleted}</strong>/{ALL_LEVELS.length}
          </span>
        </div>
      </motion.div>

      {/* Filter Tabs Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="relative z-10 mx-auto mt-2 sm:mt-3 flex w-full max-w-5xl lg:max-w-6xl items-center justify-between gap-2 shrink-0"
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          {(
            [
              { key: 'all', label: 'All', icon: Layers },
              { key: 'unlocked', label: 'In Progress', icon: Flame },
              { key: 'completed', label: 'Conquered', icon: CheckCircle2 },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isSelected = filter === tab.key;
            return (
              <button
                key={tab.key}
                id={`filter-tab-${tab.key}`}
                onClick={() => {
                  SoundManager.getInstance().playClick();
                  setFilter(tab.key);
                }}
                onMouseEnter={() => SoundManager.getInstance().playHover()}
                className={`flex items-center gap-1 sm:gap-1.5 rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer min-h-[36px] ${
                  isSelected
                    ? 'bg-[#00E5FF]/20 border border-[#00E5FF] text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.25)]'
                    : 'bg-neutral-900/70 border border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-[10px] sm:text-[11px] font-mono text-neutral-400 hidden sm:block">
          Select card to launch track
        </div>
      </motion.div>

      {/* Interactive Level Cards Scrollable View */}
      <div className="relative z-10 mx-auto mt-2 sm:mt-3 flex w-full max-w-5xl lg:max-w-6xl flex-1 min-h-0 flex-col overflow-y-auto custom-scrollbar p-0.5 sm:p-2 pb-8 sm:pb-12 space-y-2 sm:space-y-3">
        {filteredLevels.map((level, idx) => {
          const isUnlocked = gameState.isLevelUnlocked(level.id);
          const progress = gameState.getLevelProgress(level.id);
          const diffBadge = getDifficultyBadge(level.difficulty);
          const completionPercentage = progress.completed ? 100 : isUnlocked ? 0 : 0;

          return (
            <motion.div
              key={level.id}
              id={`level-card-${level.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
              whileHover={isUnlocked ? { y: -2 } : undefined}
              onMouseEnter={() => {
                setHoveredLevelId(level.id);
                if (isUnlocked) SoundManager.getInstance().playHover();
              }}
              onMouseLeave={() => setHoveredLevelId(null)}
              onClick={() => handleLaunch(level, isUnlocked)}
              className={`group relative flex flex-row items-center justify-between rounded-xl sm:rounded-3xl border p-2.5 sm:p-4 md:p-5 backdrop-blur-md transition-all select-none gap-2 sm:gap-4 ${
                isUnlocked
                  ? 'cursor-pointer border-neutral-800 bg-neutral-900/75 hover:border-[#00E5FF]/70 hover:bg-neutral-800/85 hover:shadow-[0_0_25px_rgba(0,229,255,0.18)]'
                  : 'cursor-not-allowed border-neutral-900/90 bg-neutral-950/70 opacity-60'
              }`}
            >
              {/* Card Left Glowing Accent Stripe for Unlocked Cards */}
              {isUnlocked && (
                <div
                  className="absolute left-0 top-2.5 bottom-2.5 w-1 sm:w-1.5 rounded-r-full shadow-sm"
                  style={{
                    backgroundColor: diffBadge.accent,
                    boxShadow: `0 0 10px ${diffBadge.accent}`,
                  }}
                />
              )}

              {/* Left Main Information & Badges */}
              <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
                {/* Level Holographic Number Badge */}
                <div
                  className={`flex h-9 w-9 sm:h-12 sm:w-12 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-lg sm:rounded-2xl font-mono text-xs sm:text-base font-black transition-transform group-hover:scale-105 border ${
                    !isUnlocked
                      ? 'bg-neutral-950 text-neutral-600 border-neutral-800/80 shadow-inner'
                      : progress.completed
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                      : 'bg-[#00E5FF]/15 text-[#00E5FF] border-[#00E5FF]/40 shadow-[0_0_15px_rgba(0,229,255,0.25)]'
                  }`}
                >
                  {!isUnlocked ? (
                    <Lock className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-neutral-500" />
                  ) : (
                    <span>0{idx + 1}</span>
                  )}
                </div>

                {/* Level Title, Subtitle, & Difficulty */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <h2
                      className={`text-xs sm:text-base md:text-lg font-black tracking-wide uppercase transition-colors truncate ${
                        isUnlocked ? 'text-white group-hover:text-[#00E5FF]' : 'text-neutral-500'
                      }`}
                    >
                      {level.name}
                    </h2>
                    <span
                      className={`rounded-md sm:rounded-lg border px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider ${diffBadge.color}`}
                    >
                      {level.difficulty}
                    </span>
                    {progress.completed && (
                      <span className="inline-flex items-center gap-1 rounded-md sm:rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[10px] font-bold uppercase text-emerald-400">
                        <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span>Cleared</span>
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 text-[10px] sm:text-xs text-neutral-400 truncate hidden sm:block">{level.subtitle}</p>

                  {/* Completion Status & Lock Hint */}
                  {!isUnlocked ? (
                    <div className="mt-0.5 sm:mt-1 flex items-center gap-1 font-mono text-[10px] sm:text-[11px] text-rose-400/90">
                      <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                      <span className="truncate">Beat previous track</span>
                    </div>
                  ) : (
                    <div className="mt-0.5 sm:mt-1 flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono text-neutral-400">
                      <div className="flex items-center gap-1">
                        <Target className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-[#00E5FF]" />
                        <span>Best: {progress.bestAttempts ? `#${progress.bestAttempts}` : 'None'}</span>
                      </div>
                      {progress.bestTime && (
                        <div className="flex items-center gap-1 text-emerald-400 font-semibold hidden sm:flex">
                          <Clock className="h-3 w-3" />
                          <span>Record: {progress.bestTime.toFixed(2)}s</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Action & Progress Bar */}
              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                {/* Visual Completion Gauge */}
                <div className="hidden md:flex flex-col items-end gap-1 font-mono text-xs min-w-[100px]">
                  <div className="flex items-center justify-between w-full text-neutral-400 text-[10px]">
                    <span>Progress</span>
                    <strong className={progress.completed ? 'text-emerald-400 font-bold' : 'text-neutral-400'}>
                      {completionPercentage}%
                    </strong>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-950 border border-neutral-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        progress.completed
                          ? 'bg-gradient-to-r from-emerald-400 to-[#00FF88] shadow-[0_0_8px_#00FF88]'
                          : 'bg-neutral-800'
                      }`}
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Launch / Locked CTA Button */}
                <MenuButton
                  id={`btn-launch-level-${level.id}`}
                  variant={isUnlocked ? 'primary' : 'secondary'}
                  size="sm"
                  soundType={isUnlocked ? 'confirm' : 'error'}
                  disabled={!isUnlocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLaunch(level, isUnlocked);
                  }}
                  icon={
                    isUnlocked ? (
                      <Play className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current ml-0.5" />
                    ) : (
                      <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    )
                  }
                  className="min-w-[78px] xs:min-w-[90px] sm:min-w-[110px] justify-center text-xs py-1.5 sm:py-2.5 min-h-[44px]"
                >
                  {isUnlocked ? 'Launch' : 'Locked'}
                </MenuButton>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
