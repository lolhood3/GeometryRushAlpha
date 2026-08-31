import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Play,
  Layers,
  Settings as SettingsIcon,
  Palette,
  Info,
  LogOut,
  Sparkles,
  Trophy,
  ChevronRight,
  ShieldAlert,
  Zap,
  Newspaper,
} from 'lucide-react';
import { GameStateManager } from '../../game/state/GameState.ts';
import { ALL_LEVELS } from '../../game/levels/LevelData.ts';
import { SoundManager } from '../../engine/audio/SoundManager.ts';
import { UpdateManager } from '../../game/updates/updateManager.ts';
import { MenuBackground } from '../components/MenuBackground.tsx';
import { MenuButton } from '../components/MenuButton.tsx';

interface MainMenuScreenProps {
  onPlay: () => void;
  onOpenLevelSelect: () => void;
  onOpenSettings: () => void;
  onOpenSkins: () => void;
  onOpenCredits: () => void;
  onOpenUpdates: () => void;
  onExit: () => void;
}

export function MainMenuScreen({
  onPlay,
  onOpenLevelSelect,
  onOpenSettings,
  onOpenSkins,
  onOpenCredits,
  onOpenUpdates,
  onExit,
}: MainMenuScreenProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const gameState = GameStateManager.getInstance();
  const updateManager = UpdateManager.getInstance();
  const highestLevel = gameState.getHighestUnlockedLevel();
  const completedCount = gameState.getCompletedLevelsCount();
  const equippedSkin = gameState.getEquippedSkin();
  const unreadCount = updateManager.getUnreadCount();

  return (
    <div
      id="main-menu-screen"
      className="relative flex h-full w-full flex-col justify-between overflow-y-auto custom-scrollbar bg-[#0A0E17] safe-p text-white select-none"
    >
      {/* Live Animated Cyber & Geometric Background */}
      <MenuBackground accentColor="#00E5FF" secondaryColor="#BF5AF2" />

      {/* Top Status Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between pb-2 shrink-0"
      >
        {/* Progress Badge */}
        <div
          id="menu-progress-badge"
          className="flex items-center gap-2 rounded-2xl border border-neutral-800/90 bg-neutral-900/80 px-3.5 py-1.5 sm:px-4 sm:py-2 shadow-lg backdrop-blur-md"
        >
          <Trophy className="h-4 w-4 text-[#00FF88]" />
          <span className="font-mono text-xs text-neutral-300">
            Progress:{' '}
            <strong className="text-white font-bold">
              {completedCount} / {ALL_LEVELS.length} Levels
            </strong>
          </span>
        </div>

        {/* Right Top Bar Actions: Updates Badge + Quick Skin Customization Chip */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Updates / News Top Quick Badge */}
          <motion.button
            id="menu-quick-updates-btn"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={() => SoundManager.getInstance().playHover()}
            onClick={() => {
              SoundManager.getInstance().playClick();
              onOpenUpdates();
            }}
            onPointerUp={(e) => {
              if (e.pointerType === 'touch') {
                SoundManager.getInstance().playClick();
                onOpenUpdates();
              }
            }}
            className="group relative flex items-center gap-2 rounded-2xl border border-neutral-800/90 bg-neutral-900/80 px-3 py-1.5 sm:px-3.5 sm:py-2 shadow-lg backdrop-blur-md transition-all hover:border-[#00E5FF]/50 hover:bg-neutral-800 hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF] cursor-pointer"
          >
            <Newspaper className="h-4 w-4 text-[#00E5FF]" />
            <span className="text-xs font-bold tracking-wide text-neutral-200 group-hover:text-white hidden xs:inline">
              News
            </span>
            {unreadCount > 0 && (
              <span className="flex items-center justify-center rounded-full bg-[#00FF88] px-1.5 py-0.2 text-[9px] font-black text-neutral-950 shadow-[0_0_8px_#00FF88]">
                NEW
              </span>
            )}
          </motion.button>

          {/* Quick Skin Customization Chip */}
          <motion.button
            id="menu-quick-skin-btn"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={() => SoundManager.getInstance().playHover()}
            onClick={() => {
              SoundManager.getInstance().playClick();
              onOpenSkins();
            }}
            onPointerUp={(e) => {
              if (e.pointerType === 'touch') {
                SoundManager.getInstance().playClick();
                onOpenSkins();
              }
            }}
            className="group flex items-center gap-2.5 rounded-2xl border border-neutral-800/90 bg-neutral-900/80 px-3.5 py-1.5 sm:px-4 sm:py-2 shadow-lg backdrop-blur-md transition-all hover:border-[#BF5AF2]/50 hover:bg-neutral-800 hover:shadow-[0_0_20px_rgba(191,90,242,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#BF5AF2] cursor-pointer"
          >
            <div
              className="h-4 w-4 rounded-md border shadow-sm transition-transform group-hover:rotate-12"
              style={{
                backgroundColor: equippedSkin.primaryColor,
                borderColor: equippedSkin.strokeColor,
                boxShadow: `0 0 10px ${equippedSkin.primaryColor}88`,
              }}
            />
            <span className="text-xs font-bold tracking-wide text-neutral-200 group-hover:text-white">
              {equippedSkin.name}
            </span>
          </motion.button>
        </div>
      </motion.div>

      {/* DESKTOP & TABLET LANDSCAPE LAYOUT (Visible when viewport height >= 521px) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="relative z-10 mx-auto my-auto desktop-launcher-view flex-col items-center text-center w-full max-w-4xl lg:max-w-5xl py-3 sm:py-6"
      >
        {/* Release Pill Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.25)] backdrop-blur-md mb-2 sm:mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Rush Engine 2D • 60Hz Deterministic</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-widest uppercase text-white drop-shadow-[0_4px_35px_rgba(0,0,0,0.9)]">
          GEOMETRY <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E5FF] to-[#00FF88]">RUSH</span>
        </h1>
        <p className="mt-2 text-xs sm:text-sm md:text-base font-mono text-neutral-300">
          Precision Rhythm Platformer • 130 BPM Synced Audio Matrix
        </p>

        {/* Action Buttons Desktop Cluster */}
        <div className="mt-6 sm:mt-8 md:mt-10 flex w-full max-w-2xl sm:max-w-3xl flex-col gap-3 sm:gap-4">
          {/* 1. Big Hero Play Button */}
          <MenuButton
            id="menu-btn-play"
            variant="primary"
            size="hero"
            soundType="confirm"
            onClick={onPlay}
            icon={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-950/20 text-neutral-950 shadow-inner">
                <Play className="h-6 w-6 fill-current ml-0.5" />
              </div>
            }
            iconRight={<ChevronRight className="h-6 w-6" />}
            subtitle={`${highestLevel.name} • ${highestLevel.difficulty}`}
            className="w-full shadow-[0_0_35px_rgba(0,229,255,0.35)] hover:shadow-[0_0_45px_rgba(0,229,255,0.55)]"
          >
            {completedCount === 0 ? 'Play Game' : 'Continue Game'}
          </MenuButton>

          {/* 2. Secondary 2x2 Grid of Menu Cards on Desktop & Tablet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
            {/* Level Select */}
            <MenuButton
              id="menu-btn-level-select"
              variant="secondary"
              size="lg"
              onClick={onOpenLevelSelect}
              icon={
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30">
                  <Layers className="h-5 w-5" />
                </div>
              }
              iconRight={<ChevronRight className="h-4 w-4 opacity-70" />}
              subtitle="5 Handcrafted Precision Gauntlets"
              className="w-full text-left"
            >
              Level Select
            </MenuButton>

            {/* Skins & Chassis */}
            <MenuButton
              id="menu-btn-skins"
              variant="secondary"
              size="lg"
              onClick={onOpenSkins}
              icon={
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#BF5AF2]/15 text-[#BF5AF2] border border-[#BF5AF2]/30">
                  <Palette className="h-5 w-5" />
                </div>
              }
              iconRight={<ChevronRight className="h-4 w-4 opacity-70" />}
              subtitle="Custom Quantum Colorways & Trails"
              className="w-full text-left"
            >
              Skins & Chassis
            </MenuButton>

            {/* Settings */}
            <MenuButton
              id="menu-btn-settings"
              variant="secondary"
              size="lg"
              onClick={onOpenSettings}
              icon={
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  <SettingsIcon className="h-5 w-5" />
                </div>
              }
              iconRight={<ChevronRight className="h-4 w-4 opacity-70" />}
              subtitle="Audio Matrix, Graphics & Keybindings"
              className="w-full text-left"
            >
              Settings
            </MenuButton>

            {/* Updates & News */}
            <MenuButton
              id="menu-btn-updates"
              variant="secondary"
              size="lg"
              onClick={onOpenUpdates}
              icon={
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Newspaper className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-[#00FF88] shadow-[0_0_8px_#00FF88]" />
                  )}
                </div>
              }
              iconRight={<ChevronRight className="h-4 w-4 opacity-70" />}
              subtitle={unreadCount > 0 ? "New Update Available (UPDATE 1.1)" : "Patch Notes & System Bulletins"}
              className="w-full text-left"
            >
              <div className="flex items-center gap-2">
                <span>Updates & News</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[#00FF88] px-1.5 py-0.2 text-[9px] font-black text-neutral-950 shadow-[0_0_8px_#00FF88]">
                    NEW
                  </span>
                )}
              </div>
            </MenuButton>

            {/* Credits */}
            <MenuButton
              id="menu-btn-credits"
              variant="secondary"
              size="lg"
              onClick={onOpenCredits}
              icon={
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Info className="h-5 w-5" />
                </div>
              }
              iconRight={<ChevronRight className="h-4 w-4 opacity-70" />}
              subtitle="Developed by Ankan Barik"
              className="w-full text-left col-span-1 sm:col-span-2"
            >
              Credits
            </MenuButton>
          </div>

          {/* 3. Exit to Splash Screen Centered Action */}
          <div className="flex justify-center w-full pt-1">
            <MenuButton
              id="menu-btn-exit"
              variant="danger"
              size="md"
              soundType="back"
              onClick={() => setShowExitConfirm(true)}
              icon={
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  <LogOut className="h-3.5 w-3.5" />
                </div>
              }
              className="w-full max-w-sm justify-center text-xs sm:text-sm font-semibold"
            >
              Exit to Splash Screen
            </MenuButton>
          </div>
        </div>
      </motion.div>

      {/* COMPACT MOBILE LANDSCAPE LAYOUT (Visible when viewport height <= 520px) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="relative z-10 mx-auto my-auto compact-landscape-view flex-row items-center justify-between gap-3 sm:gap-5 w-full max-w-4xl py-1"
      >
        {/* Left Side: Brand Identity & Big Play Button */}
        <div className="flex flex-col items-start text-left flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#00E5FF] backdrop-blur-md mb-1">
            <Sparkles className="h-3 w-3" />
            <span>Rush Engine 2D</span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-wider uppercase text-white drop-shadow-[0_4px_15px_rgba(0,0,0,0.9)] truncate w-full">
            GEOMETRY <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E5FF] to-[#00FF88]">RUSH</span>
          </h1>
          <p className="text-[10px] sm:text-[11px] font-mono text-neutral-400 truncate w-full">
            Precision Rhythm Platformer • 60Hz
          </p>

          <div className="mt-2.5 w-full max-w-xs">
            <MenuButton
              id="menu-btn-play-mobile"
              variant="primary"
              size="md"
              soundType="confirm"
              onClick={onPlay}
              icon={
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-950/20 text-neutral-950 shadow-inner">
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                </div>
              }
              iconRight={<ChevronRight className="h-4 w-4" />}
              subtitle={`${highestLevel.name} • ${highestLevel.difficulty}`}
              className="w-full py-2"
            >
              {completedCount === 0 ? 'Play Game' : 'Continue'}
            </MenuButton>
          </div>
        </div>

        {/* Right Side: 2-Column Action Navigation Grid */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full max-w-sm shrink-0">
          <MenuButton
            id="menu-btn-level-select-mobile"
            variant="secondary"
            size="sm"
            onClick={onOpenLevelSelect}
            icon={<Layers className="h-4 w-4 text-[#00E5FF]" />}
            subtitle="5 Tracks"
            className="w-full text-left py-1.5 min-h-[44px]"
          >
            Levels
          </MenuButton>

          <MenuButton
            id="menu-btn-skins-mobile"
            variant="secondary"
            size="sm"
            onClick={onOpenSkins}
            icon={<Palette className="h-4 w-4 text-[#BF5AF2]" />}
            subtitle="Chassis"
            className="w-full text-left py-1.5 min-h-[44px]"
          >
            Skins
          </MenuButton>

          <MenuButton
            id="menu-btn-settings-mobile"
            variant="secondary"
            size="sm"
            onClick={onOpenSettings}
            icon={<SettingsIcon className="h-4 w-4 text-sky-400" />}
            subtitle="Config"
            className="w-full text-left py-1.5 min-h-[44px]"
          >
            Settings
          </MenuButton>

          <MenuButton
            id="menu-btn-updates-mobile"
            variant="secondary"
            size="sm"
            onClick={onOpenUpdates}
            icon={
              <div className="relative flex items-center justify-center">
                <Newspaper className="h-4 w-4 text-[#00FF88]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-[#00FF88] shadow-[0_0_6px_#00FF88]" />
                )}
              </div>
            }
            subtitle={unreadCount > 0 ? "UPDATE 1.1" : "Logs"}
            className="w-full text-left py-1.5 min-h-[44px]"
          >
            <div className="flex items-center gap-1.5">
              <span>News</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#00FF88] px-1 py-0.2 text-[8px] font-black text-neutral-950">
                  NEW
                </span>
              )}
            </div>
          </MenuButton>

          <div className="col-span-2 grid grid-cols-2 gap-1.5">
            <MenuButton
              id="menu-btn-credits-mobile"
              variant="secondary"
              size="sm"
              onClick={onOpenCredits}
              icon={<Info className="h-3.5 w-3.5 text-amber-400" />}
              subtitle="Credits"
              className="w-full text-left py-1 min-h-[38px] text-xs"
            >
              Credits
            </MenuButton>

            <MenuButton
              id="menu-btn-exit-mobile"
              variant="danger"
              size="sm"
              soundType="back"
              onClick={() => setShowExitConfirm(true)}
              icon={<LogOut className="h-3.5 w-3.5" />}
              className="w-full justify-center text-xs py-1 min-h-[38px]"
            >
              Exit
            </MenuButton>
          </div>
        </div>
      </motion.div>

      {/* Footer Minimal Tip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        className="relative z-10 pt-1 text-center font-mono text-[11px] text-neutral-500 flex items-center justify-center gap-2 shrink-0"
      >
        <Zap className="h-3.5 w-3.5 text-[#00E5FF]" />
        <span>Tap Screen / [Space] to Jump • [R] Quick Restart • [Esc] Pause</span>
      </motion.div>

      {/* Exit Confirmation Dialog Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 safe-p backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-[#111827] p-5 sm:p-6 text-center shadow-2xl my-auto">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 mb-3 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold uppercase tracking-wider text-white">Return to Title?</h3>
            <p className="mt-1 text-xs text-neutral-400">
              You will return to the opening splash screen.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <MenuButton
                id="modal-btn-cancel-exit"
                variant="secondary"
                soundType="back"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 justify-center py-2.5 text-xs font-bold"
              >
                Cancel
              </MenuButton>
              <MenuButton
                id="modal-btn-confirm-exit"
                variant="danger"
                soundType="confirm"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExit();
                }}
                className="flex-1 justify-center py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white border-rose-500/40"
              >
                Confirm Exit
              </MenuButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
