import { useEffect, useCallback } from 'react';
import { SoundUtility, type MenuSoundType, type SoundCueOptions } from '../../engine/audio/SoundUtility.ts';

/**
 * useMenuSound hook exposes reactive, zero-latency tactile audio triggers for React UI components.
 * Automatically initializes gesture unlocking on first mount.
 */
export function useMenuSound() {
  useEffect(() => {
    SoundUtility.initGestureUnlock();
  }, []);

  const playHover = useCallback((options?: SoundCueOptions) => {
    SoundUtility.hover(options);
  }, []);

  const playClick = useCallback((options?: SoundCueOptions) => {
    SoundUtility.click(options);
  }, []);

  const playConfirm = useCallback((options?: SoundCueOptions) => {
    SoundUtility.confirm(options);
  }, []);

  const playBack = useCallback(() => {
    SoundUtility.back();
  }, []);

  const playError = useCallback(() => {
    SoundUtility.error();
  }, []);

  const playToggle = useCallback((isOn: boolean) => {
    SoundUtility.toggle(isOn);
  }, []);

  const playTick = useCallback((normalizedVal: number = 0.5) => {
    SoundUtility.tick(normalizedVal);
  }, []);

  const playEquip = useCallback(() => {
    SoundUtility.equip();
  }, []);

  const play = useCallback((type: MenuSoundType, options?: SoundCueOptions) => {
    SoundUtility.play(type, options);
  }, []);

  return {
    playHover,
    playClick,
    playConfirm,
    playBack,
    playError,
    playToggle,
    playTick,
    playEquip,
    play,
  };
}
