export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Structured logger for engine and game subsystems.
 */
export class Logger {
  public static level: LogLevel = LogLevel.INFO;

  public static debug(module: string, message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`%c[${module}]%c ${message}`, 'color: #3b82f6; font-weight: bold;', 'color: inherit;', ...args);
    }
  }

  public static info(module: string, message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`%c[${module}]%c ${message}`, 'color: #10b981; font-weight: bold;', 'color: inherit;', ...args);
    }
  }

  public static warn(module: string, message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`%c[${module}]%c ${message}`, 'color: #f59e0b; font-weight: bold;', 'color: inherit;', ...args);
    }
  }

  public static error(module: string, message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`%c[${module}]%c ${message}`, 'color: #ef4444; font-weight: bold;', 'color: inherit;', ...args);
    }
  }
}
