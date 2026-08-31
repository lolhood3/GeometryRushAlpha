import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCw, Smartphone } from 'lucide-react';
import { DeviceUtils } from '../../engine/utils/DeviceUtils.ts';

interface RotateDeviceOverlayProps {
  onOrientationChange?: (isPortrait: boolean) => void;
}

/**
 * Mobile and Tablet Landscape Enforcement Overlay.
 * When a touch or mobile device is held in portrait orientation,
 * this overlay gracefully pauses gameplay and instructs the user to rotate their device.
 */
export function RotateDeviceOverlay({ onOrientationChange }: RotateDeviceOverlayProps) {
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isTouch = DeviceUtils.isTouchDevice();
      const deviceType = DeviceUtils.getDeviceType();
      const isNarrowOrPortrait = window.innerHeight > window.innerWidth || window.innerWidth / window.innerHeight < 1.05;

      // Only enforce rotate overlay on touch/mobile/tablet devices or small portrait viewports
      const shouldShowOverlay = (isTouch || deviceType !== 'desktop') && isNarrowOrPortrait;

      setIsPortrait(shouldShowOverlay);
      if (onOrientationChange) {
        onOrientationChange(shouldShowOverlay);
      }
    };

    checkOrientation();

    // Listen to resize, orientationchange, and screen.orientation
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener?.('change', checkOrientation);
    }

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener?.('change', checkOrientation);
      }
    };
  }, [onOrientationChange]);

  const handleAttemptLock = () => {
    DeviceUtils.lockLandscape();
  };

  return (
    <AnimatePresence>
      {isPortrait && (
        <motion.div
          id="rotate-device-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={handleAttemptLock}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0E1A] p-6 text-center text-white select-none backdrop-blur-xl"
        >
          {/* Animated Glowing Phone Rotation Graphic */}
          <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
            {/* Background circular pulse glow */}
            <div className="absolute inset-0 rounded-full bg-[#00E5FF]/10 blur-xl animate-pulse" />
            
            {/* Rotating Phone Icon with Motion */}
            <motion.div
              animate={{
                rotate: [0, -90, -90, 0],
                scale: [1, 1.05, 1.05, 1],
              }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: 'easeInOut',
                times: [0, 0.45, 0.75, 1],
              }}
              className="relative flex h-20 w-12 items-center justify-center rounded-2xl border-2 border-[#00E5FF] bg-neutral-900/90 shadow-[0_0_25px_rgba(0,229,255,0.4)]"
            >
              {/* Screen notch & screen area */}
              <div className="absolute top-1.5 h-1 w-3 rounded-full bg-neutral-600" />
              <div className="flex h-12 w-8 items-center justify-center rounded-lg bg-black/60 border border-neutral-800">
                <Smartphone className="h-4 w-4 text-[#00E5FF]" />
              </div>
              <div className="absolute bottom-1.5 h-1 w-1 rounded-full bg-neutral-600" />
            </motion.div>

            {/* Orbiting Rotation Hint Icon */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              className="pointer-events-none absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#00FF88] text-black shadow-lg"
            >
              <RotateCw className="h-4 w-4 stroke-[2.5]" />
            </motion.div>
          </div>

          {/* Heading */}
          <h2 className="text-xl font-black uppercase tracking-wider text-white sm:text-2xl">
            Rotate Your Device
          </h2>

          {/* Description */}
          <p className="mt-2 max-w-xs font-mono text-xs sm:text-sm text-neutral-400">
            Geometry Rush is optimized exclusively for <strong>landscape</strong> orientation.
          </p>

          {/* Secondary Subtitle */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/80 px-4 py-2 text-xs font-semibold text-neutral-300 shadow-inner">
            <span className="h-2 w-2 rounded-full bg-[#00FF88] animate-ping" />
            Turn horizontally to continue rushing
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
