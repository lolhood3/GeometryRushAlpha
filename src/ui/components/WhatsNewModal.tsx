import { useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  Zap,
  Newspaper,
  Check,
  ChevronRight,
  X,
  Smartphone,
} from 'lucide-react';
import { UpdateManager } from '../../game/updates/updateManager.ts';
import { MenuButton } from './MenuButton.tsx';
import { SoundUtility } from '../../engine/audio/SoundUtility.ts';

interface WhatsNewModalProps {
  onClose: () => void;
  onViewUpdate: (updateId: string) => void;
}

export function WhatsNewModal({ onClose, onViewUpdate }: WhatsNewModalProps) {
  const updateManager = UpdateManager.getInstance();
  const latestUpdate = updateManager.getLatestUpdate();

  const handleGotIt = () => {
    SoundUtility.confirm();
    updateManager.acknowledgeWhatsNew(latestUpdate?.id);
    onClose();
  };

  const handleViewDetails = () => {
    SoundUtility.click();
    updateManager.acknowledgeWhatsNew(latestUpdate?.id);
    onViewUpdate(latestUpdate?.id || 'update-1-1');
  };

  // Keyboard navigation [Escape] or [Enter]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        handleGotIt();
      } else if (e.code === 'Enter' || e.code === 'Space') {
        handleGotIt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!latestUpdate) return null;

  return (
    <div
      id="whats-new-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 md:p-6 safe-p backdrop-blur-md animate-in fade-in duration-200 overflow-hidden"
    >
      <motion.div
        id="whats-new-modal"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative w-full max-w-lg max-h-[92dvh] sm:max-h-[88vh] flex flex-col rounded-2xl sm:rounded-3xl border border-neutral-800 bg-[#0F172A] text-left shadow-2xl overflow-hidden pointer-events-auto my-auto"
      >
        {/* Subtle Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-[#00E5FF]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-[#00FF88]/15 blur-3xl" />

        {/* Close Icon in Top Corner */}
        <button
          id="whats-new-close-icon-btn"
          onClick={handleGotIt}
          className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 z-10 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-neutral-700/60 bg-neutral-800/80 text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>

        {/* Modal Header: non-shrinking */}
        <div className="shrink-0 p-3 sm:p-5 pb-2 sm:pb-3 pr-10 border-b border-neutral-800/80">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.2)] mb-1 sm:mb-2">
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#00FF88]" />
            <span>{latestUpdate.playerFacingVersion} BULLETIN</span>
          </div>

          <h2 className="text-base sm:text-xl font-black uppercase tracking-wider text-white truncate">
            {latestUpdate.title}
          </h2>
          <p className="mt-0.5 text-[11px] sm:text-xs text-neutral-300 line-clamp-2">
            {latestUpdate.summary}
          </p>
        </div>

        {/* Modal Body: Scrollable area */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-5 space-y-2 sm:space-y-3">
          <div className="space-y-2 rounded-xl sm:rounded-2xl border border-neutral-800 bg-neutral-950/60 p-2.5 sm:p-3.5">
            <div className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-[#00E5FF] flex items-center gap-1.5 mb-1.5">
              <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span>Key Highlights</span>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              {latestUpdate.changes[0]?.items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-[11px] sm:text-xs text-neutral-200">
                  <div className="flex h-4 w-4 sm:h-4.5 sm:w-4.5 shrink-0 items-center justify-center rounded-md bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 mt-0.5">
                    <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </div>
                  <span className="leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer: Action Buttons (Never clipped or pushed offscreen) */}
        <div className="shrink-0 p-2.5 sm:p-4 border-t border-neutral-800/80 bg-neutral-950/80 flex items-center gap-2 sm:gap-3">
          <MenuButton
            id="whats-new-btn-view-update"
            variant="secondary"
            size="sm"
            soundType="click"
            onClick={handleViewDetails}
            icon={<Newspaper className="h-3.5 w-3.5 text-[#00E5FF]" />}
            iconRight={<ChevronRight className="h-3.5 w-3.5 opacity-70" />}
            className="flex-1 justify-center py-2 sm:py-2.5 text-xs font-bold min-h-[38px] sm:min-h-[42px] whitespace-nowrap"
          >
            View Update
          </MenuButton>

          <MenuButton
            id="whats-new-btn-got-it"
            variant="primary"
            size="sm"
            soundType="confirm"
            onClick={handleGotIt}
            icon={<Check className="h-3.5 w-3.5" />}
            className="flex-1 justify-center py-2 sm:py-2.5 text-xs font-bold min-h-[38px] sm:min-h-[42px] shadow-[0_0_20px_rgba(0,229,255,0.3)] whitespace-nowrap"
          >
            Got It
          </MenuButton>
        </div>
      </motion.div>
    </div>
  );
}
