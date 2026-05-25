/**
 * @import { PlayerSnapshot } from './types.js'
 * @import { PlayerProfilePolicy } from './profile-policy.js'
 *
 * @typedef {Readonly<{
 *   snapshot: PlayerSnapshot,
 *   firstSeenAtMs: number,
 * }>} PendingStableCandidate
 *
 * @typedef {Readonly<{
 *   previousStable: PlayerSnapshot | null,
 *   pendingCandidate: PendingStableCandidate | null,
 *   candidate: PlayerSnapshot | null,
 *   policy: PlayerProfilePolicy,
 *   nowMs: number,
 * }>} StableSnapshotInput
 *
 * @typedef {Readonly<{
 *   stableSnapshot: PlayerSnapshot | null,
 *   pendingCandidate: PendingStableCandidate | null,
 *   decision:
 *     | 'accepted'
 *     | 'held'
 *     | 'ignored'
 *     | 'retained-previous'
 *     | 'cleared',
 * }>} StableSnapshotResult
 */

/**
 * Reduces noisy MPRIS snapshots into a stable player snapshot. Browser players
 * can emit empty, advertisement, and partial metadata while real metadata is
 * settling; this reducer makes those decisions explicit and testable.
 *
 * @param {StableSnapshotInput} input
 * @returns {StableSnapshotResult}
 */
export function reduceStablePlayerSnapshot(input) {
  const previousStable = input.previousStable ?? null;
  const pendingCandidate = input.pendingCandidate ?? null;
  const candidate = input.candidate ?? null;

  if (candidate === null) {
    return {
      stableSnapshot: previousStable,
      pendingCandidate: null,
      decision: previousStable === null ? 'cleared' : 'retained-previous',
    };
  }

  if (isEmptySnapshot(candidate)) {
    if (previousStable !== null && input.policy.retainLastValidOnEmpty) {
      return {
        stableSnapshot: previousStable,
        pendingCandidate: null,
        decision: 'retained-previous',
      };
    }

    return {
      stableSnapshot: null,
      pendingCandidate: null,
      decision: 'cleared',
    };
  }

  if (isAdvertisementSnapshot(candidate)) {
    if (previousStable !== null && input.policy.retainLastValidOnAdvertisement) {
      return {
        stableSnapshot: previousStable,
        pendingCandidate: null,
        decision: 'retained-previous',
      };
    }

    return accept(candidate);
  }

  if (input.policy.requireArtistForLookup && candidate.artist === '') {
    return {
      stableSnapshot: previousStable,
      pendingCandidate: {
        snapshot: candidate,
        firstSeenAtMs: input.nowMs,
      },
      decision: 'held',
    };
  }

  if (input.policy.debounceMetadataMs <= 0) {
    return accept(candidate);
  }

  if (pendingCandidate === null || !sameTrackCandidate(pendingCandidate.snapshot, candidate)) {
    return {
      stableSnapshot: previousStable,
      pendingCandidate: {
        snapshot: candidate,
        firstSeenAtMs: input.nowMs,
      },
      decision: 'held',
    };
  }

  const elapsedMs = input.nowMs - pendingCandidate.firstSeenAtMs;
  if (elapsedMs < input.policy.debounceMetadataMs) {
    return {
      stableSnapshot: previousStable,
      pendingCandidate,
      decision: 'held',
    };
  }

  return accept(candidate);
}

/**
 * @param {PlayerSnapshot} snapshot
 * @returns {StableSnapshotResult}
 */
function accept(snapshot) {
  return {
    stableSnapshot: snapshot,
    pendingCandidate: null,
    decision: 'accepted',
  };
}

/**
 * @param {PlayerSnapshot} snapshot
 * @returns {boolean}
 */
function isEmptySnapshot(snapshot) {
  return snapshot.title === '' && snapshot.artist === '' && snapshot.album === '';
}

/**
 * @param {PlayerSnapshot} snapshot
 * @returns {boolean}
 */
function isAdvertisementSnapshot(snapshot) {
  return normalizeText(snapshot.title) === 'advertisement';
}

/**
 * @param {PlayerSnapshot | null} left
 * @param {PlayerSnapshot | null} right
 * @returns {boolean}
 */
function sameTrackCandidate(left, right) {
  if (left === null || right === null) {
    return false;
  }

  return (
    left.busName === right.busName &&
    left.title === right.title &&
    left.artist === right.artist &&
    left.album === right.album &&
    left.durationMs === right.durationMs &&
    left.trackId === right.trackId
  );
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeText(value) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}
