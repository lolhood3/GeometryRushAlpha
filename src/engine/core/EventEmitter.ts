type EventHandler<T = unknown> = (data: T) => void;

/**
 * Type-safe generic event emitter for decoupled communication between Rush Engine subsystems and UI.
 */
export class EventEmitter<TEvents extends Record<string, unknown> = Record<string, unknown>> {
  private readonly listeners: Map<keyof TEvents, Set<EventHandler<unknown>>> = new Map();

  /**
   * Subscribes a listener to a specific event.
   * Returns an unsubscribe function for convenient cleanup.
   */
  public on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler as EventHandler<unknown>);

    return () => this.off(event, handler);
  }

  /**
   * Subscribes a listener that will only fire once.
   */
  public once<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
    const wrappedHandler: EventHandler<TEvents[K]> = (data) => {
      this.off(event, wrappedHandler);
      handler(data);
    };
    return this.on(event, wrappedHandler);
  }

  /**
   * Unsubscribes a listener from an event.
   */
  public off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler<unknown>);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emits an event with optional payload data.
   */
  public emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      // Create a snapshot in case a listener unsubscribes during dispatch
      const handlersSnapshot = Array.from(handlers);
      for (const handler of handlersSnapshot) {
        try {
          handler(data);
        } catch (error) {
          console.error(`[Rush Engine] Error in event listener for "${String(event)}":`, error);
        }
      }
    }
  }

  /**
   * Clears all event listeners.
   */
  public removeAllListeners(): void {
    this.listeners.clear();
  }
}
