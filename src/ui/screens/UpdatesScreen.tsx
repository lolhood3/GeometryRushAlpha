import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Newspaper,
  Sparkles,
  Calendar,
  Tag,
  CheckCircle2,
  CheckCheck,
  ChevronRight,
  ShieldCheck,
  Zap,
  Wrench,
} from 'lucide-react';
import { UpdateManager } from '../../game/updates/updateManager.ts';
import type { GameUpdate, UpdateCategory } from '../../game/updates/updateTypes.ts';
import { MenuBackground } from '../components/MenuBackground.tsx';
import { MenuButton } from '../components/MenuButton.tsx';
import { SoundUtility } from '../../engine/audio/SoundUtility.ts';

interface UpdatesScreenProps {
  onBack: () => void;
  initialSelectedUpdateId?: string;
}

export function UpdatesScreen({ onBack, initialSelectedUpdateId }: UpdatesScreenProps) {
  const updateManager = UpdateManager.getInstance();
  const allUpdates = updateManager.getAllUpdates();

  const [selectedUpdateId, setSelectedUpdateId] = useState<string>(
    initialSelectedUpdateId || allUpdates[0]?.id || ''
  );
  // Mobile landscape view mode: 'list' or 'details'
  const [mobileView, setMobileView] = useState<'list' | 'details'>(
    initialSelectedUpdateId ? 'details' : 'list'
  );
  const [, setForceUpdate] = useState(0);

  const selectedUpdate: GameUpdate | undefined =
    allUpdates.find((u) => u.id === selectedUpdateId) || allUpdates[0];

  // Mark selected update as viewed immediately
  useEffect(() => {
    if (selectedUpdate && !updateManager.isUpdateViewed(selectedUpdate.id)) {
      updateManager.markUpdateAsViewed(selectedUpdate.id);
      setForceUpdate((n) => n + 1);
    }
  }, [selectedUpdate, updateManager]);

  const handleSelectUpdate = (update: GameUpdate) => {
    SoundUtility.click();
    updateManager.markUpdateAsViewed(update.id);
    setSelectedUpdateId(update.id);
    setMobileView('details');
    setForceUpdate((n) => n + 1);
  };

  const handleMarkAllRead = () => {
    SoundUtility.confirm();
    updateManager.markAllAsViewed();
    setForceUpdate((n) => n + 1);
  };

  const handleBackNavigation = () => {
    if (mobileView === 'details' && !initialSelectedUpdateId) {
      setMobileView('list');
    } else {
      onBack();
    }
  };

  const getCategoryBadge = (category: UpdateCategory) => {
    switch (category) {
      case 'Major Update':
        return 'bg-[#BF5AF2]/15 text-[#BF5AF2] border-[#BF5AF2]/30';
      case 'Improvement':
        return 'bg-[#00E5FF]/15 text-[#00E5FF] border-[#00E5FF]/30';
      case 'Hotfix':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'Event':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'Minor Update':
      default:
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
    }
  };

  const getSectionIcon = (title: string) => {
    const upper = title.toUpperCase();
    if (upper.includes("WHAT'S NEW") || upper.includes('NEW')) {
      return <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#00FF88]" />;
    }
    if (upper.includes('FIX')) {
      return <Wrench className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" />;
    }
    if (upper.includes('IMPROVEMENT')) {
      return <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#00E5FF]" />;
    }
    return <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />;
  };

  const unreadCount = updateManager.getUnreadCount();

  return (
    <div
      id="updates-screen"
      className="relative flex h-full w-full flex-col overflow-hidden bg-[#0A0E17] safe-p text-white select-none"
    >
      {/* Live Animated Cyber Background */}
      <MenuBackground accentColor="#00E5FF" secondaryColor="#00FF88" />

      {/* Top Navigation Bar: Non-shrinking, strictly constrained */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between border-b border-neutral-800/80 pb-2 sm:pb-3 shrink-0"
      >
        <MenuButton
          id="updates-back-btn"
          variant="secondary"
          size="sm"
          soundType="back"
          onClick={handleBackNavigation}
          icon={<ArrowLeft className="h-4 w-4" />}
          className="min-h-[38px] px-3 py-1.5 whitespace-nowrap"
        >
          {mobileView === 'details' && !initialSelectedUpdateId ? 'Updates List' : 'Return'}
        </MenuButton>

        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 mx-2">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 shadow-[0_0_20px_rgba(0,229,255,0.2)] shrink-0">
            <Newspaper className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-black tracking-wider uppercase text-white leading-tight truncate">
              {mobileView === 'details' ? selectedUpdate?.playerFacingVersion || 'Update Details' : 'Updates & News'}
            </h1>
            <p className="text-[10px] sm:text-[11px] font-mono text-neutral-400 hidden xs:block truncate">
              Release Notes & System Bulletins
            </p>
          </div>
        </div>

        {/* Top Right Action: Mark All Read or Unread Indicator */}
        <div className="shrink-0">
          {unreadCount > 0 ? (
            <button
              id="updates-mark-all-read-btn"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 rounded-xl border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-2.5 py-1.5 text-[11px] font-bold text-[#00E5FF] hover:bg-[#00E5FF]/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mark All Read</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-500 whitespace-nowrap">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Up to Date</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Main Content Area: Responsive across compact landscape, tablet, and desktop */}
      <div className="relative z-10 mx-auto mt-2 sm:mt-3 flex w-full max-w-6xl flex-1 min-h-0 gap-3 md:gap-4 overflow-hidden pb-1 sm:pb-2">
        {/* LEFT COLUMN: Update Cards Timeline
            - On desktop/tablet (>= md): always visible side-by-side
            - On mobile phone landscape (< md): visible when mobileView === 'list'
        */}
        <div
          className={`${
            mobileView === 'list' ? 'flex' : 'hidden md:flex'
          } w-full md:w-80 lg:w-96 flex-col shrink-0 rounded-2xl border border-neutral-800/90 bg-neutral-900/80 p-2.5 sm:p-3.5 backdrop-blur-md overflow-y-auto custom-scrollbar shadow-lg`}
        >
          <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2 px-1 flex items-center justify-between shrink-0">
            <span>Version History</span>
            <span>{allUpdates.length} Releases</span>
          </div>

          <div className="flex flex-col gap-2">
            {allUpdates.map((update) => {
              const isSelected = selectedUpdate?.id === update.id;
              const isUnread = !updateManager.isUpdateViewed(update.id);

              return (
                <button
                  key={update.id}
                  id={`update-item-${update.id}`}
                  onClick={() => handleSelectUpdate(update)}
                  className={`group relative flex flex-col text-left rounded-xl p-2.5 sm:p-3 transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#00E5FF]/15 border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.2)]'
                      : 'bg-neutral-950/60 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs sm:text-sm font-black text-white">
                        {update.playerFacingVersion}
                      </span>
                      {isUnread && (
                        <span className="rounded-full bg-[#00FF88] px-1.5 py-0.2 text-[9px] font-black uppercase text-neutral-950 shadow-[0_0_8px_#00FF88]">
                          NEW
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                      {update.date}
                    </span>
                  </div>

                  <div className="text-xs sm:text-sm font-bold text-neutral-100 mt-1 truncate">
                    {update.title}
                  </div>

                  <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                    {update.summary}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-800/60 text-[10px]">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${getCategoryBadge(
                        update.category
                      )}`}
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {update.category}
                    </span>
                    <span className="inline-flex items-center gap-0.5 font-bold text-[#00E5FF] text-[10px] group-hover:translate-x-0.5 transition-transform">
                      <span>Details</span>
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Update Patch Notes & Changelogs
            - On desktop/tablet (>= md): always visible on the right
            - On mobile phone landscape (< md): visible when mobileView === 'details'
        */}
        <div
          className={`${
            mobileView === 'details' ? 'flex' : 'hidden md:flex'
          } flex-1 min-h-0 min-w-0 flex-col rounded-2xl sm:rounded-3xl border border-neutral-800/90 bg-neutral-900/80 p-3 sm:p-5 md:p-6 backdrop-blur-md overflow-y-auto custom-scrollbar shadow-2xl`}
        >
          <AnimatePresence mode="wait">
            {selectedUpdate ? (
              <motion.div
                key={selectedUpdate.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-3 sm:space-y-5"
              >
                {/* Header Banner */}
                <div className="border-b border-neutral-800 pb-3 sm:pb-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs sm:text-sm font-black text-[#00E5FF] tracking-wider">
                      {selectedUpdate.playerFacingVersion}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${getCategoryBadge(
                        selectedUpdate.category
                      )}`}
                    >
                      <Tag className="h-3 w-3" />
                      {selectedUpdate.category}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 ml-auto">
                      <Calendar className="h-3 w-3 text-neutral-400" />
                      {selectedUpdate.date}
                    </span>
                  </div>

                  <h2 className="text-base sm:text-xl md:text-2xl font-black uppercase tracking-wider text-white">
                    {selectedUpdate.title}
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    {selectedUpdate.summary}
                  </p>
                </div>

                {/* Structured Change Sections (WHAT'S NEW, IMPROVEMENTS, FIXES) */}
                <div className="space-y-3 sm:space-y-4">
                  {selectedUpdate.changes.map((section, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl sm:rounded-2xl border border-neutral-800/90 bg-neutral-950/60 p-3 sm:p-4 shadow-inner"
                    >
                      <div className="flex items-center gap-2 mb-2 sm:mb-2.5">
                        {getSectionIcon(section.title)}
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-white">
                          {section.title}
                        </h3>
                      </div>

                      <ul className="space-y-1.5 sm:space-y-2">
                        {section.items.map((item, itemIdx) => (
                          <li
                            key={itemIdx}
                            className="flex items-start gap-2 text-xs sm:text-sm text-neutral-300 leading-relaxed"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#00E5FF] shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Mobile Landscape Back to List Shortcut */}
                {mobileView === 'details' && !initialSelectedUpdateId && (
                  <div className="pt-2 md:hidden">
                    <button
                      onClick={() => setMobileView('list')}
                      className="w-full py-2 rounded-xl border border-neutral-800 bg-neutral-800/60 text-xs font-bold text-neutral-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back to All Updates</span>
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-neutral-400 py-8">
                <Newspaper className="h-10 w-10 text-neutral-600 mb-2" />
                <p className="text-sm font-mono">Select an update to view details</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
