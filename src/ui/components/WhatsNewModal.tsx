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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 safe-p backdrop-blur-md animate-in fade-in duration-200"
    >
      <motion.div
        id="whats-new-modal"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative w-full max-w-lg rounded-3xl border border-neutral-800 bg-[#0F172A] p-4 sm:p-6 text-left shadow-2xl overflow-hidden my-auto pointer-events-auto"
      >
        {/* Subtle Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-[#00E5FF]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-[#00FF88]/15 blur-3xl" />

        {/* Close Icon in Top Corner */}
        <button
          id="whats-new-close-icon-btn"
          onClick={handleGotIt}
          className="absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700/60 bg-neutral-800/80 text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.2)] mb-2.5">
          <Sparkles className="h-3.5 w-3.5 text-[#00FF88]" />
          <span>{latestUpdate.playerFacingVersion} RELEASE BULLETIN</span>
        </div>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
          {latestUpdate.title}
        </h2>
        <p className="mt-1 text-xs text-neutral-300">
          {latestUpdate.summary}
        </p>

        {/* Feature Highlights Grid / List */}
        <div className="mt-3.5 sm:mt-4 space-y-2 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3 sm:p-4">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#00E5FF] flex items-center gap-1.5 mb-2">
            <Zap className="h-3.5 w-3.5" />
            <span>Key Highlights</span>
          </div>

          <div className="space-y-2">
            {latestUpdate.changes[0]?.items.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-neutral-200">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <span className="leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons: [ VIEW UPDATE ] and [ GOT IT ] */}
        <div className="mt-4 sm:mt-5 flex items-center gap-2.5 sm:gap-3">
          <MenuButton
            id="whats-new-btn-view-update"
            variant="secondary"
            size="md"
            soundType="click"
            onClick={handleViewDetails}
            icon={<Newspaper className="h-4 w-4 text-[#00E5FF]" />}
            iconRight={<ChevronRight className="h-4 w-4 opacity-70" />}
            className="flex-1 justify-center py-2 sm:py-2.5 text-xs font-bold"
          >
            View Update
          </MenuButton>

          <MenuButton
            id="whats-new-btn-got-it"
            variant="primary"
            size="md"
            soundType="confirm"
            onClick={handleGotIt}
            icon={<Check className="h-4 w-4" />}
            className="flex-1 justify-center py-2 sm:py-2.5 text-xs font-bold shadow-[0_0_20px_rgba(0,229,255,0.3)]"
          >
            Got It
          </MenuButton>
        </div>
      </motion.div>
    </div>
  );
}
