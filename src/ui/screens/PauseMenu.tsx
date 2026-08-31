import {
  Play,
  RotateCcw,
  Settings as SettingsIcon,
  Home,
  Pause,
  Target,
  Flame,
} from 'lucide-react';
import { MenuButton } from '../components/MenuButton.tsx';

interface PauseMenuProps {
  levelName: string;
  difficulty: string;
  attempt: number;
  progress: number;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onMainMenu: () => void;
}

export function PauseMenu({
  levelName,
  difficulty,
  attempt,
  progress,
  onResume,
  onRestart,
  onOpenSettings,
  onMainMenu,
}: PauseMenuProps) {
  return (
    <div
      id="pause-menu-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 safe-p backdrop-blur-md animate-in fade-in duration-200 select-none overflow-y-auto custom-scrollbar"
    >
      <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl border border-neutral-800 bg-[#111827]/95 p-4 sm:p-6 text-center shadow-2xl my-auto">
        {/* Top Header Row */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 sm:pb-3 mb-3 sm:mb-4">
          <div className="flex items-center gap-2.5 sm:gap-3 text-left">
            <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl border border-sky-500/40 bg-sky-500/15 text-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.25)] shrink-0">
              <Pause className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-black uppercase tracking-wider text-white">GAME PAUSED</h2>
              <p className="text-[11px] sm:text-xs font-semibold text-neutral-400">
                {levelName} • <span className="text-[#00E5FF]">{difficulty}</span>
              </p>
            </div>
          </div>

          {/* Quick Mini Stats Badges */}
          <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-[10px] sm:text-xs">
            <div className="flex items-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border border-neutral-800 bg-neutral-900/80 px-2.5 sm:px-3 py-1 sm:py-1.5">
              <Target className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#00E5FF]" />
              <span className="text-neutral-400">Run:</span>
              <strong className="text-white">#{attempt}</strong>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-xl border border-neutral-800 bg-neutral-900/80 px-2.5 sm:px-3 py-1 sm:py-1.5">
              <Flame className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#00FF88]" />
              <strong className="text-white">{Math.floor(progress)}%</strong>
            </div>
          </div>
        </div>

        {/* Action Buttons 2-Column Grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* 1. Resume */}
          <div className="col-span-2 sm:col-span-1">
            <MenuButton
              id="pause-btn-resume"
              variant="primary"
              size="md"
              soundType="confirm"
              onClick={onResume}
              icon={<Play className="h-4 w-4 fill-current ml-0.5" />}
              className="w-full justify-center text-xs font-black min-h-[44px]"
            >
              Resume
            </MenuButton>
          </div>

          {/* 2. Restart */}
          <div className="col-span-2 sm:col-span-1">
            <MenuButton
              id="pause-btn-restart"
              variant="secondary"
              size="md"
              soundType="click"
              onClick={onRestart}
              icon={<RotateCcw className="h-4 w-4" />}
              className="w-full justify-center text-xs font-bold min-h-[44px]"
            >
              Restart [R]
            </MenuButton>
          </div>

          {/* 3. Settings */}
          <MenuButton
            id="pause-btn-settings"
            variant="secondary"
            size="md"
            soundType="click"
            onClick={onOpenSettings}
            icon={<SettingsIcon className="h-4 w-4" />}
            className="w-full justify-center text-xs font-bold min-h-[44px]"
          >
            Settings
          </MenuButton>

          {/* 4. Main Menu */}
          <MenuButton
            id="pause-btn-main-menu"
            variant="danger"
            size="md"
            soundType="back"
            onClick={onMainMenu}
            icon={<Home className="h-4 w-4" />}
            className="w-full justify-center text-xs font-bold min-h-[44px]"
          >
            Main Menu
          </MenuButton>
        </div>
      </div>
    </div>
  );
}
