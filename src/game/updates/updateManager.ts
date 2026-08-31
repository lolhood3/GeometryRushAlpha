import { GAME_UPDATES } from './updateData.ts';
import type { GameUpdate } from './updateTypes.ts';

const STORAGE_KEY_SEEN_UPDATES = 'geometry_rush_seen_updates_v1';
const STORAGE_KEY_LAST_ACK_WHATS_NEW = 'geometry_rush_last_ack_whats_new_v1';

/**
 * UpdateManager coordinates game update data, unread tracking,
 * and What's New release bulletin lifecycle.
 */
export class UpdateManager {
  private static instance: UpdateManager;

  private seenUpdateIds: Set<string> = new Set();
  private lastAcknowledgedWhatsNewId: string | null = null;
  private memoryFallback: boolean = false;

  private constructor() {
    this.loadState();
  }

  public static getInstance(): UpdateManager {
    if (!UpdateManager.instance) {
      UpdateManager.instance = new UpdateManager();
    }
    return UpdateManager.instance;
  }

  private loadState(): void {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        this.memoryFallback = true;
        return;
      }

      const seenRaw = localStorage.getItem(STORAGE_KEY_SEEN_UPDATES);
      if (seenRaw) {
        const parsed = JSON.parse(seenRaw);
        if (Array.isArray(parsed)) {
          this.seenUpdateIds = new Set(parsed);
        }
      }

      const lastAck = localStorage.getItem(STORAGE_KEY_LAST_ACK_WHATS_NEW);
      if (lastAck) {
        this.lastAcknowledgedWhatsNewId = lastAck;
      }
    } catch {
      this.memoryFallback = true;
    }
  }

  private saveState(): void {
    if (this.memoryFallback) return;

    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(
          STORAGE_KEY_SEEN_UPDATES,
          JSON.stringify(Array.from(this.seenUpdateIds))
        );
        if (this.lastAcknowledgedWhatsNewId) {
          localStorage.setItem(
            STORAGE_KEY_LAST_ACK_WHATS_NEW,
            this.lastAcknowledgedWhatsNewId
          );
        }
      }
    } catch {
      // Gracefully handle storage quota or privacy mode errors
    }
  }

  /**
   * Returns all updates, ordered newest first.
   */
  public getAllUpdates(): GameUpdate[] {
    return [...GAME_UPDATES];
  }

  /**
   * Returns the single newest update.
   */
  public getLatestUpdate(): GameUpdate {
    return GAME_UPDATES[0];
  }

  /**
   * Returns an update by its unique ID.
   */
  public getUpdateById(id: string): GameUpdate | undefined {
    return GAME_UPDATES.find((u) => u.id === id);
  }

  /**
   * Returns true if the player has already viewed the specified update.
   */
  public isUpdateViewed(updateId: string): boolean {
    return this.seenUpdateIds.has(updateId);
  }

  /**
   * Returns a list of all unread / unseen updates.
   */
  public getUnreadUpdates(): GameUpdate[] {
    return GAME_UPDATES.filter((u) => !this.seenUpdateIds.has(u.id));
  }

  /**
   * Returns true if there is at least one unseen update.
   */
  public hasUnreadUpdates(): boolean {
    return this.getUnreadUpdates().length > 0;
  }

  /**
   * Returns count of unseen updates.
   */
  public getUnreadCount(): number {
    return this.getUnreadUpdates().length;
  }

  /**
   * Marks a specific update as read / viewed by the player.
   */
  public markUpdateAsViewed(updateId: string): void {
    if (!this.seenUpdateIds.has(updateId)) {
      this.seenUpdateIds.add(updateId);
      this.saveState();
    }
  }

  /**
   * Marks all current updates as read / viewed.
   */
  public markAllAsViewed(): void {
    let changed = false;
    for (const update of GAME_UPDATES) {
      if (!this.seenUpdateIds.has(update.id)) {
        this.seenUpdateIds.add(update.id);
        changed = true;
      }
    }
    if (changed) {
      this.saveState();
    }
  }

  /**
   * Determines whether the "What's New" popup should be presented to the player.
   * It only appears if the latest update has not yet been acknowledged in the popup.
   */
  public shouldShowWhatsNew(): boolean {
    const latest = this.getLatestUpdate();
    if (!latest) return false;
    return this.lastAcknowledgedWhatsNewId !== latest.id;
  }

  /**
   * Acknowledges the "What's New" popup for the specified (or latest) update,
   * ensuring it never appears again for this update version.
   */
  public acknowledgeWhatsNew(updateId?: string): void {
    const targetId = updateId || this.getLatestUpdate()?.id;
    if (targetId) {
      this.lastAcknowledgedWhatsNewId = targetId;
      this.markUpdateAsViewed(targetId);
      this.saveState();
    }
  }
}
