/**
 * Simple in-memory circuit breaker for fetcher health.
 *
 * Tracks consecutive failures per source. When the failure count exceeds
 * `failureThreshold`, the circuit opens — subsequent calls fail fast with
 * `manual_required` instead of calling the remote service. After
 * `cooldownMs`, the circuit enters "half-open" state, allowing one probe
 * call through. If that succeeds, the circuit closes; if it fails,
 * the circuit opens again.
 *
 * State transitions:
 *   CLOSED (normal) → OPEN (consecutive failures >= threshold)
 *   OPEN → HALF_OPEN (cooldown elapsed)
 *   HALF_OPEN → CLOSED (probe succeeds) | OPEN (probe fails)
 *
 * Usage:
 *   const cb = createCircuitBreaker("nominatim", { failureThreshold: 5, cooldownMs: 60_000 });
 *   if (!cb.canExecute()) return makeManualResult("circuit_open");
 *   try { const r = await fetcher(); cb.recordSuccess(); } catch { cb.recordFailure(); }
 */

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening. Default: 5. */
  failureThreshold?: number;
  /** Milliseconds to wait before allowing a probe call. Default: 60_000 (1 min). */
  cooldownMs?: number;
}

export interface CircuitBreaker {
  name: string;
  /** Returns true if the circuit allows execution (CLOSED or HALF_OPEN). */
  canExecute(): boolean;
  /** Record a successful call — resets failure count. */
  recordSuccess(): void;
  /** Record a failed call — increments failure count; opens circuit if threshold reached. */
  recordFailure(): void;
  /** Returns the current circuit state for monitoring. */
  getState(): CircuitBreakerState;
  /** Reset to initial CLOSED state. */
  reset(): void;
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerState {
  state: CircuitState;
  consecutiveFailures: number;
  failureThreshold: number;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  cooldownMs: number;
  nextProbeAt: string | null;
}

const NOOP_LOGGER = {
  info: (..._args: unknown[]) => {},
  warn: (..._args: unknown[]) => {},
  error: (..._args: unknown[]) => {},
};

type Logger = typeof NOOP_LOGGER;

export function createCircuitBreaker(
  name: string,
  options: CircuitBreakerOptions = {},
  logger: Logger = NOOP_LOGGER
): CircuitBreaker {
  const failureThreshold = options.failureThreshold ?? 5;
  const cooldownMs = options.cooldownMs ?? 60_000;

  let state: CircuitState = "CLOSED";
  let consecutiveFailures = 0;
  let lastFailureAt: string | null = null;
  let lastSuccessAt: string | null = null;

  function reset() {
    state = "CLOSED";
    consecutiveFailures = 0;
    lastFailureAt = null;
    lastSuccessAt = null;
  }

  return {
    get name() { return name; },

    canExecute() {
      if (state === "CLOSED") return true;
      if (state === "OPEN") {
        if (lastFailureAt) {
          const elapsed = Date.now() - new Date(lastFailureAt).getTime();
          if (elapsed >= cooldownMs) {
            state = "HALF_OPEN";
            logger.warn(`[circuit-breaker:${name}] HALF_OPEN — cooldown elapsed, allowing probe`);
            return true;
          }
          return false;
        }
        return false;
      }
      // HALF_OPEN — allow exactly one probe call
      return true;
    },

    recordSuccess() {
      lastSuccessAt = new Date().toISOString();
      consecutiveFailures = 0;
      if (state !== "CLOSED") {
        logger.info(`[circuit-breaker:${name}] CLOSED — probe succeeded`);
      }
      state = "CLOSED";
    },

    recordFailure() {
      lastFailureAt = new Date().toISOString();
      consecutiveFailures += 1;
      if (consecutiveFailures >= failureThreshold) {
        state = "OPEN";
        const nextProbeAt = new Date(Date.now() + cooldownMs).toISOString();
        logger.error(`[circuit-breaker:${name}] OPEN — ${consecutiveFailures} consecutive failures, cooldown until ${nextProbeAt}`);
      }
    },

    getState(): CircuitBreakerState {
      const nextProbeAt = state === "OPEN" && lastFailureAt
        ? new Date(new Date(lastFailureAt).getTime() + cooldownMs).toISOString()
        : null;
      return { state, consecutiveFailures, failureThreshold, lastFailureAt, lastSuccessAt, cooldownMs, nextProbeAt };
    },

    reset() {
      reset();
      logger.info(`[circuit-breaker:${name}] reset to CLOSED`);
    },
  };
}

// ─── Shared circuit breaker registry ─────────────────────────────────────────
// Module-level registry so circuit breaker state persists across calls.
// Useful for monitoring and admin endpoints.

const registry = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  let cb = registry.get(name);
  if (!cb) {
    cb = createCircuitBreaker(name, options, {
      info: (msg, ...args) => console.info(msg, ...args),
      warn: (msg, ...args) => console.warn(msg, ...args),
      error: (msg, ...args) => console.error(msg, ...args),
    });
    registry.set(name, cb);
  }
  return cb;
}

export function getAllCircuitBreakerStates(): Record<string, CircuitBreakerState> {
  const result: Record<string, CircuitBreakerState> = {};
  for (const [name, cb] of registry) {
    result[name] = cb.getState();
  }
  return result;
}

export function resetAllCircuitBreakers(): void {
  for (const cb of registry.values()) {
    cb.reset();
  }
}