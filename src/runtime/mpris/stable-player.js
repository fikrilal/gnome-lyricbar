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
 * @import { BrowserPlayerService } from '../../domain/settings/types.js'
 *
 * @typedef {(snapshot: PlayerSnapshot | null) => void} PlayerSnapshotCallback
 * @typedef {(positionMs: number | null) => void} PlayerPositionCallback
 *
 * @typedef {Readonly<{
 *   busName: string,
 *   snapshot(): PlayerSnapshot | null,
 *   onSnapshot(callback: PlayerSnapshotCallback): void,
 *   readPosition(callback: PlayerPositionCallback): void,
 *   refreshProperties(): void,
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

  /** @type {() => BrowserPlayerService} */
  #getBrowserPlayerService;

  /** @type {PlayerSnapshot | null} */
  #stableSnapshot = null;

  /** @type {PendingStableCandidate | null} */
  #pendingCandidate = null;

  /** @type {(() => void) | null} */
  #cancelPendingTimer = null;

  /** @type {boolean} */
  #positionReadsSuppressed = false;

  /** @type {Set<PlayerSnapshotCallback>} */
  #listeners = new Set();

  /**
   * @param {RawPlayerProxy} rawProxy
   * @param {LifecycleRegistry} lifecycle
   * @param {{
   *   logger?: RuntimeLogger | null,
   *   now?: () => number,
   *   schedule: Scheduler,
   *   getBrowserPlayerService?: () => BrowserPlayerService,
   * }} options
   */
  constructor(rawProxy, lifecycle, options) {
    this.#rawProxy = rawProxy;
    this.#lifecycle = lifecycle;
    this.#logger = options.logger ?? null;
    this.#now = options.now ?? (() => Date.now());
    this.#schedule = options.schedule;
    this.#getBrowserPlayerService = options.getBrowserPlayerService ?? (() => 'auto');

    this.#lifecycle.add(() => {
      this.#cancelTimer();
      this.#listeners.clear();
      this.#stableSnapshot = null;
      this.#pendingCandidate = null;
      this.#positionReadsSuppressed = false;
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
    if (this.#positionReadsSuppressed) {
      callback(null);
      return;
    }

    this.#rawProxy.readPosition(callback);
  }

  /**
   * @returns {void}
   */
  refreshProperties() {
    this.#rawProxy.refreshProperties();
  }

  /**
   * @param {PlayerSnapshot | null} candidate
   * @returns {void}
   */
  #applySnapshot(candidate) {
    const profileOptions = { browserPlayerService: this.#getBrowserPlayerService() };
    const baseProfile = detectPlayerProfile(candidate ?? { busName: this.busName }, profileOptions);
    const adapted = adaptPlayerSnapshot(candidate, baseProfile);
    const stableCandidate = adapted?.snapshot ?? null;
    const profile = detectPlayerProfile(
      stableCandidate ?? candidate ?? { busName: this.busName },
      profileOptions,
    );
    const policy = policyForPlayerProfile(profile);
    const previous = this.#stableSnapshot;
    const positionReadsWereSuppressed = this.#positionReadsSuppressed;
    const result = reduceStablePlayerSnapshot({
      previousStable: this.#stableSnapshot,
      pendingCandidate: this.#pendingCandidate,
      candidate: stableCandidate,
      policy,
      nowMs: this.#now(),
    });

    this.#stableSnapshot = result.stableSnapshot;
    this.#pendingCandidate = result.pendingCandidate;
    this.#positionReadsSuppressed = shouldSuppressPositionReads(
      positionReadsWereSuppressed,
      result.stableSnapshot,
      result.pendingCandidate,
    );
    this.#logger?.debug('stable-snapshot-decision', {
      busName: this.busName,
      adapter: adapted?.adapterId ?? null,
      decision: result.decision,
      playbackStatus: stableCandidate?.playbackStatus ?? candidate?.playbackStatus ?? null,
      profile: profile.id,
      title: stableCandidate?.title ?? candidate?.title ?? null,
    });

    this.#updatePendingTimer({
      advertisementRetentionMs: policy.advertisementRetentionMs,
      debounceMetadataMs: policy.debounceMetadataMs,
      stoppedEmptyRetentionMs: policy.stoppedEmptyRetentionMs,
    });
    if (!snapshotsEqual(previous, this.#stableSnapshot)) {
      this.#emit();
    }
  }

  /**
   * @param {{
   *   advertisementRetentionMs: number,
   *   debounceMetadataMs: number,
   *   stoppedEmptyRetentionMs: number,
   * }} policy
   * @returns {void}
   */
  #updatePendingTimer(policy) {
    this.#cancelTimer();
    if (this.#pendingCandidate === null) {
      return;
    }

    const delayMs = pendingDelayMs(this.#pendingCandidate.kind, policy);
    if (delayMs <= 0) {
      return;
    }

    const remainingMs = Math.max(0, this.#pendingCandidate.firstSeenAtMs + delayMs - this.#now());
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

/**
 * Keep position reads paused until a browser transition either accepts the
 * recovered track or clears the stale player. This prevents the old lyrics
 * from being driven by the new track's zero-based position during debounce.
 *
 * @param {boolean} previouslySuppressed
 * @param {PlayerSnapshot | null} stableSnapshot
 * @param {PendingStableCandidate | null} pendingCandidate
 * @returns {boolean}
 */
function shouldSuppressPositionReads(previouslySuppressed, stableSnapshot, pendingCandidate) {
  if (pendingCandidate?.kind === 'stopped-empty') {
    return true;
  }

  if (
    pendingCandidate?.kind === 'metadata' &&
    stableSnapshot !== null &&
    !sameMetadataTrack(stableSnapshot, pendingCandidate.snapshot)
  ) {
    return true;
  }

  return previouslySuppressed && pendingCandidate !== null;
}

/**
 * Browser track IDs are implementation details and can be reused across songs.
 * Suppression only needs to know whether pending metadata describes the same
 * displayed track, so use user-visible music identity fields.
 *
 * @param {PlayerSnapshot} left
 * @param {PlayerSnapshot} right
 * @returns {boolean}
 */
function sameMetadataTrack(left, right) {
  return (
    left.title === right.title &&
    left.artist === right.artist &&
    left.album === right.album &&
    left.durationMs === right.durationMs
  );
}

/**
 * @param {PendingStableCandidate['kind']} kind
 * @param {{
 *   advertisementRetentionMs: number,
 *   debounceMetadataMs: number,
 *   stoppedEmptyRetentionMs: number,
 * }} policy
 * @returns {number}
 */
function pendingDelayMs(kind, policy) {
  if (kind === 'advertisement') {
    return policy.advertisementRetentionMs;
  }

  if (kind === 'stopped-empty') {
    return policy.stoppedEmptyRetentionMs;
  }

  return policy.debounceMetadataMs;
}
