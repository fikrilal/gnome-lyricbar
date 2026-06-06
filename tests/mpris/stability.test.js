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

  it('retains the previous browser track during a stopped empty transition', () => {
    const previousStable = snapshot({});
    const candidate = stoppedEmptySnapshot();

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
        kind: 'stopped-empty',
      },
      decision: 'retained-previous',
    });
  });

  it('clears the previous browser track when stopped empty metadata persists', () => {
    const previousStable = snapshot({});
    const candidate = stoppedEmptySnapshot();
    const pendingCandidate = {
      snapshot: candidate,
      firstSeenAtMs: 1000,
      kind: /** @type {'stopped-empty'} */ ('stopped-empty'),
    };

    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate,
        candidate,
        policy: browserPolicy,
        nowMs: 3999,
      }),
    ).toEqual({
      stableSnapshot: previousStable,
      pendingCandidate,
      decision: 'retained-previous',
    });

    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate,
        candidate,
        policy: browserPolicy,
        nowMs: 4000,
      }),
    ).toEqual({
      stableSnapshot: null,
      pendingCandidate: null,
      decision: 'cleared',
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

  it('retains the previous browser track during a short advertisement burst', () => {
    const previousStable = snapshot({});
    const candidate = snapshot({ title: ' Advertisement ', artist: '', album: '' });

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
        kind: 'advertisement',
      },
      decision: 'retained-previous',
    });
  });

  it('clears the previous browser track when advertisement metadata persists', () => {
    const previousStable = snapshot({});
    const candidate = snapshot({ title: 'Advertisement', artist: '', album: '' });

    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate: {
          snapshot: candidate,
          firstSeenAtMs: 1000,
          kind: 'advertisement',
        },
        candidate,
        policy: browserPolicy,
        nowMs: 3000,
      }),
    ).toEqual({
      stableSnapshot: null,
      pendingCandidate: null,
      decision: 'cleared',
    });
  });

  it('clears browser advertisement metadata when no previous stable track exists', () => {
    expect(
      reduceStablePlayerSnapshot({
        previousStable: null,
        pendingCandidate: null,
        candidate: snapshot({ title: 'Advertisement', artist: '', album: '' }),
        policy: browserPolicy,
        nowMs: 1000,
      }),
    ).toEqual({
      stableSnapshot: null,
      pendingCandidate: null,
      decision: 'cleared',
    });
  });

  it('keeps desktop advertisement behavior unchanged', () => {
    const candidate = snapshot({ title: 'Advertisement', artist: '', album: '' });

    expect(
      reduceStablePlayerSnapshot({
        previousStable: snapshot({}),
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
        kind: 'metadata',
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
        kind: 'metadata',
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

  it('keeps the debounce window but refreshes same-track playback status', () => {
    const previousStable = snapshot({ title: 'Older Song', artist: 'Older Artist' });
    const stoppedCandidate = snapshot({ playbackStatus: 'Stopped' });
    const playingCandidate = snapshot({ playbackStatus: 'Playing' });
    const pendingCandidate = {
      snapshot: stoppedCandidate,
      firstSeenAtMs: 1000,
      kind: /** @type {'metadata'} */ ('metadata'),
    };

    expect(
      reduceStablePlayerSnapshot({
        previousStable,
        pendingCandidate,
        candidate: playingCandidate,
        policy: browserPolicy,
        nowMs: 1200,
      }),
    ).toEqual({
      stableSnapshot: previousStable,
      pendingCandidate: {
        snapshot: playingCandidate,
        firstSeenAtMs: 1000,
        kind: 'metadata',
      },
      decision: 'held',
    });
  });

  it('accepts full browser metadata after the debounce window has elapsed', () => {
    const previousStable = snapshot({ title: 'Older Song', artist: 'Older Artist' });
    const candidate = snapshot({ title: 'Nina', artist: '.Feast' });
    const pendingCandidate = {
      snapshot: candidate,
      firstSeenAtMs: 1000,
      kind: /** @type {'metadata'} */ ('metadata'),
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
          kind: 'metadata',
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
        kind: 'metadata',
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
    url: null,
    playbackStatus: 'Playing',
    ...overrides,
  };
}

/** @returns {PlayerSnapshot} */
function stoppedEmptySnapshot() {
  return snapshot({
    title: '',
    artist: '',
    album: '',
    durationMs: 0,
    trackId: null,
    playbackStatus: 'Stopped',
  });
}
