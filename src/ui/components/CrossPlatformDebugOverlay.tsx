import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  Cpu,
  Maximize2,
  Minimize2,
  Smartphone,
  Tablet,
  Laptop,
  Monitor,
  MousePointer,
  Touchpad,
  X,
} from 'lucide-react';
import { DeviceUtils, type DeviceInfo } from '../../engine/utils/DeviceUtils.ts';
import { Engine } from '../../engine/core/Engine.ts';

interface CrossPlatformDebugOverlayProps {
  onClose?: () => void;
}

/**
 * Developer Diagnostics Overlay.
 * Displays real-time device classifications, active input modalities,
 * viewport resolutions, DPR metrics, orientation states, and engine frame times.
 */
export function CrossPlatformDebugOverlay({ onClose }: CrossPlatformDebugOverlayProps) {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => DeviceUtils.getDeviceInfo());
  const [fps, setFps] = useState<number>(60);
  const [frameTime, setFrameTime] = useState<number>(16.6);
  const [pointerInfo, setPointerInfo] = useState<{
    type: string;
    isDown: boolean;
    x: number;
    y: number;
    activeCount: number;
  }>({
    type: 'none',
    isDown: false,
    x: 0,
    y: 0,
    activeCount: 0,
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(DeviceUtils.isFullscreen());

  // Metrics polling loop
  useEffect(() => {
    let animId: number;
    let frameCount = 0;
    let lastTime = performance.now();

    const updateMetrics = (now: number) => {
      frameCount++;
      const elapsed = now - lastTime;
      if (elapsed >= 400) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        setFrameTime(parseFloat((elapsed / frameCount).toFixed(1)));
        frameCount = 0;
        lastTime = now;
        setDeviceInfo(DeviceUtils.getDeviceInfo());
        setIsFullscreen(DeviceUtils.isFullscreen());
      }

      // Query live engine input state
      const engine = Engine.currentInstance;
      if (engine?.input) {
        const input = engine.input;
        const pos = input.getPointerPosition();
        setPointerInfo({
          type: input.getPointerType(),
          isDown: input.isPointerDown(),
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          activeCount: input.getActivePointerCount(),
        });
      }

      animId = requestAnimationFrame(updateMetrics);
    };

    animId = requestAnimationFrame(updateMetrics);
    return () => cancelAnimationFrame(animId);
  }, []);

  const toggleFullscreen = () => {
    if (DeviceUtils.isFullscreen()) {
      DeviceUtils.exitFullscreen();
    } else {
      DeviceUtils.requestFullscreen();
    }
    setIsFullscreen(DeviceUtils.isFullscreen());
  };

  const getDeviceIcon = () => {
    switch (deviceInfo.deviceType) {
      case 'mobile':
        return <Smartphone className="h-4 w-4 text-[#00E5FF]" />;
      case 'tablet':
        return <Tablet className="h-4 w-4 text-[#BF5AF2]" />;
      default:
        return <Monitor className="h-4 w-4 text-[#00FF88]" />;
    }
  };

  const engine = Engine.currentInstance;
  const canvasWidth = engine?.canvasManager?.width ?? deviceInfo.viewportWidth;
  const canvasHeight = engine?.canvasManager?.height ?? deviceInfo.viewportHeight;
  const scale = canvasHeight > 0 ? canvasHeight / 540 : 1;
  const logicalWidth = Math.round(canvasWidth / scale);

  return (
    <motion.div
      id="cross-platform-debug-overlay"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="pointer-events-auto fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-40 w-80 max-w-[calc(100vw-max(1.5rem,env(safe-area-inset-left)+env(safe-area-inset-right)))] rounded-2xl border border-neutral-800/90 bg-neutral-950/95 p-3.5 text-white shadow-2xl backdrop-blur-xl select-none font-mono text-[11px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-[#00E5FF]" />
          <span className="font-bold uppercase tracking-wider text-white text-[10px]">
            Rush Engine Diagnostics
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleFullscreen}
            className="flex h-5 w-5 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-5 w-5 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
              title="Close [F3]"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Grid of Diagnostics */}
      <div className="space-y-1.5 leading-relaxed text-neutral-300">
        {/* Device & Input Modality */}
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Device Form:</span>
          <span className="flex items-center gap-1.5 font-bold text-white uppercase">
            {getDeviceIcon()}
            {deviceInfo.deviceType}
          </span>
        </div>

        {/* Input Modality */}
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Input Mode:</span>
          <span className="font-bold text-[#00E5FF] capitalize">
            {deviceInfo.primaryInput} ({pointerInfo.type !== 'none' ? pointerInfo.type : 'idle'})
          </span>
        </div>

        {/* Orientation */}
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Orientation:</span>
          <span
            className={`font-bold capitalize ${
              deviceInfo.orientation === 'landscape' ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {deviceInfo.orientation} ({deviceInfo.orientationAngle}°)
          </span>
        </div>

        {/* Viewport Dimensions */}
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">CSS Viewport:</span>
          <span className="font-bold text-neutral-200">
            {deviceInfo.viewportWidth} × {deviceInfo.viewportHeight} px
          </span>
        </div>

        {/* Logical Viewport Resolution */}
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Logical Game:</span>
          <span className="font-bold text-neutral-200">
            {logicalWidth} × 540 px ({scale.toFixed(2)}x)
          </span>
        </div>

        {/* DPR & Touch Points */}
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">DPR / Touch Points:</span>
          <span className="font-bold text-neutral-200">
            {deviceInfo.dpr}x DPR • {deviceInfo.maxTouchPoints} pts
          </span>
        </div>

        {/* Pointer Position */}
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">Pointer Action:</span>
          <span className={`font-bold ${pointerInfo.isDown ? 'text-[#00FF88]' : 'text-neutral-400'}`}>
            {pointerInfo.isDown ? 'DOWN' : 'UP'} ({pointerInfo.x}, {pointerInfo.y})
          </span>
        </div>

        {/* Engine Performance */}
        <div className="mt-2 pt-1.5 border-t border-neutral-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-emerald-400" />
            <span className="font-bold text-emerald-400">{fps} FPS</span>
          </div>
          <span className="text-neutral-400">{frameTime} ms / frame</span>
        </div>
      </div>
    </motion.div>
  );
}
