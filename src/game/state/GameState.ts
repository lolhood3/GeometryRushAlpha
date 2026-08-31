import { ALL_LEVELS, type LevelData } from '../levels/LevelData.ts';
import { ALL_SKINS, DEFAULT_SKIN_ID, type SkinData, getSkinById } from '../skins/SkinData.ts';
import { HapticsManager, type HapticIntensity } from '../../engine/haptics/HapticsManager.ts';

export interface LevelProgress {
  completed: boolean;
  bestAttempts?: number;
  bestTime?: number;
  lastPlayedAt?: number;
}

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface GameSettings {
  // Audio
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  isMuted: boolean;
  // Haptics & Vibration
  hapticsEnabled: boolean;
  hapticsIntensity: HapticIntensity;
  // Graphics
  graphicsQuality: GraphicsQuality;
  particleEffects: boolean;
  screenShake: boolean;
  showFps: boolean;
  // Gameplay
  autoRetryOnDeath: boolean;
  showProgressPercentage: boolean;
  quickRestartKey: boolean;
  // Accessibility
  screenFlash: boolean;
  reducedMotion: boolean;
  highContrastHUD: boolean;
  // Developer Diagnostics
  showCrossPlatformDebug: boolean;
}

const STORAGE_KEY_PROGRESS = 'geometry_rush_progress_v1';
const STORAGE_KEY_SETTINGS = 'geometry_rush_settings_v1';
const STORAGE_KEY_SKIN = 'geometry_rush_equipped_skin_v1';

export class GameStateManager {
  private static instance: GameStateManager;

  private progressMap: Map<string, LevelProgress> = new Map();
  private equippedSkinId: string = DEFAULT_SKIN_ID;
  private settings: GameSettings = {
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 0.9,
    isMuted: false,
    hapticsEnabled: true,
    hapticsIntensity: 'medium',
    graphicsQuality: 'high',
    particleEffects: true,
    screenShake: true,
    showFps: false,
    autoRetryOnDeath: false,
    showProgressPercentage: true,
    quickRestartKey: true,
    screenFlash: true,
    reducedMotion: false,
    highContrastHUD: false,
    showCrossPlatformDebug: false,
  };

  private constructor() {
    this.load();
    this.syncHaptics();
  }

  public static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  private syncHaptics(): void {
    const haptics = HapticsManager.getInstance();
    haptics.setEnabled(this.settings.hapticsEnabled);
    haptics.setIntensity(this.settings.hapticsIntensity);
  }

  private load(): void {
    try {
      // 1. Load progress
      const progressRaw = localStorage.getItem(STORAGE_KEY_PROGRESS);
      if (progressRaw) {
        const parsed = JSON.parse(progressRaw);
        for (const [lvlId, val] of Object.entries(parsed)) {
          this.progressMap.set(lvlId, val as LevelProgress);
        }
      }

      // 2. Load skin
      const skinRaw = localStorage.getItem(STORAGE_KEY_SKIN);
      if (skinRaw && ALL_SKINS.some((s) => s.id === skinRaw)) {
        this.equippedSkinId = skinRaw;
      }

      // 3. Load settings
      const settingsRaw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (settingsRaw) {
        this.settings = { ...this.settings, ...JSON.parse(settingsRaw) };
      }
    } catch {
      // Ignore parsing errors
    }
  }

  public save(): void {
    try {
      const obj: Record<string, LevelProgress> = {};
      this.progressMap.forEach((v, k) => {
        obj[k] = v;
      });
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(obj));
      localStorage.setItem(STORAGE_KEY_SKIN, this.equippedSkinId);
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
  }

  public isLevelUnlocked(levelId: string): boolean {
    const idx = ALL_LEVELS.findIndex((l) => l.id === levelId);
    if (idx <= 0) return true; // Level 1 is always unlocked
    // Check if the prior level was completed
    const prevLevel = ALL_LEVELS[idx - 1];
    const prevProgress = this.progressMap.get(prevLevel.id);
    return Boolean(prevProgress?.completed);
  }

  public getLevelProgress(levelId: string): LevelProgress {
    return this.progressMap.get(levelId) || { completed: false };
  }

  public recordLevelVictory(levelId: string, attempts: number, timeSeconds: number): void {
    const existing = this.progressMap.get(levelId) || { completed: false };
    const bestAttempts = existing.bestAttempts !== undefined ? Math.min(existing.bestAttempts, attempts) : attempts;
    const bestTime = existing.bestTime !== undefined ? Math.min(existing.bestTime, timeSeconds) : timeSeconds;

    this.progressMap.set(levelId, {
      completed: true,
      bestAttempts,
      bestTime,
      lastPlayedAt: Date.now(),
    });
    this.save();
  }

  /**
   * Returns the highest unlocked level data to continue immediately.
   */
  public getHighestUnlockedLevel(): LevelData {
    let highest = ALL_LEVELS[0];
    for (let i = 0; i < ALL_LEVELS.length; i++) {
      const level = ALL_LEVELS[i];
      if (this.isLevelUnlocked(level.id)) {
        highest = level;
      }
    }
    return highest;
  }

  public isSkinUnlocked(skinId: string): boolean {
    const skin = getSkinById(skinId);
    if (!skin.requiredLevelId) return true;
    const progress = this.progressMap.get(skin.requiredLevelId);
    return Boolean(progress?.completed);
  }

  public getEquippedSkin(): SkinData {
    return getSkinById(this.equippedSkinId);
  }

  public equipSkin(skinId: string): boolean {
    if (this.isSkinUnlocked(skinId)) {
      this.equippedSkinId = skinId;
      this.save();
      return true;
    }
    return false;
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.syncHaptics();
    this.save();
  }

  public resetAllProgress(): void {
    this.progressMap.clear();
    this.equippedSkinId = DEFAULT_SKIN_ID;
    this.save();
  }

  public getUnlockedLevelsCount(): number {
    return ALL_LEVELS.filter((l) => this.isLevelUnlocked(l.id)).length;
  }

  public getCompletedLevelsCount(): number {
    return ALL_LEVELS.filter((l) => this.progressMap.get(l.id)?.completed).length;
  }
}
