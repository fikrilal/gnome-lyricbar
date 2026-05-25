import { describe, expect, it } from 'vitest';

import { detectPlayerProfile, PLAYER_PROFILES } from '../../src/domain/mpris/profile.js';

describe('detectPlayerProfile', () => {
  it('detects Spotify Desktop from the exact Spotify MPRIS bus name', () => {
    expect(
      detectPlayerProfile({
        busName: 'org.mpris.MediaPlayer2.spotify',
        title: 'Nina',
        artist: '.Feast',
        album: 'Membangun & Menghancurkan',
      }),
    ).toBe(PLAYER_PROFILES.spotifyDesktop);
  });

  it('detects Chromium browser MPRIS players', () => {
    expect(
      detectPlayerProfile({
        busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
        title: 'Nina',
        artist: '.Feast',
      }),
    ).toBe(PLAYER_PROFILES.chromiumBrowser);
  });

  it('detects Spotify Web when browser metadata includes a Spotify track identifier', () => {
    expect(
      detectPlayerProfile({
        busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
        title: 'Nina',
        artist: '.Feast',
        trackId: '/com/spotify/track/1',
      }),
    ).toBe(PLAYER_PROFILES.spotifyWeb);
  });

  it('detects Firefox browser MPRIS players', () => {
    expect(
      detectPlayerProfile({
        busName: 'org.mpris.MediaPlayer2.firefox.instance1',
        title: 'Nina',
        artist: '.Feast',
      }),
    ).toBe(PLAYER_PROFILES.firefoxBrowser);
  });

  it('uses the generic profile for unknown MPRIS players', () => {
    expect(
      detectPlayerProfile({
        busName: 'org.mpris.MediaPlayer2.vlc',
        title: 'Nina',
        artist: '.Feast',
      }),
    ).toBe(PLAYER_PROFILES.genericMpris);
  });

  it('uses the generic profile for invalid or missing bus names', () => {
    expect(detectPlayerProfile(null)).toBe(PLAYER_PROFILES.genericMpris);
    expect(detectPlayerProfile({})).toBe(PLAYER_PROFILES.genericMpris);
    expect(detectPlayerProfile({ busName: 42 })).toBe(PLAYER_PROFILES.genericMpris);
    expect(detectPlayerProfile({ busName: 'org.example.NotMpris' })).toBe(
      PLAYER_PROFILES.genericMpris,
    );
    expect(detectPlayerProfile({ busName: 'org.mpris.MediaPlayer2.' })).toBe(
      PLAYER_PROFILES.genericMpris,
    );
  });
});
