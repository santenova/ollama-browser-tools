/**
 * Structured Request/Response Logger (Improvement #4)
 * Middleware logger for tracking requests, responses, execution time, and errors.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  durationMs?: number;
}

const formatEntry = (entry: LogEntry): string =>
  `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${
    entry.durationMs != null ? ` (${entry.durationMs}ms)` : ''
  }${entry.context ? ` | ${JSON.stringify(entry.context)}` : ''}`;

export const clientLogger = {
  log(level: LogLevel, message: string, context?: Record<string, any>, durationMs?: number) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      durationMs,
    };
    const formatted = formatEntry(entry);
    if (level === 'error') console.error(formatted);
    else if (level === 'warn') console.warn(formatted);
    else console.log(formatted);
  },

  info: (msg: string, ctx?: Record<string, any>) => clientLogger.log('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, any>) => clientLogger.log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, any>) => clientLogger.log('error', msg, ctx),

  timed: async <T>(label: string, fn: () => Promise<T>, ctx?: Record<string, any>): Promise<T> => {
    const start = Date.now();
    try {
      const result = await fn();
      clientLogger.log('info', label, ctx, Date.now() - start);
      return result;
    } catch (err: any) {
      clientLogger.log('error', `${label} FAILED`, { ...ctx, error: err?.message }, Date.now() - start);
      throw err;
    }
  },
};