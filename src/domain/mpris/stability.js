/**
 * @import { PlayerSnapshot } from './types.js'
 * @import { PlayerProfilePolicy } from './profile-policy.js'
 *
 * @typedef {Readonly<{
 *   snapshot: PlayerSnapshot,
 *   firstSeenAtMs: number,
 *   kind: 'metadata' | 'advertisement',
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
    if (input.policy.advertisementRetentionMs > 0) {
      return reduceAdvertisementSnapshot({
        previousStable,
        pendingCandidate,
        candidate,
        policy: input.policy,
        nowMs: input.nowMs,
      });
    }

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
        kind: 'metadata',
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
        kind: 'metadata',
      },
      decision: 'held',
    };
  }

  const elapsedMs = input.nowMs - pendingCandidate.firstSeenAtMs;
  if (elapsedMs < input.policy.debounceMetadataMs) {
    return {
      stableSnapshot: previousStable,
      pendingCandidate: refreshPendingCandidateSnapshot(pendingCandidate, candidate),
      decision: 'held',
    };
  }

  return accept(candidate);
}

/**
 * @param {{
 *   previousStable: PlayerSnapshot | null,
 *   pendingCandidate: PendingStableCandidate | null,
 *   candidate: PlayerSnapshot,
 *   policy: PlayerProfilePolicy,
 *   nowMs: number,
 * }} input
 * @returns {StableSnapshotResult}
 */
function reduceAdvertisementSnapshot(input) {
  if (!input.policy.retainLastValidOnAdvertisement || input.previousStable === null) {
    return {
      stableSnapshot: null,
      pendingCandidate: null,
      decision: 'cleared',
    };
  }

  const pendingAdvertisement =
    input.pendingCandidate?.kind === 'advertisement' ? input.pendingCandidate : null;
  const pendingCandidate =
    pendingAdvertisement === null
      ? {
          snapshot: input.candidate,
          firstSeenAtMs: input.nowMs,
          kind: /** @type {'advertisement'} */ ('advertisement'),
        }
      : pendingAdvertisement;

  if (input.nowMs - pendingCandidate.firstSeenAtMs < input.policy.advertisementRetentionMs) {
    return {
      stableSnapshot: input.previousStable,
      pendingCandidate,
      decision: 'retained-previous',
    };
  }

  return {
    stableSnapshot: null,
    pendingCandidate: null,
    decision: 'cleared',
  };
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
 * The debounce window belongs to the track identity, not to every transient
 * property update. Keep the original first-seen timestamp while replacing the
 * snapshot so playback status and other same-track fields do not go stale.
 *
 * @param {PendingStableCandidate} pendingCandidate
 * @param {PlayerSnapshot} candidate
 * @returns {PendingStableCandidate}
 */
function refreshPendingCandidateSnapshot(pendingCandidate, candidate) {
  return {
    ...pendingCandidate,
    snapshot: candidate,
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
