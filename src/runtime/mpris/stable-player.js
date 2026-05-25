import { adaptPlayerSnapshot } from '../../domain/mpris/player-adapter.js';
import { detectPlayerProfile } from '../../domain/mpris/profile.js';
import { policyForPlayerProfile } from '../../domain/mpris/profile-policy.js';
import { reduceStablePlayerSnapshot } from '../../domain/mpris/stability.js';
import { snapshotsEqual } from './player-mapping.js';

/**
 * @import { LifecycleRegistry } from '../lifecycle.js'
 * @import { RuntimeLogger } from '../logger.js'
 * @import { PlayerSnapshot } from '../../domain/mpris/types.js'
 * @import { PendingStableCandidate } from '../../domain/mpris/stability.js'
 *
 * @typedef {(snapshot: PlayerSnapshot | null) => void} PlayerSnapshotCallback
 * @typedef {(positionMs: number | null) => void} PlayerPositionCallback
 *
 * @typedef {Readonly<{
 *   busName: string,
 *   snapshot(): PlayerSnapshot | null,
 *   onSnapshot(callback: PlayerSnapshotCallback): void,
 *   readPosition(callback: PlayerPositionCallback): void,
 *   start(): void,
 * }>} RawPlayerProxy
 *
 * @typedef {(callback: () => void, delayMs: number) => () => void} Scheduler
 */

export class StablePlayerProxy {
  /** @type {RawPlayerProxy} */
  #rawProxy;

  /** @type {LifecycleRegistry} */
  #lifecycle;

  /** @type {RuntimeLogger | null} */
  #logger;

  /** @type {() => number} */
  #now;

  /** @type {Scheduler} */
  #schedule;

  /** @type {PlayerSnapshot | null} */
  #stableSnapshot = null;

  /** @type {PendingStableCandidate | null} */
  #pendingCandidate = null;

  /** @type {(() => void) | null} */
  #cancelPendingTimer = null;

  /** @type {Set<PlayerSnapshotCallback>} */
  #listeners = new Set();

  /**
   * @param {RawPlayerProxy} rawProxy
   * @param {LifecycleRegistry} lifecycle
   * @param {{ logger?: RuntimeLogger | null, now?: () => number, schedule: Scheduler }} options
   */
  constructor(rawProxy, lifecycle, options) {
    this.#rawProxy = rawProxy;
    this.#lifecycle = lifecycle;
    this.#logger = options.logger ?? null;
    this.#now = options.now ?? (() => Date.now());
    this.#schedule = options.schedule;

    this.#lifecycle.add(() => {
      this.#cancelTimer();
      this.#listeners.clear();
      this.#stableSnapshot = null;
      this.#pendingCandidate = null;
    });
  }

  /**
   * @returns {string}
   */
  get busName() {
    return this.#rawProxy.busName;
  }

  /**
   * @returns {PlayerSnapshot | null}
   */
  snapshot() {
    return this.#stableSnapshot;
  }

  /**
   * @returns {void}
   */
  start() {
    this.#rawProxy.onSnapshot((snapshot) => {
      this.#applySnapshot(snapshot);
    });
    this.#rawProxy.start();
  }

  /**
   * @param {PlayerSnapshotCallback} callback
   * @returns {void}
   */
  onSnapshot(callback) {
    this.#listeners.add(callback);
    this.#lifecycle.add(() => {
      this.#listeners.delete(callback);
    });
    callback(this.#stableSnapshot);
  }

  /**
   * @param {PlayerPositionCallback} callback
   * @returns {void}
   */
  readPosition(callback) {
    this.#rawProxy.readPosition(callback);
  }

  /**
   * @param {PlayerSnapshot | null} candidate
   * @returns {void}
   */
  #applySnapshot(candidate) {
    const baseProfile = detectPlayerProfile(candidate ?? { busName: this.busName });
    const adapted = adaptPlayerSnapshot(candidate, baseProfile);
    const stableCandidate = adapted?.snapshot ?? null;
    const profile = detectPlayerProfile(stableCandidate ?? candidate ?? { busName: this.busName });
    const policy = policyForPlayerProfile(profile);
    const previous = this.#stableSnapshot;
    const result = reduceStablePlayerSnapshot({
      previousStable: this.#stableSnapshot,
      pendingCandidate: this.#pendingCandidate,
      candidate: stableCandidate,
      policy,
      nowMs: this.#now(),
    });

    this.#stableSnapshot = result.stableSnapshot;
    this.#pendingCandidate = result.pendingCandidate;
    this.#logger?.debug('stable-snapshot-decision', {
      busName: this.busName,
      adapter: adapted?.adapterId ?? null,
      decision: result.decision,
      profile: profile.id,
      title: stableCandidate?.title ?? candidate?.title ?? null,
    });

    this.#updatePendingTimer(policy.debounceMetadataMs);
    if (!snapshotsEqual(previous, this.#stableSnapshot)) {
      this.#emit();
    }
  }

  /**
   * @param {number} debounceMetadataMs
   * @returns {void}
   */
  #updatePendingTimer(debounceMetadataMs) {
    this.#cancelTimer();
    if (this.#pendingCandidate === null || debounceMetadataMs <= 0) {
      return;
    }

    const remainingMs = Math.max(
      0,
      this.#pendingCandidate.firstSeenAtMs + debounceMetadataMs - this.#now(),
    );
    this.#cancelPendingTimer = this.#schedule(() => {
      const pending = this.#pendingCandidate;
      this.#cancelPendingTimer = null;
      if (pending === null) {
        return;
      }
      this.#applySnapshot(pending.snapshot);
    }, remainingMs);
  }

  /**
   * @returns {void}
   */
  #cancelTimer() {
    if (this.#cancelPendingTimer === null) {
      return;
    }
    this.#cancelPendingTimer();
    this.#cancelPendingTimer = null;
  }

  /**
   * @returns {void}
   */
  #emit() {
    for (const listener of this.#listeners) {
      listener(this.#stableSnapshot);
    }
  }
}
