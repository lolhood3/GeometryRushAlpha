import { ArrowLeft, Code2, Gamepad2, MapPin, Palette, Sparkles, Zap, Cpu, Heart } from 'lucide-react';
import { MenuBackground } from '../components/MenuBackground.tsx';
import { MenuButton } from '../components/MenuButton.tsx';

interface CreditsScreenProps {
  onBack: () => void;
}

export function CreditsScreen({ onBack }: CreditsScreenProps) {
  const creditsList = [
    {
      role: 'Created By',
      name: 'Ankan Barik',
      icon: Sparkles,
      color: '#00E5FF',
    },
    {
      role: 'Powered By',
      name: 'Rush Engine',
      subtitle: 'Developed by Ankan Barik',
      icon: Cpu,
      color: '#00FF88',
    },
    {
      role: 'Programming',
      name: 'Ankan Barik',
      icon: Code2,
      color: '#00E5FF',
    },
    {
      role: 'Game Design',
      name: 'Ankan Barik',
      icon: Gamepad2,
      color: '#BF5AF2',
    },
    {
      role: 'Level Design',
      name: 'Ankan Barik',
      icon: MapPin,
      color: '#F59E0B',
    },
    {
      role: 'UI / UX Design',
      name: 'Ankan Barik',
      icon: Palette,
      color: '#FF3B30',
    },
  ];

  return (
    <div
      id="credits-screen"
      className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0E17] safe-p text-white select-none"
    >
      {/* Ambient Live Background */}
      <MenuBackground accentColor="#F59E0B" secondaryColor="#00E5FF" />

      {/* Top Navigation Bar */}
      <div className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between border-b border-neutral-800/80 pb-2 sm:pb-3 shrink-0">
        <MenuButton
          id="credits-back-btn"
          variant="secondary"
          size="sm"
          soundType="back"
          onClick={onBack}
          icon={<ArrowLeft className="h-4 w-4" />}
          className="min-h-[38px] px-3 py-1.5"
        >
          Menu
        </MenuButton>

        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <h1 className="text-sm sm:text-base font-black tracking-wider uppercase text-white">Project Credits</h1>
        </div>

        <div className="w-16 hidden sm:block" />
      </div>

      {/* Credits Card Container */}
      <div className="relative z-10 mx-auto mt-2 sm:mt-4 flex w-full max-w-3xl flex-1 min-h-0 flex-col items-center justify-start text-center overflow-y-auto pr-1 pb-6 custom-scrollbar">
        <div className="w-full rounded-2xl sm:rounded-3xl border border-neutral-800 bg-neutral-900/85 p-4 sm:p-7 shadow-2xl backdrop-blur-md">
          {/* Logo Badge */}
          <div className="mx-auto flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-tr from-[#00E5FF]/20 to-[#00FF88]/20 border border-[#00E5FF]/40 text-[#00E5FF] shadow-[0_0_30px_rgba(0,229,255,0.25)] mb-2 sm:mb-3">
            <Zap className="h-6 w-6 sm:h-8 sm:w-8" />
          </div>

          <h2 className="text-2xl sm:text-4xl font-black tracking-widest uppercase text-white">
            GEOMETRY <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E5FF] to-[#00FF88]">RUSH</span>
          </h2>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-neutral-700/60 bg-neutral-950/60 px-3 py-0.5 text-[10px] sm:text-xs font-mono text-neutral-400">
            <span>Version 1.0.0</span>
          </div>

          {/* Credits Grid */}
          <div className="mt-4 sm:mt-6 grid gap-2 sm:gap-3 sm:grid-cols-2 text-left">
            {creditsList.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="rounded-xl sm:rounded-2xl border border-neutral-800/80 bg-neutral-950/70 p-3 sm:p-4 transition-colors hover:border-neutral-700"
                >
                  <div
                    className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-0.5 sm:mb-1"
                    style={{ color: item.color }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.role}</span>
                  </div>
                  <div className="text-sm sm:text-base font-black text-white">{item.name}</div>
                  {item.subtitle && (
                    <div className="mt-0.5 text-[10px] sm:text-xs font-mono text-neutral-400">
                      {item.subtitle}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Special Thanks Section */}
          <div className="mt-2.5 sm:mt-4 rounded-xl sm:rounded-2xl border border-neutral-800/80 bg-neutral-950/70 p-3 sm:p-4 text-left">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
              <Heart className="h-3.5 w-3.5 fill-amber-400/20" />
              <span>Special Thanks</span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-neutral-200">
              Community Playtesters, Rhythm Action Enthusiasts & Early Supporters
            </p>
          </div>

          {/* Final Appreciation Message */}
          <div className="mt-4 sm:mt-6 border-t border-neutral-800/80 pt-4 sm:pt-6">
            <p className="text-sm sm:text-base font-bold tracking-wide text-neutral-200">
              “Thank you for playing Geometry Rush.”
            </p>
          </div>

          {/* Return Action */}
          <div className="mt-4 sm:mt-6">
            <MenuButton
              id="credits-return-btn"
              variant="secondary"
              size="md"
              soundType="back"
              onClick={onBack}
              className="mx-auto min-h-[44px]"
            >
              Return to Main Menu
            </MenuButton>
          </div>
        </div>
      </div>
    </div>
  );
}

