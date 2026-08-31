import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Lock,
  Palette,
  Sparkles,
  Shield,
  Zap,
  RotateCw,
} from 'lucide-react';
import { ALL_SKINS, type SkinData } from '../../game/skins/SkinData.ts';
import { GameStateManager } from '../../game/state/GameState.ts';
import { SoundManager } from '../../engine/audio/SoundManager.ts';
import { MenuBackground } from '../components/MenuBackground.tsx';
import { MenuButton } from '../components/MenuButton.tsx';

interface SkinsScreenProps {
  onBack: () => void;
}

export function SkinsScreen({ onBack }: SkinsScreenProps) {
  const gameState = GameStateManager.getInstance();
  const [equippedSkinId, setEquippedSkinId] = useState<string>(
    gameState.getEquippedSkin().id
  );
  const [selectedSkinId, setSelectedSkinId] = useState<string>(
    gameState.getEquippedSkin().id
  );
  const [isRotating, setIsRotating] = useState(true);

  const selectedSkin = ALL_SKINS.find((s) => s.id === selectedSkinId) || ALL_SKINS[0];
  const isSelectedUnlocked = gameState.isSkinUnlocked(selectedSkin.id);
  const isSelectedEquipped = equippedSkinId === selectedSkin.id;

  const handleSelectSkin = (skin: SkinData) => {
    const isUnlocked = gameState.isSkinUnlocked(skin.id);
    if (!isUnlocked) {
      SoundManager.getInstance().playError();
    } else {
      SoundManager.getInstance().playHover();
    }
    setSelectedSkinId(skin.id);
  };

  const handleEquip = () => {
    if (!isSelectedUnlocked) {
      SoundManager.getInstance().playError();
      return;
    }
    const success = gameState.equipSkin(selectedSkin.id);
    if (success) {
      setEquippedSkinId(selectedSkin.id);
      SoundManager.getInstance().playEquip();
    }
  };

  return (
    <div
      id="skins-screen"
      className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0E17] safe-p text-white select-none"
    >
      {/* Live Background matching selected skin accent */}
      <MenuBackground
        accentColor={selectedSkin.primaryColor}
        secondaryColor={selectedSkin.trailGlow}
      />

      {/* Top Header Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 mx-auto flex w-full max-w-5xl lg:max-w-6xl items-center justify-between border-b border-neutral-800/80 pb-2 sm:pb-3 shrink-0"
      >
        <MenuButton
          id="skins-back-btn"
          variant="secondary"
          size="sm"
          soundType="back"
          onClick={onBack}
          icon={<ArrowLeft className="h-4 w-4" />}
          className="min-h-[40px] px-3 py-1.5"
        >
          Main Menu
        </MenuButton>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl sm:rounded-2xl border shadow-lg transition-colors"
            style={{
              backgroundColor: `${selectedSkin.primaryColor}22`,
              borderColor: `${selectedSkin.primaryColor}55`,
              color: selectedSkin.primaryColor,
              boxShadow: `0 0 15px ${selectedSkin.primaryColor}33`,
            }}
          >
            <Palette className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-lg font-black tracking-wider uppercase text-white leading-tight">
              Skins & Chassis
            </h1>
            <p className="text-[10px] sm:text-[11px] font-mono text-neutral-400 hidden xs:block">
              Quantum Colorways & Dynamic Trails
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-neutral-800 bg-neutral-900/80 px-2.5 py-1 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-mono text-neutral-300 shadow-md">
          <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#00FF88]" />
          <span>
            <strong>{ALL_SKINS.filter((s) => gameState.isSkinUnlocked(s.id)).length}</strong>/{ALL_SKINS.length}
          </span>
        </div>
      </motion.div>

      {/* Main Responsive Two-Column Layout (Side-by-side on Landscape & Desktop) */}
      <div className="relative z-10 mx-auto mt-1.5 sm:mt-3 flex w-full max-w-5xl lg:max-w-6xl flex-1 min-h-0 flex-row gap-2 sm:gap-4 overflow-hidden pb-1 sm:pb-2">
        {/* Left Column: Live Kinetic Player Preview & Equip Console */}
        <div className="flex flex-col w-[220px] xs:w-[240px] sm:w-[280px] md:w-[320px] lg:w-[360px] shrink-0 rounded-2xl sm:rounded-3xl border border-neutral-800/90 bg-neutral-900/85 p-2.5 sm:p-4 backdrop-blur-md shadow-2xl justify-between overflow-y-auto custom-scrollbar min-h-0">
          <div className="flex flex-col gap-1.5 sm:gap-2.5">
            {/* Preview Box Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-[#00E5FF]" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Hologram
                </span>
              </div>
              <button
                id="btn-toggle-rotation"
                onClick={() => setIsRotating(!isRotating)}
                className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-mono transition-colors cursor-pointer ${
                  isRotating
                    ? 'bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30'
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                }`}
              >
                <RotateCw className={`h-2.5 w-2.5 ${isRotating ? 'animate-spin' : ''}`} />
                <span>{isRotating ? 'Spin' : 'Static'}</span>
              </button>
            </div>

            {/* Live Interactive Hologram Stage (GPU-accelerated CSS/Motion rotation) */}
            <div className="relative flex h-20 xs:h-24 sm:h-32 md:h-40 w-full items-center justify-center rounded-xl sm:rounded-2xl border border-neutral-800 bg-[#070A10] overflow-hidden shadow-inner shrink-0">
              {/* Perspective grid floor */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:12px_12px]" />

              {/* Ambient Glow Aura */}
              <div
                className="pointer-events-none absolute h-16 w-16 sm:h-24 sm:w-24 rounded-full blur-2xl transition-all duration-300"
                style={{
                  backgroundColor: selectedSkin.primaryColor,
                  opacity: isSelectedUnlocked ? 0.35 : 0.1,
                }}
              />

              {/* Simulated Quantum Trail Particles behind the cube */}
              <div className="pointer-events-none absolute flex items-center justify-center">
                {[-14, -8, -4].map((offset, i) => (
                  <div
                    key={i}
                    className="absolute h-5 w-5 sm:h-7 sm:w-7 rounded-md border opacity-20 blur-xs transition-all"
                    style={{
                      transform: `translateX(${offset * 2}px) scale(${0.7 + i * 0.1})`,
                      backgroundColor: selectedSkin.trailColor,
                      borderColor: selectedSkin.trailGlow,
                    }}
                  />
                ))}
              </div>

              {/* Central Kinetic Rotating Cube (Hardware Accelerated Framer Motion) */}
              <motion.div
                className="relative flex h-10 w-10 xs:h-12 xs:w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 items-center justify-center rounded-lg sm:rounded-xl border-2 shadow-2xl"
                animate={isRotating ? { rotate: 360 } : { rotate: 0 }}
                transition={
                  isRotating
                    ? { repeat: Infinity, duration: 6, ease: 'linear' }
                    : { duration: 0.3 }
                }
                style={{
                  backgroundColor: selectedSkin.primaryColor,
                  borderColor: selectedSkin.strokeColor,
                  boxShadow: `0 0 25px ${selectedSkin.primaryColor}88`,
                }}
              >
                {/* Internal Core Reactor */}
                <div
                  className="h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 rounded-sm sm:rounded-md border-2 shadow-inner transition-colors"
                  style={{
                    backgroundColor: selectedSkin.coreColor,
                    borderColor: selectedSkin.coreStrokeColor,
                    boxShadow: `0 0 10px ${selectedSkin.coreColor}`,
                  }}
                />
              </motion.div>

              {/* Ground Reflection Line */}
              <div
                className="absolute bottom-2 sm:bottom-3 h-0.5 w-16 sm:w-24 rounded-full blur-xs opacity-60"
                style={{ backgroundColor: selectedSkin.primaryColor }}
              />
            </div>

            {/* Skin Identity & Info */}
            <div>
              <div className="flex items-center justify-between gap-1">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white truncate">
                  {selectedSkin.name}
                </h2>
                {isSelectedEquipped ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-400 shrink-0">
                    <Check className="h-2.5 w-2.5" />
                    <span>Equipped</span>
                  </span>
                ) : isSelectedUnlocked ? (
                  <span className="rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-sky-400 shrink-0">
                    Unlocked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-rose-400 shrink-0">
                    <Lock className="h-2.5 w-2.5" />
                    <span>Locked</span>
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] sm:text-xs text-neutral-300 line-clamp-1">
                {selectedSkin.description}
              </p>
              <div className="mt-0.5 flex items-center gap-1 font-mono text-[9px] sm:text-[10px] text-neutral-400">
                <Sparkles className="h-2.5 w-2.5 text-[#00E5FF] shrink-0" />
                <span className="truncate">{selectedSkin.unlockCondition}</span>
              </div>
            </div>

            {/* Color Matrix Breakdown Chips */}
            <div className="grid grid-cols-4 gap-1 text-center text-[8px] sm:text-[9px] font-mono uppercase">
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-0.5 sm:p-1">
                <div
                  className="mx-auto mb-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border"
                  style={{ backgroundColor: selectedSkin.primaryColor }}
                />
                <span className="text-neutral-400 text-[8px]">Body</span>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-0.5 sm:p-1">
                <div
                  className="mx-auto mb-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border"
                  style={{ backgroundColor: selectedSkin.coreColor }}
                />
                <span className="text-neutral-400 text-[8px]">Core</span>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-0.5 sm:p-1">
                <div
                  className="mx-auto mb-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border"
                  style={{ backgroundColor: selectedSkin.trailGlow }}
                />
                <span className="text-neutral-400 text-[8px]">Trail</span>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-0.5 sm:p-1">
                <div
                  className="mx-auto mb-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full border"
                  style={{ backgroundColor: selectedSkin.strokeColor }}
                />
                <span className="text-neutral-400 text-[8px]">Edge</span>
              </div>
            </div>
          </div>

          {/* Primary Equip CTA Action */}
          <div className="mt-1.5 pt-1.5 border-t border-neutral-800 shrink-0">
            <MenuButton
              id="btn-equip-skin"
              variant={isSelectedEquipped ? 'secondary' : isSelectedUnlocked ? 'primary' : 'secondary'}
              size="sm"
              soundType={isSelectedUnlocked ? 'confirm' : 'error'}
              disabled={!isSelectedUnlocked || isSelectedEquipped}
              onClick={handleEquip}
              icon={
                isSelectedEquipped ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : isSelectedUnlocked ? (
                  <Zap className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )
              }
              className="w-full justify-center text-xs py-2 min-h-[44px]"
            >
              {isSelectedEquipped
                ? 'Equipped'
                : isSelectedUnlocked
                ? 'Equip Chassis'
                : 'Chassis Locked'}
            </MenuButton>
          </div>
        </div>

        {/* Right Column: Roster of All Skins Grid */}
        <div className="flex-1 min-w-0 min-h-0 rounded-2xl sm:rounded-3xl border border-neutral-800/90 bg-neutral-900/85 p-2.5 sm:p-4 backdrop-blur-md shadow-2xl overflow-y-auto custom-scrollbar flex flex-col">
          <div className="border-b border-neutral-800 pb-1.5 sm:pb-2 mb-2 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">Chassis Armory</h2>
              <p className="text-[10px] font-mono text-neutral-400">Tap model to inspect or equip</p>
            </div>
            <span className="text-[10px] sm:text-xs font-mono text-neutral-400">
              {ALL_SKINS.length} Models
            </span>
          </div>

          {/* Grid of Skins */}
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 p-0.5">
            {ALL_SKINS.map((skin) => {
              const isUnlocked = gameState.isSkinUnlocked(skin.id);
              const isEquipped = equippedSkinId === skin.id;
              const isSelected = selectedSkinId === skin.id;

              return (
                <div
                  key={skin.id}
                  id={`skin-card-${skin.id}`}
                  onClick={() => handleSelectSkin(skin)}
                  className={`group relative flex flex-col justify-between rounded-xl sm:rounded-2xl border p-2.5 sm:p-3 transition-all cursor-pointer select-none min-h-[56px] ${
                    isSelected
                      ? 'border-[#00E5FF] bg-neutral-800/90 shadow-[0_0_15px_rgba(0,229,255,0.25)]'
                      : isUnlocked
                      ? 'border-neutral-800 bg-neutral-950/70 hover:border-neutral-700 hover:bg-neutral-800/60'
                      : 'border-neutral-900 bg-neutral-950/40 opacity-60 hover:opacity-80'
                  }`}
                >
                  {/* Top Row: Mini Preview Swatch & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      {/* Mini Skin Icon Box */}
                      <div
                        className="relative flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-transform group-hover:scale-105"
                        style={{
                          backgroundColor: skin.primaryColor,
                          borderColor: skin.strokeColor,
                          boxShadow: `0 0 8px ${skin.primaryColor}44`,
                        }}
                      >
                        <div
                          className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-sm border"
                          style={{
                            backgroundColor: skin.coreColor,
                            borderColor: skin.coreStrokeColor,
                          }}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-white group-hover:text-[#00E5FF] transition-colors truncate">
                          {skin.name}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-neutral-400 font-mono truncate">
                          {skin.requiredLevelId ? 'Special Edition' : 'Standard Edition'}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {isEquipped ? (
                      <span className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm">
                        <Check className="h-3 w-3" />
                      </span>
                    ) : !isUnlocked ? (
                      <span className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-neutral-500 border border-neutral-700">
                        <Lock className="h-3 w-3" />
                      </span>
                    ) : null}
                  </div>

                  {/* Unlock Condition / Tag */}
                  <div className="mt-1.5 flex items-center justify-between border-t border-neutral-800/80 pt-1 text-[9px] sm:text-[10px] font-mono text-neutral-400">
                    <span className="truncate max-w-[120px] sm:max-w-[150px]">{skin.unlockCondition}</span>
                    {isSelected && (
                      <span className="text-[#00E5FF] font-bold uppercase text-[9px] shrink-0">Selected</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
