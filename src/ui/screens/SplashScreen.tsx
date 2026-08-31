import { useEffect, useRef, useCallback, type SyntheticEvent } from 'react';
import { motion } from 'motion/react';
import { Play, Sparkles, Zap, Shield } from 'lucide-react';
import { SoundManager } from '../../engine/audio/SoundManager.ts';
import { MenuBackground } from '../components/MenuBackground.tsx';
import { MenuButton } from '../components/MenuButton.tsx';

interface SplashScreenProps {
  onEnter: () => void;
}

export function SplashScreen({ onEnter }: SplashScreenProps) {
  const lastEnterTimestampRef = useRef<number>(0);

  const handleEnter = useCallback(
    (e?: SyntheticEvent | Event) => {
      if (e && e.stopPropagation) {
        e.stopPropagation();
      }

      const now = performance.now();
      if (now - lastEnterTimestampRef.current < 300) {
        return;
      }
      lastEnterTimestampRef.current = now;

      SoundManager.getInstance().playConfirm();
      onEnter();
    },
    [onEnter]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter') {
        handleEnter(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleEnter]);

  return (
    <div
      id="splash-screen"
      onClick={handleEnter}
      onPointerUp={(e) => {
        if (e.pointerType === 'touch') {
          handleEnter(e);
        }
      }}
      className="relative flex h-full w-full cursor-pointer flex-col items-center justify-between overflow-hidden bg-[#0A0E17] safe-p text-white select-none touch-manipulation"
    >
      {/* Live Ambient Background */}
      <MenuBackground accentColor="#00E5FF" secondaryColor="#BF5AF2" />

      {/* Top Release Tag */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 inline-flex items-center gap-2 rounded-full border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.2)] backdrop-blur-md"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>Precision 2D Rhythm Action</span>
      </motion.div>

      {/* Center Hero Identity */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="relative z-10 flex flex-col items-center text-center my-auto"
      >
        {/* Animated Kinetic Glowing Cube Emblem */}
        <div className="relative mb-6 flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-3xl border-2 border-white bg-gradient-to-tr from-[#00E5FF] to-[#00FF88] shadow-[0_0_50px_rgba(0,229,255,0.6)] animate-pulse">
          {/* Inner Quantum Core */}
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl border border-white/60 bg-white/20 shadow-inner flex items-center justify-center">
            <Zap className="h-6 w-6 text-neutral-950 fill-current" />
          </div>

          {/* Orbiting ring glow */}
          <div className="pointer-events-none absolute -inset-3 rounded-full border border-[#00E5FF]/30 blur-xs animate-spin" />
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl font-black tracking-widest uppercase text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.9)]">
          GEOMETRY <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E5FF] to-[#00FF88]">RUSH</span>
        </h1>
        <p className="mt-2 text-sm sm:text-base font-mono tracking-wider text-neutral-400">
          Deterministic 60Hz Physics • 130 BPM Dynamic Synth Engine
        </p>

        {/* Enter Game CTA Button */}
        <div className="mt-8">
          <MenuButton
            id="splash-btn-enter"
            variant="primary"
            size="hero"
            soundType="confirm"
            onClick={(e) => {
              handleEnter(e);
            }}
            icon={<Play className="h-5 w-5 fill-current ml-0.5" />}
            className="px-8 py-4 text-sm sm:text-base font-black shadow-[0_0_35px_rgba(0,229,255,0.4)]"
          >
            Press [SPACE] / Tap to Enter
          </MenuButton>
        </div>
      </motion.div>

      {/* Footer System Specs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="relative z-10 flex flex-wrap items-center justify-center gap-4 text-center font-mono text-[11px] text-neutral-500"
      >
        <span className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-[#00E5FF]" /> Sub-0.5s Fast Respawn
        </span>
        <span>•</span>
        <span>5 Gauntlets</span>
        <span>•</span>
        <span>Custom Particle Trails</span>
      </motion.div>
    </div>
  );
}
