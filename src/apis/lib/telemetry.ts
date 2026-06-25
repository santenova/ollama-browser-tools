/**
 * Performance Telemetry Event Emitter (Improvement #10)
 * Allows React components to subscribe to client lifecycle events.
 */

type TelemetryEvent =
  | 'client:request-start'
  | 'client:request-end'
  | 'client:fallback-triggered'
  | 'client:circuit-open'
  | 'client:circuit-closed'
  | 'client:model-routed'
  | 'client:error';

type TelemetryHandler = (payload: Record<string, any>) => void;

const listeners = new Map<TelemetryEvent, Set<TelemetryHandler>>();

export const telemetry = {
  on(event: TelemetryEvent, handler: TelemetryHandler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);
    return () => listeners.get(event)?.delete(handler); // returns unsubscribe fn
  },

  emit(event: TelemetryEvent, payload: Record<string, any> = {}) {
    listeners.get(event)?.forEach(h => {
      try { h({ event, timestamp: Date.now(), ...payload }); } catch {}
    });
  },
};