/**
 * Rush Engine Audio system contracts and types for Web Audio API sound and music management.
 */
export interface IAudioManager {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  init(): Promise<void>;
  playSound(id: string, volume?: number): void;
  playMusic(id: string, loop?: boolean): void;
  stopMusic(): void;
  destroy(): void;
}
