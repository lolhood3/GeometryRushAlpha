/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { CanvasContainer } from './ui/CanvasContainer.tsx';
import { GameOverlay } from './ui/GameOverlay.tsx';
import { SoundUtility } from './engine/audio/SoundUtility.ts';

export default function App() {
  const [isEngineReady, setIsEngineReady] = useState(false);

  useEffect(() => {
    SoundUtility.initGestureUnlock();
  }, []);

  const handleEngineReady = useCallback(() => {
    setIsEngineReady(true);
  }, []);

  return (
    <main id="app-root" className="relative app-viewport overflow-hidden bg-black select-none">
      {/* HTML5 Canvas container hosting the Rush Engine */}
      <CanvasContainer onEngineReady={handleEngineReady} />

      {/* React UI Shell: diagnostics and HUD only, never renders game objects */}
      <GameOverlay isEngineReady={isEngineReady} />
    </main>
  );
}
