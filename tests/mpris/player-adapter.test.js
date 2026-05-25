import { describe, expect, it } from 'vitest';

import { adaptPlayerSnapshot } from '../../src/domain/mpris/player-adapter.js';
import { PLAYER_PROFILES } from '../../src/domain/mpris/profile.js';

/**
 * @import { PlayerSnapshot } from '../../src/domain/mpris/types.js'
 */

describe('adaptPlayerSnapshot', () => {
  it('leaves Spotify Desktop snapshots unchanged', () => {
    const source = snapshot({
      busName: 'org.mpris.MediaPlayer2.spotify',
      title: 'Tewas Tertimbun Masa Lalu (TTM)',
      artist: 'NDX A.K.A',
      trackId: '/com/spotify/track/desktop',
    });

    expect(adaptPlayerSnapshot(source, PLAYER_PROFILES.spotifyDesktop)).toEqual({
      snapshot: source,
      adapterId: 'spotify-desktop',
    });
  });

  it('splits Spotify Web document-title style metadata when artist is missing', () => {
    expect(
      adaptPlayerSnapshot(
        snapshot({
          title: 'Tewas Tertimbun Masa Lalu (TTM) - NDX A.K.A',
          artist: '',
          album: '',
          trackId: '/com/spotify/track/browser',
        }),
        PLAYER_PROFILES.spotifyWeb,
      ),
    ).toEqual({
      snapshot: snapshot({
        title: 'Tewas Tertimbun Masa Lalu (TTM)',
        artist: 'NDX A.K.A',
        album: '',
        trackId: '/com/spotify/track/browser',
      }),
      adapterId: 'spotify-web',
    });
  });

  it('strips Spotify tab suffixes from browser titles', () => {
    expect(
      adaptPlayerSnapshot(
        snapshot({
          title: 'Nina - .Feast | Spotify',
          artist: '',
          album: '',
        }),
        PLAYER_PROFILES.chromiumBrowser,
      )?.snapshot,
    ).toEqual(
      snapshot({
        title: 'Nina',
        artist: '.Feast',
        album: '',
      }),
    );
  });

  it('does not split browser titles when artist metadata is already present', () => {
    const source = snapshot({
      title: 'Something Just Like This - Remixes',
      artist: 'The Chainsmokers, Coldplay',
    });

    expect(adaptPlayerSnapshot(source, PLAYER_PROFILES.chromiumBrowser)?.snapshot).toBe(source);
  });

  it('leaves null snapshots unchanged', () => {
    expect(adaptPlayerSnapshot(null, PLAYER_PROFILES.chromiumBrowser)).toBeNull();
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
