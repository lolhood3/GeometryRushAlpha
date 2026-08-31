import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Sliders,
  Monitor,
  Gamepad,
  Eye,
  RotateCcw,
  Sparkles,
  Zap,
  Check,
  Keyboard,
  MousePointer,
  HelpCircle,
  AlertTriangle,
  Play,
  Smartphone,
  Touchpad,
  Activity,
  Cpu,
} from 'lucide-react';
import {
  GameStateManager,
  type GameSettings,
  type GraphicsQuality,
} from '../../game/state/GameState.ts';
import { Haptics, type HapticIntensity } from '../../engine/haptics/HapticsManager.ts';
import { SoundManager } from '../../engine/audio/SoundManager.ts';
import { SoundUtility } from '../../engine/audio/SoundUtility.ts';
import { MenuBackground } from '../components/MenuBackground.tsx';
import { MenuButton } from '../components/MenuButton.tsx';

interface SettingsScreenProps {
  onBack: () => void;
}

type SettingsTab = 'audio' | 'graphics' | 'gameplay' | 'accessibility' | 'controls';

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const gameState = GameStateManager.getInstance();
  const soundManager = SoundManager.getInstance();

  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');
  const [settings, setSettings] = useState<GameSettings>(() => gameState.getSettings());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    gameState.updateSettings({ [key]: value });

    // Live acoustic sync
    if (key === 'masterVolume') soundManager.setMasterVolume(value as number);
    if (key === 'musicVolume') soundManager.setMusicVolume(value as number);
    if (key === 'sfxVolume') soundManager.setSfxVolume(value as number);
    if (key === 'isMuted') soundManager.setMuted(value as boolean);
  };

  const handleToggle = (key: keyof GameSettings) => {
    const nextVal = !settings[key];
    SoundUtility.toggle(nextVal);
    updateSetting(key, nextVal as any);
  };

  const handleSliderChange = (
    key: 'masterVolume' | 'musicVolume' | 'sfxVolume',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = parseFloat(e.target.value);
    updateSetting(key, val);
    SoundUtility.tick(val);
  };

  const handleSliderRelease = () => {
    SoundUtility.click();
  };

  const handleResetProgress = () => {
    gameState.resetAllProgress();
    SoundUtility.confirm();
    setShowResetConfirm(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3000);
  };

  const tabs: { key: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'audio', label: 'Audio', icon: Volume2 },
    { key: 'graphics', label: 'Graphics', icon: Monitor },
    { key: 'gameplay', label: 'Gameplay', icon: Gamepad },
    { key: 'accessibility', label: 'Accessibility', icon: Eye },
    { key: 'controls', label: 'Controls', icon: Keyboard },
  ];

  return (
    <div
      id="settings-screen"
      className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0E17] safe-p text-white select-none"
    >
      {/* Live Animated Background */}
      <MenuBackground accentColor="#38BDF8" secondaryColor="#BF5AF2" />

      {/* Top Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 mx-auto flex w-full max-w-5xl lg:max-w-6xl items-center justify-between border-b border-neutral-800/80 pb-2 sm:pb-3 shrink-0"
      >
        <MenuButton
          id="settings-back-btn"
          variant="secondary"
          size="sm"
          soundType="back"
          onClick={onBack}
          icon={<ArrowLeft className="h-4 w-4" />}
          className="min-h-[38px] px-3 py-1.5"
        >
          Return
        </MenuButton>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl sm:rounded-2xl bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
            <Sliders className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-lg font-black tracking-wider uppercase text-white leading-tight">Settings</h1>
            <p className="text-[10px] sm:text-[11px] font-mono text-neutral-400 hidden xs:block">System Preferences & Bindings</p>
          </div>
        </div>

        {/* Reset Data Button (Visible in Header on Mobile, or in Sidebar on Desktop) */}
        <div className="flex items-center">
          <button
            id="settings-header-reset-btn"
            onClick={() => setShowResetConfirm(true)}
            className="md:hidden flex items-center gap-1.5 rounded-xl border border-rose-900/60 bg-rose-950/40 px-2.5 py-1.5 text-[11px] font-bold text-rose-300 hover:border-rose-600 hover:text-rose-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <div className="w-16 hidden md:block" />
        </div>
      </motion.div>

      {/* Main Settings Container */}
      <div className="relative z-10 mx-auto mt-2 sm:mt-4 flex w-full max-w-5xl lg:max-w-6xl flex-1 min-h-0 flex-col md:flex-row gap-2.5 sm:gap-5 overflow-hidden pb-1 sm:pb-3">
        {/* Navigation Category Tabs */}
        {/* 1. Mobile & Phone Landscape 5-Column Grid Tabs (Hidden on md+) */}
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5 md:hidden shrink-0 w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                id={`settings-tab-mobile-${tab.key}`}
                onClick={() => {
                  soundManager.playClick();
                  setActiveTab(tab.key);
                }}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-xl py-1.5 sm:py-2 px-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all cursor-pointer min-h-[40px] select-none ${
                  isSelected
                    ? 'bg-gradient-to-r from-sky-500/25 to-[#00E5FF]/25 border border-sky-400 text-white shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                    : 'bg-neutral-900/85 border border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-[#00E5FF]' : 'text-neutral-400'}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 2. Desktop & Tablet Sidebar (Visible on md+) */}
        <div className="hidden md:flex flex-col gap-2 shrink-0 w-52 lg:w-56 overflow-y-auto min-h-0 custom-scrollbar pr-1 justify-between">
          <div className="flex flex-col gap-2 shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  id={`settings-tab-${tab.key}`}
                  onClick={() => {
                    soundManager.playClick();
                    setActiveTab(tab.key);
                  }}
                  onMouseEnter={() => soundManager.playHover()}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-gradient-to-r from-sky-500/20 to-[#00E5FF]/20 border border-sky-400 text-white shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                      : 'bg-neutral-900/75 border border-neutral-800/80 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-800/80 hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isSelected ? 'text-[#00E5FF]' : 'text-neutral-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Reset All Progress Action at bottom of tabs */}
          <div className="pt-3 border-t border-neutral-800/80 mt-2">
            <MenuButton
              id="settings-btn-reset-data"
              variant="danger"
              size="sm"
              soundType="back"
              onClick={() => setShowResetConfirm(true)}
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              className="w-full justify-center text-xs"
            >
              Reset Data
            </MenuButton>
          </div>
        </div>

        {/* Right Active Panel Content */}
        <div className="flex-1 min-h-0 min-w-0 rounded-2xl sm:rounded-3xl border border-neutral-800/90 bg-neutral-900/80 p-3.5 sm:p-6 backdrop-blur-md overflow-y-auto custom-scrollbar shadow-2xl">
          <AnimatePresence mode="wait">
            {/* 1. AUDIO SETTINGS */}
            {activeTab === 'audio' && (
              <motion.div
                key="tab-audio"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                <div className="border-b border-neutral-800 pb-3">
                  <h2 className="text-base font-black uppercase tracking-wider text-white">Audio Matrix</h2>
                  <p className="text-xs font-mono text-neutral-400">
                    Real-time synthesis, arpeggio melodies & SFX balance
                  </p>
                </div>

                {/* Master Mute Toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300">
                      {settings.isMuted ? <VolumeX className="h-5 w-5 text-rose-400" /> : <Volume2 className="h-5 w-5 text-[#00FF88]" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Mute All Audio</div>
                      <div className="text-xs text-neutral-400">Silences all music and sound effects</div>
                    </div>
                  </div>
                  <ToggleSwitch
                    id="toggle-audio-mute"
                    checked={settings.isMuted}
                    onChange={() => handleToggle('isMuted')}
                  />
                </div>

                {/* Master Volume Slider */}
                <div className="space-y-2 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                    <span className="text-neutral-300">Master Volume</span>
                    <span className="font-mono text-[#00E5FF]">{Math.round(settings.masterVolume * 100)}%</span>
                  </div>
                  <input
                    id="slider-master-volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.masterVolume}
                    onChange={(e) => handleSliderChange('masterVolume', e)}
                    onMouseUp={handleSliderRelease}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-neutral-800 accent-[#00E5FF]"
                  />
                </div>

                {/* Dynamic Music Volume Slider */}
                <div className="space-y-2 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-300">Procedural Music</span>
                      <span className="rounded-md bg-[#BF5AF2]/15 px-2 py-0.5 text-[10px] font-bold text-[#BF5AF2]">
                        130 BPM Synth
                      </span>
                    </div>
                    <span className="font-mono text-[#BF5AF2]">{Math.round(settings.musicVolume * 100)}%</span>
                  </div>
                  <input
                    id="slider-music-volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.musicVolume}
                    onChange={(e) => handleSliderChange('musicVolume', e)}
                    onMouseUp={handleSliderRelease}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-neutral-800 accent-[#BF5AF2]"
                  />
                </div>

                {/* SFX Volume Slider */}
                <div className="space-y-2 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                    <span className="text-neutral-300">Sound Effects (SFX)</span>
                    <span className="font-mono text-[#00FF88]">{Math.round(settings.sfxVolume * 100)}%</span>
                  </div>
                  <input
                    id="slider-sfx-volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.sfxVolume}
                    onChange={(e) => handleSliderChange('sfxVolume', e)}
                    onMouseUp={handleSliderRelease}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-neutral-800 accent-[#00FF88]"
                  />
                  <div className="pt-2 flex justify-end">
                    <button
                      id="btn-test-sfx"
                      onClick={() => soundManager.playJump()}
                      className="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-1 text-[11px] font-bold uppercase text-neutral-300 hover:text-white"
                    >
                      Test Jump SFX
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. GRAPHICS SETTINGS */}
            {activeTab === 'graphics' && (
              <motion.div
                key="tab-graphics"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <div className="border-b border-neutral-800 pb-3">
                  <h2 className="text-base font-black uppercase tracking-wider text-white">Visual Engine</h2>
                  <p className="text-xs font-mono text-neutral-400">Rendering quality, particles & screen FX</p>
                </div>

                {/* Graphics Quality Presets */}
                <div className="space-y-2 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Quality Preset
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[]).map((quality) => (
                      <button
                        key={quality}
                        id={`btn-quality-${quality}`}
                        onClick={() => {
                          soundManager.playClick();
                          updateSetting('graphicsQuality', quality);
                        }}
                        className={`rounded-xl py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                          settings.graphicsQuality === quality
                            ? 'bg-[#00E5FF]/20 border border-[#00E5FF] text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.2)]'
                            : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {quality}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Particle Effects Toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div>
                    <div className="text-sm font-bold text-white">Particle Emission Systems</div>
                    <div className="text-xs text-neutral-400">Render jump sparks, explosion fragments & trail particles</div>
                  </div>
                  <ToggleSwitch
                    id="toggle-particles"
                    checked={settings.particleEffects}
                    onChange={() => handleToggle('particleEffects')}
                  />
                </div>

                {/* Screen Shake Toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div>
                    <div className="text-sm font-bold text-white">Dynamic Camera Shake</div>
                    <div className="text-xs text-neutral-400">Kinetic feedback upon impacts and near misses</div>
                  </div>
                  <ToggleSwitch
                    id="toggle-screen-shake"
                    checked={settings.screenShake}
                    onChange={() => handleToggle('screenShake')}
                  />
                </div>

                {/* FPS Display Toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div>
                    <div className="text-sm font-bold text-white">Show Frame Rate (FPS)</div>
                    <div className="text-xs text-neutral-400">Display live 60 FPS counter in HUD overlay</div>
                  </div>
                  <ToggleSwitch
                    id="toggle-fps"
                    checked={settings.showFps}
                    onChange={() => handleToggle('showFps')}
                  />
                </div>

                {/* Developer Cross-Platform Diagnostics Toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Cross-Platform Diagnostics</span>
                      <span className="rounded-md bg-[#00E5FF]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#00E5FF]">
                        F3
                      </span>
                    </div>
                    <div className="text-xs text-neutral-400">
                      Display real-time device classifications, DPR, input modality, viewport & canvas resolution
                    </div>
                  </div>
                  <ToggleSwitch
                    id="toggle-diagnostics"
                    checked={settings.showCrossPlatformDebug}
                    onChange={() => handleToggle('showCrossPlatformDebug')}
                  />
                </div>
              </motion.div>
            )}

            {/* 3. GAMEPLAY SETTINGS */}
            {activeTab === 'gameplay' && (
              <motion.div
                key="tab-gameplay"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <div className="border-b border-neutral-800 pb-3">
                  <h2 className="text-base font-black uppercase tracking-wider text-white">Gameplay Calibration</h2>
                  <p className="text-xs font-mono text-neutral-400">Respawn flow & HUD indicators</p>
                </div>

                {/* Auto-Retry on Death */}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div>
                    <div className="text-sm font-bold text-white">Fast Instant Respawn</div>
                    <div className="text-xs text-neutral-400">Instantaneous restart loop (sub-0.5s recovery)</div>
                  </div>
                  <ToggleSwitch
                    id="toggle-auto-retry"
                    checked={settings.autoRetryOnDeath}
                    onChange={() => handleToggle('autoRetryOnDeath')}
                  />
                </div>

                {/* Show Progress Percentage */}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div>
                    <div className="text-sm font-bold text-white">HUD Progress Gauge</div>
                    <div className="text-xs text-neutral-400">Display real-time level completion % in the top bar</div>
                  </div>
                  <ToggleSwitch
                    id="toggle-progress-bar"
                    checked={settings.showProgressPercentage}
                    onChange={() => handleToggle('showProgressPercentage')}
                  />
                </div>

                {/* Quick Restart Hotkey [R] */}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div>
                    <div className="text-sm font-bold text-white">Quick Restart Hotkey [R]</div>
                    <div className="text-xs text-neutral-400">Press 'R' key at any time during gameplay to restart</div>
                  </div>
                  <ToggleSwitch
                    id="toggle-quick-restart"
                    checked={settings.quickRestartKey}
                    onChange={() => handleToggle('quickRestartKey')}
                  />
                </div>
              </motion.div>
            )}

            {/* 4. ACCESSIBILITY SETTINGS */}
            {activeTab === 'accessibility' && (
              <motion.div
                key="tab-accessibility"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <div className="border-b border-neutral-800 pb-3">
                  <h2 className="text-base font-black uppercase tracking-wider text-white">Accessibility & Tactile Feedback</h2>
                  <p className="text-xs font-mono text-neutral-400">Visual comfort, motion sensitivity & physical haptic feedback</p>
                </div>

                {/* Haptic Feedback (Vibration) Toggle */}
                <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Haptic Feedback</span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                            Haptics.isSupported()
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                          }`}
                        >
                          {Haptics.isSupported() ? 'Hardware Supported' : 'Simulated / Not Detected'}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400">
                        Physical tactile vibration for jumps, landings, crashes & menu interactions
                      </div>
                    </div>
                    <ToggleSwitch
                      id="toggle-haptics"
                      checked={settings.hapticsEnabled}
                      onChange={() => {
                        const nextVal = !settings.hapticsEnabled;
                        updateSetting('hapticsEnabled', nextVal);
                        if (nextVal) {
                          Haptics.play('light');
                        }
                      }}
                    />
                  </div>

                  {/* Haptics Intensity Level Selector */}
                  <div className="pt-2 border-t border-neutral-800/80">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-300 mb-2">
                      <span>Haptic Intensity</span>
                      <span className="font-mono text-[#00E5FF] capitalize">{settings.hapticsIntensity}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'medium', 'high'] as HapticIntensity[]).map((intensity) => (
                        <button
                          key={intensity}
                          id={`btn-haptic-intensity-${intensity}`}
                          disabled={!settings.hapticsEnabled}
                          onClick={() => {
                            updateSetting('hapticsIntensity', intensity);
                            Haptics.setIntensity(intensity);
                            if (intensity === 'low') Haptics.play('selection');
                            else if (intensity === 'medium') Haptics.play('light');
                            else Haptics.play('heavy');
                          }}
                          className={`rounded-xl py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            !settings.hapticsEnabled
                              ? 'opacity-40 cursor-not-allowed bg-neutral-800/50 text-neutral-500 border border-neutral-800'
                              : settings.hapticsIntensity === intensity
                              ? 'bg-[#00E5FF]/20 border border-[#00E5FF] text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.2)]'
                              : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {intensity}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Screen Flash Limiter */}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div>
                    <div className="text-sm font-bold text-white">Screen Flash Effects</div>
                    <div className="text-xs text-neutral-400">Disable white flash pulses on high-impact collisions</div>
                  </div>
                  <ToggleSwitch
                    id="toggle-screen-flash"
                    checked={settings.screenFlash}
                    onChange={() => handleToggle('screenFlash')}
                  />
                </div>

                {/* Reduced Motion */}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div>
                    <div className="text-sm font-bold text-white">Reduced Menu Motion</div>
                    <div className="text-xs text-neutral-400">Reduce background particle drift and rotational velocity</div>
                  </div>
                  <ToggleSwitch
                    id="toggle-reduced-motion"
                    checked={settings.reducedMotion}
                    onChange={() => handleToggle('reducedMotion')}
                  />
                </div>

                {/* High Contrast HUD */}
                <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div>
                    <div className="text-sm font-bold text-white">High Contrast HUD</div>
                    <div className="text-xs text-neutral-400">Darker opaque backgrounds behind UI meters for enhanced clarity</div>
                  </div>
                  <ToggleSwitch
                    id="toggle-high-contrast"
                    checked={settings.highContrastHUD}
                    onChange={() => handleToggle('highContrastHUD')}
                  />
                </div>
              </motion.div>
            )}

            {/* 5. CONTROLS REFERENCE */}
            {activeTab === 'controls' && (
              <motion.div
                key="tab-controls"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                <div className="border-b border-neutral-800 pb-3">
                  <h2 className="text-base font-black uppercase tracking-wider text-white">Cross-Platform Controls</h2>
                  <p className="text-xs font-mono text-neutral-400">Desktop, laptop, mobile phone & tablet input mappings</p>
                </div>

                {/* Desktop & Laptop Controls */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00E5FF]">
                    <Monitor className="h-4 w-4" />
                    <span>Desktop & Laptop Controls</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3.5">
                      <div className="flex h-10 w-20 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 font-mono text-xs font-black text-white shadow-md">
                        SPACE / W
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Jump / Leap</div>
                        <div className="text-xs text-neutral-400">Execute jump arc</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 text-neutral-300 shadow-md">
                        <MousePointer className="h-4 w-4 text-[#00E5FF]" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Left Mouse Click</div>
                        <div className="text-xs text-neutral-400">Alternate jump control</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 font-mono text-sm font-black text-amber-400 shadow-md">
                        R
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Quick Restart</div>
                        <div className="text-xs text-neutral-400">Instant level reload</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3.5">
                      <div className="flex h-10 w-12 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 font-mono text-xs font-black text-rose-400 shadow-md">
                        ESC
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Pause Menu</div>
                        <div className="text-xs text-neutral-400">Open in-game pause options</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile & Tablet Controls */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00FF88]">
                    <Smartphone className="h-4 w-4" />
                    <span>Mobile & Tablet Controls</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 text-[#00FF88] shadow-md">
                        <Touchpad className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Tap Anywhere</div>
                        <div className="text-xs text-neutral-400">Jump / bounce on pads</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800 text-[#BF5AF2] shadow-md">
                        <RotateCcw className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Landscape Mode</div>
                        <div className="text-xs text-neutral-400">Optimized horizontal view</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-sky-300 flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 shrink-0 text-sky-400 mt-0.5" />
                  <span>
                    <strong>Pro Tip:</strong> Hold down the jump key or keep touching the screen across sequential leap pads to auto-chain airborne trajectories with perfect timing!
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Reset Confirmation Dialog Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 safe-p backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-[#111827] p-5 sm:p-6 text-center shadow-2xl my-auto">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 mb-3 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold uppercase tracking-wider text-white">Reset All Progress?</h3>
            <p className="mt-1 text-xs text-neutral-400">
              This will erase all completed levels, record times, and unlocked skins.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <MenuButton
                id="modal-btn-cancel-reset"
                variant="secondary"
                soundType="back"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 justify-center py-2.5 text-xs font-bold"
              >
                Cancel
              </MenuButton>
              <MenuButton
                id="modal-btn-confirm-reset"
                variant="danger"
                soundType="confirm"
                onClick={handleResetProgress}
                className="flex-1 justify-center py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white border-rose-500/40"
              >
                Reset All
              </MenuButton>
            </div>
          </div>
        </div>
      )}

      {/* Reset Success Toast */}
      {resetSuccess && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-50 flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-neutral-900 px-4 py-3 text-xs font-bold text-emerald-400 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
          <Check className="h-4 w-4" />
          <span>All game data has been reset to default factory state.</span>
        </div>
      )}
    </div>
  );
}

/**
 * Reusable animated toggle switch component.
 */
function ToggleSwitch({
  id,
  checked,
  onChange,
}: {
  id?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF] ${
        checked ? 'bg-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.4)]' : 'bg-neutral-800'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-neutral-950 shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
