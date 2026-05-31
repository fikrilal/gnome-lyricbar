import { describe, expect, it } from 'vitest';

import {
  detectPlayerProfile,
  PLAYER_PROFILES,
  selectBrowserServiceProfile,
} from '../../src/domain/mpris/profile.js';

describe('detectPlayerProfile', () => {
  it('defines Apple Music Web as a browser profile without auto-detecting it', () => {
    expect(PLAYER_PROFILES.appleMusicWeb).toEqual({
      id: 'apple-music-web',
      sourceKind: 'browser',
    });
  });

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

  it('detects Spotify Web in auto mode when browser metadata includes a Spotify track identifier', () => {
    expect(
      detectPlayerProfile({
        busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
        title: 'Nina',
        artist: '.Feast',
        trackId: '/com/spotify/track/1',
      }),
    ).toBe(PLAYER_PROFILES.spotifyWeb);
  });

  it('detects YouTube Music Web in auto mode from Firefox media urls', () => {
    expect(
      detectPlayerProfile({
        busName: 'org.mpris.MediaPlayer2.firefox.instance_1_121',
        title: 'Hall of Fame',
        artist: 'The Script',
        album: 'Hall of Fame',
        durationMs: 202000,
        trackId: '/org/mpris/MediaPlayer2/firefox',
        url: 'https://music.youtube.com/watch?v=snx5qGUtVi8&list=RDAMVMBLZWkjBXfN8',
        playbackStatus: 'Playing',
      }),
    ).toBe(PLAYER_PROFILES.youtubeMusicWeb);
  });

  it('detects YouTube Music Web from Firefox search urls without relying on WHATWG URL', () => {
    expect(
      detectPlayerProfile(
        {
          busName: 'org.mpris.MediaPlayer2.firefox.instance_1_104',
          title: 'Believe Me',
          artist: 'Fort Minor',
          album: 'The Rising Tied (Deluxe Edition)',
          trackId: '/org/mpris/MediaPlayer2/firefox',
          url: 'https://music.youtube.com/search?q=in+the+end',
          playbackStatus: 'Playing',
        },
        { browserPlayerService: 'apple-music' },
      ),
    ).toBe(PLAYER_PROFILES.youtubeMusicWeb);
  });

  it('detects Apple Music Web in auto mode from media urls', () => {
    expect(
      detectPlayerProfile({
        busName: 'org.mpris.MediaPlayer2.firefox.instance1',
        title: 'Natural',
        artist: 'Imagine Dragons',
        url: 'https://music.apple.com/us/album/natural/1437948883?i=1437948890',
        playbackStatus: 'Playing',
      }),
    ).toBe(PLAYER_PROFILES.appleMusicWeb);
  });

  it('detects Spotify Web in auto mode from open.spotify.com urls', () => {
    expect(
      detectPlayerProfile({
        busName: 'org.mpris.MediaPlayer2.firefox.instance1',
        title: 'Nina',
        artist: '.Feast',
        url: 'https://open.spotify.com/track/1',
        playbackStatus: 'Playing',
      }),
    ).toBe(PLAYER_PROFILES.spotifyWeb);
  });

  it('detects Spotify Web when Spotify browser service is configured and metadata looks like music', () => {
    expect(
      detectPlayerProfile(
        {
          busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
          title: 'Mangu',
          artist: 'Fourtwnty, Charita Utami',
          album: 'Nalar',
          durationMs: 261094,
          trackId: '/org/chromium/MediaPlayer2/TrackList/Track6E48368',
          playbackStatus: 'Playing',
        },
        { browserPlayerService: 'spotify' },
      ),
    ).toBe(PLAYER_PROFILES.spotifyWeb);
  });

  it('detects YouTube Music Web when YouTube Music browser service is configured and metadata looks like music', () => {
    expect(
      detectPlayerProfile(
        {
          busName: 'org.mpris.MediaPlayer2.chromium.instance6544',
          title: 'Let Me Love You',
          artist: 'DJ Snake',
          album: '',
          durationMs: 205341,
          trackId: '/org/chromium/MediaPlayer2/TrackList/Track22C9441C7D270DC57830A101D2310234',
          playbackStatus: 'Playing',
        },
        { browserPlayerService: 'youtube-music' },
      ),
    ).toBe(PLAYER_PROFILES.youtubeMusicWeb);
  });

  it('detects YouTube Music Web for Firefox when YouTube Music browser service is configured', () => {
    expect(
      detectPlayerProfile(
        {
          busName: 'org.mpris.MediaPlayer2.firefox.instance1',
          title: 'Heathens',
          artist: 'twenty one pilots',
          durationMs: 217921,
          playbackStatus: 'Playing',
        },
        { browserPlayerService: 'youtube-music' },
      ),
    ).toBe(PLAYER_PROFILES.youtubeMusicWeb);
  });

  it('keeps browser players generic when generic browser service is configured', () => {
    expect(
      detectPlayerProfile(
        {
          busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
          title: 'Mangu',
          artist: 'Fourtwnty, Charita Utami',
          trackId: '/com/spotify/track/1',
        },
        { browserPlayerService: 'generic' },
      ),
    ).toBe(PLAYER_PROFILES.chromiumBrowser);
  });

  it('lets generic mode suppress service-specialized URL detection', () => {
    expect(
      detectPlayerProfile(
        {
          busName: 'org.mpris.MediaPlayer2.firefox.instance1',
          title: 'Hall of Fame',
          artist: 'The Script',
          url: 'https://music.youtube.com/watch?v=snx5qGUtVi8',
          playbackStatus: 'Playing',
        },
        { browserPlayerService: 'generic' },
      ),
    ).toBe(PLAYER_PROFILES.firefoxBrowser);
  });

  it('does not infer YouTube Music Web from advertisements', () => {
    expect(
      detectPlayerProfile(
        {
          busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
          title: 'Advertisement',
          artist: 'YouTube Music',
          durationMs: 30_000,
          playbackStatus: 'Playing',
        },
        { browserPlayerService: 'youtube-music' },
      ),
    ).toBe(PLAYER_PROFILES.chromiumBrowser);
  });

  it('does not infer Spotify Web from advertisements', () => {
    expect(
      detectPlayerProfile(
        {
          busName: 'org.mpris.MediaPlayer2.chromium.instance58782',
          title: 'Advertisement',
          artist: 'Spotify',
          durationMs: 30_000,
          playbackStatus: 'Playing',
        },
        { browserPlayerService: 'spotify' },
      ),
    ).toBe(PLAYER_PROFILES.chromiumBrowser);
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

describe('selectBrowserServiceProfile', () => {
  const browserInput = Object.freeze({
    busName: 'org.mpris.MediaPlayer2.chromium.instance6544',
    title: 'Let Me Love You',
    artist: 'DJ Snake',
    album: '',
    durationMs: 205341,
    trackId: '/org/chromium/MediaPlayer2/TrackList/Track22C9441C7D270DC57830A101D2310234',
    playbackStatus: 'Playing',
  });

  it('keeps the browser-family profile for generic mode', () => {
    expect(
      selectBrowserServiceProfile(browserInput, PLAYER_PROFILES.chromiumBrowser, {
        browserPlayerService: 'generic',
      }),
    ).toBe(PLAYER_PROFILES.chromiumBrowser);
  });

  it('maps explicit Spotify service to Spotify Web for music-like metadata', () => {
    expect(
      selectBrowserServiceProfile(browserInput, PLAYER_PROFILES.chromiumBrowser, {
        browserPlayerService: 'spotify',
      }),
    ).toBe(PLAYER_PROFILES.spotifyWeb);
  });

  it('maps explicit YouTube Music service to YouTube Music Web for music-like metadata', () => {
    expect(
      selectBrowserServiceProfile(browserInput, PLAYER_PROFILES.firefoxBrowser, {
        browserPlayerService: 'youtube-music',
      }),
    ).toBe(PLAYER_PROFILES.youtubeMusicWeb);
  });

  it('maps explicit Apple Music service to Apple Music Web for music-like metadata', () => {
    expect(
      selectBrowserServiceProfile(browserInput, PLAYER_PROFILES.chromiumBrowser, {
        browserPlayerService: 'apple-music',
      }),
    ).toBe(PLAYER_PROFILES.appleMusicWeb);
  });

  it('maps explicit Apple Music service for Firefox browser metadata', () => {
    expect(
      selectBrowserServiceProfile(browserInput, PLAYER_PROFILES.firefoxBrowser, {
        browserPlayerService: 'apple-music',
      }),
    ).toBe(PLAYER_PROFILES.appleMusicWeb);
  });

  it('does not let Spotify track evidence override explicit Apple Music service', () => {
    expect(
      selectBrowserServiceProfile(
        {
          ...browserInput,
          trackId: '/com/spotify/track/1',
        },
        PLAYER_PROFILES.chromiumBrowser,
        {
          browserPlayerService: 'apple-music',
        },
      ),
    ).toBe(PLAYER_PROFILES.appleMusicWeb);
  });

  it('lets strong URL evidence override stale explicit service settings', () => {
    expect(
      selectBrowserServiceProfile(
        {
          ...browserInput,
          url: 'https://music.youtube.com/watch?v=snx5qGUtVi8',
        },
        PLAYER_PROFILES.firefoxBrowser,
        {
          browserPlayerService: 'apple-music',
        },
      ),
    ).toBe(PLAYER_PROFILES.youtubeMusicWeb);
  });

  it('keeps auto mode on the browser-family profile without strong service evidence', () => {
    expect(selectBrowserServiceProfile(browserInput, PLAYER_PROFILES.chromiumBrowser)).toBe(
      PLAYER_PROFILES.chromiumBrowser,
    );
  });

  it('maps auto mode to Spotify Web when metadata has strong Spotify evidence', () => {
    expect(
      selectBrowserServiceProfile(
        {
          ...browserInput,
          trackId: '/com/spotify/track/1',
        },
        PLAYER_PROFILES.chromiumBrowser,
      ),
    ).toBe(PLAYER_PROFILES.spotifyWeb);
  });

  it('does not map low-confidence metadata to explicit browser service profiles', () => {
    const advertisementInput = {
      ...browserInput,
      title: 'Advertisement',
      artist: 'YouTube Music',
    };

    expect(
      selectBrowserServiceProfile(advertisementInput, PLAYER_PROFILES.chromiumBrowser, {
        browserPlayerService: 'youtube-music',
      }),
    ).toBe(PLAYER_PROFILES.chromiumBrowser);

    expect(
      selectBrowserServiceProfile(advertisementInput, PLAYER_PROFILES.chromiumBrowser, {
        browserPlayerService: 'apple-music',
      }),
    ).toBe(PLAYER_PROFILES.chromiumBrowser);
  });

  it('returns non-browser profiles unchanged', () => {
    expect(
      selectBrowserServiceProfile(browserInput, PLAYER_PROFILES.genericMpris, {
        browserPlayerService: 'spotify',
      }),
    ).toBe(PLAYER_PROFILES.genericMpris);
  });
});
