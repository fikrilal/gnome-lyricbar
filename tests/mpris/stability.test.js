import { describe, expect, it } from 'vitest';

import { PLAYER_PROFILES } from '../../src/domain/mpris/profile.js';
import { policyForPlayerProfile } from '../../src/domain/mpris/profile-policy.js';
import { reduceStablePlayerSnapshot } from '../../src/domain/mpris/stability.js';

/**
 * @import { PlayerSnapshot } from '../../src/domain/mpris/types.js'
 */

const desktopPolicy = policyForPlayerProfile(PLAYER_PROFILES.spotifyDesktop);
const browserPolicy = policyForPlayerProfile(PLAYER_PROFILES.chromiumBrowser);

describe('reduceStablePlayerSnapshot', () => {
  it('accepts Spotify Desktop metadata immediately', () => {
    const candidate = snapshot({});

    expect(
      reduceStablePlayerSnapshot({
        previousStable: null,
        pendingCandidate: null,
        candidate,
        policy: desktopPolicy,
        nowMs: 1000,
      }),
    ).toEqual({
      stableSnapshot: candidate,
      pendingCandidate: null,
      decision: 'accepted',
    });
  });

  it('retains the previous browser track when Chromium emits empty metadata', () => {
    const previousStable = snapshot({});

    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate: null,
        candidate: snapshot({ title: '', artist: '', album: '' }),
        policy: browserPolicy,
        nowMs: 1000,
      }),
    ).toEqual({
      stableSnapshot: previousStable,
      pendingCandidate: null,
      decision: 'retained-previous',
    });
  });

  it('clears empty metadata for desktop profiles', () => {
    expect(
      reduceStablePlayerSnapshot({
        previousStable: snapshot({}),
        pendingCandidate: null,
        candidate: snapshot({ title: '', artist: '', album: '' }),
        policy: desktopPolicy,
        nowMs: 1000,
      }),
    ).toEqual({
      stableSnapshot: null,
      pendingCandidate: null,
      decision: 'cleared',
    });
  });

  it('retains the previous browser track when Chromium emits advertisement metadata', () => {
    const previousStable = snapshot({});

    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate: null,
        candidate: snapshot({ title: ' Advertisement ', artist: '', album: '' }),
        policy: browserPolicy,
        nowMs: 1000,
      }),
    ).toEqual({
      stableSnapshot: previousStable,
      pendingCandidate: null,
      decision: 'retained-previous',
    });
  });

  it('holds title-only browser metadata instead of accepting it', () => {
    const previousStable = snapshot({ title: 'Older Song', artist: 'Older Artist' });
    const candidate = snapshot({ title: 'Nina', artist: '', album: '' });

    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate: null,
        candidate,
        policy: browserPolicy,
        nowMs: 1000,
      }),
    ).toEqual({
      stableSnapshot: previousStable,
      pendingCandidate: {
        snapshot: candidate,
        firstSeenAtMs: 1000,
      },
      decision: 'held',
    });
  });

  it('holds full browser metadata until the debounce window has elapsed', () => {
    const previousStable = snapshot({ title: 'Older Song', artist: 'Older Artist' });
    const candidate = snapshot({ title: 'Nina', artist: '.Feast' });

    const first = reduceStablePlayerSnapshot({
      previousStable,
      pendingCandidate: null,
      candidate,
      policy: browserPolicy,
      nowMs: 1000,
    });

    expect(first).toEqual({
      stableSnapshot: previousStable,
      pendingCandidate: {
        snapshot: candidate,
        firstSeenAtMs: 1000,
      },
      decision: 'held',
    });

    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate: first.pendingCandidate,
        candidate,
        policy: browserPolicy,
        nowMs: 1200,
      }),
    ).toEqual({
      stableSnapshot: previousStable,
      pendingCandidate: first.pendingCandidate,
      decision: 'held',
    });
  });

  it('accepts full browser metadata after the debounce window has elapsed', () => {
    const previousStable = snapshot({ title: 'Older Song', artist: 'Older Artist' });
    const candidate = snapshot({ title: 'Nina', artist: '.Feast' });
    const pendingCandidate = {
      snapshot: candidate,
      firstSeenAtMs: 1000,
    };

    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate,
        candidate,
        policy: browserPolicy,
        nowMs: 1350,
      }),
    ).toEqual({
      stableSnapshot: candidate,
      pendingCandidate: null,
      decision: 'accepted',
    });
  });

  it('restarts the browser debounce window when the candidate track changes', () => {
    const previousStable = snapshot({ title: 'Older Song', artist: 'Older Artist' });
    const firstCandidate = snapshot({ title: 'Nina', artist: '.Feast' });
    const secondCandidate = snapshot({ title: 'Lampu Merah', artist: 'The Lantis' });

    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate: {
          snapshot: firstCandidate,
          firstSeenAtMs: 1000,
        },
        candidate: secondCandidate,
        policy: browserPolicy,
        nowMs: 1200,
      }),
    ).toEqual({
      stableSnapshot: previousStable,
      pendingCandidate: {
        snapshot: secondCandidate,
        firstSeenAtMs: 1200,
      },
      decision: 'held',
    });
  });

  it('retains the previous stable snapshot when the candidate is missing', () => {
    const previousStable = snapshot({});

    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate: null,
        candidate: null,
        policy: browserPolicy,
        nowMs: 1000,
      }),
    ).toEqual({
      stableSnapshot: previousStable,
      pendingCandidate: null,
      decision: 'retained-previous',
    });
  });
});

/**
 * @param {Partial<PlayerSnapshot>} overrides
 * @returns {PlayerSnapshot}
 */
function snapshot(overrides) {
  return {
    busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
    title: 'Nina',
    artist: '.Feast',
    album: 'Membangun & Menghancurkan',
    durationMs: 277991,
    trackId: '/org/chromium/MediaPlayer2/TrackList/Nina',
    playbackStatus: 'Playing',
    ...overrides,
  };
}
