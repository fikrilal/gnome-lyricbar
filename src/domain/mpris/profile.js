/**
 * @typedef {
 *   | 'spotify-desktop'
 *   | 'spotify-web'
 *   | 'youtube-music-web'
 *   | 'chromium-browser'
 *   | 'firefox-browser'
 *   | 'generic-mpris'
 * } PlayerProfileId
 *
 * @typedef {Readonly<{
 *   id: PlayerProfileId,
 *   sourceKind: 'desktop' | 'browser' | 'generic',
 * }>} PlayerProfile
 *
 * @typedef {Readonly<{
 *   busName?: unknown,
 *   title?: unknown,
 *   artist?: unknown,
 *   album?: unknown,
 *   trackId?: unknown,
 *   durationMs?: unknown,
 *   playbackStatus?: unknown,
 * }>} PlayerProfileInput
 *
 * @typedef {'auto' | 'spotify' | 'youtube-music' | 'generic'} BrowserPlayerService
 *
 * @typedef {Readonly<{
 *   browserPlayerService?: BrowserPlayerService | null | undefined,
 * }>} PlayerProfileOptions
 */

const MPRIS_BUS_PREFIX = 'org.mpris.MediaPlayer2.';

export const PLAYER_PROFILES = Object.freeze({
  spotifyDesktop: Object.freeze({
    id: 'spotify-desktop',
    sourceKind: 'desktop',
  }),
  spotifyWeb: Object.freeze({
    id: 'spotify-web',
    sourceKind: 'browser',
  }),
  youtubeMusicWeb: Object.freeze({
    id: 'youtube-music-web',
    sourceKind: 'browser',
  }),
  chromiumBrowser: Object.freeze({
    id: 'chromium-browser',
    sourceKind: 'browser',
  }),
  firefoxBrowser: Object.freeze({
    id: 'firefox-browser',
    sourceKind: 'browser',
  }),
  genericMpris: Object.freeze({
    id: 'generic-mpris',
    sourceKind: 'generic',
  }),
});

/**
 * Detects the broad MPRIS player behavior profile. Service-specific web
 * profiles require stronger evidence than a browser bus name, so browser
 * players intentionally start as browser-family profiles.
 *
 * @param {PlayerProfileInput | null | undefined} input
 * @param {PlayerProfileOptions} [options]
 * @returns {PlayerProfile}
 */
export function detectPlayerProfile(input, options = {}) {
  const busName = normalizeBusName(input?.busName);
  if (busName === null) {
    return PLAYER_PROFILES.genericMpris;
  }

  const applicationName = busName.slice(MPRIS_BUS_PREFIX.length).toLowerCase();

  if (applicationName === 'spotify') {
    return PLAYER_PROFILES.spotifyDesktop;
  }

  if (applicationName === 'chromium' || applicationName.startsWith('chromium.')) {
    if (shouldUseYoutubeMusicWebProfile(input, options)) {
      return PLAYER_PROFILES.youtubeMusicWeb;
    }
    if (shouldUseSpotifyWebProfile(input, options)) {
      return PLAYER_PROFILES.spotifyWeb;
    }
    return PLAYER_PROFILES.chromiumBrowser;
  }

  if (applicationName === 'firefox' || applicationName.startsWith('firefox.')) {
    if (shouldUseYoutubeMusicWebProfile(input, options)) {
      return PLAYER_PROFILES.youtubeMusicWeb;
    }
    if (shouldUseSpotifyWebProfile(input, options)) {
      return PLAYER_PROFILES.spotifyWeb;
    }
    return PLAYER_PROFILES.firefoxBrowser;
  }

  return PLAYER_PROFILES.genericMpris;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeBusName(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith(MPRIS_BUS_PREFIX) || trimmed.length === MPRIS_BUS_PREFIX.length) {
    return null;
  }

  return trimmed;
}

/**
 * Browser MPRIS bus names identify the browser, not the web app. Only classify
 * Spotify Web when metadata carries a strong Spotify-shaped identifier.
 *
 * @param {PlayerProfileInput | null | undefined} input
 * @returns {boolean}
 */
function hasSpotifyWebEvidence(input) {
  const trackId = normalizeMaybeText(input?.trackId);
  return trackId !== null && trackId.toLowerCase().includes('spotify');
}

/**
 * Browser MPRIS players identify the browser, not the media service. LyricBar
 * is Spotify-first, so users can explicitly bias music-like browser metadata
 * toward Spotify Web while keeping auto/generic behavior available.
 *
 * @param {PlayerProfileInput | null | undefined} input
 * @param {PlayerProfileOptions} options
 * @returns {boolean}
 */
function shouldUseSpotifyWebProfile(input, options) {
  const browserPlayerService = options.browserPlayerService ?? 'auto';

  if (browserPlayerService === 'generic') {
    return false;
  }

  if (browserPlayerService === 'spotify') {
    return isMusicLikeBrowserMetadata(input);
  }

  if (browserPlayerService === 'youtube-music') {
    return false;
  }

  return hasSpotifyWebEvidence(input);
}

/**
 * Browser MPRIS players identify the browser, not the web app. Users can
 * explicitly bias music-like browser metadata toward YouTube Music until MPRIS
 * provides strong service evidence.
 *
 * @param {PlayerProfileInput | null | undefined} input
 * @param {PlayerProfileOptions} options
 * @returns {boolean}
 */
function shouldUseYoutubeMusicWebProfile(input, options) {
  return options.browserPlayerService === 'youtube-music' && isMusicLikeBrowserMetadata(input);
}

/**
 * @param {PlayerProfileInput | null | undefined} input
 * @returns {boolean}
 */
function isMusicLikeBrowserMetadata(input) {
  const title = normalizeMaybeText(input?.title);
  const artist = normalizeMaybeText(input?.artist);
  if (title === null || artist === null) {
    return false;
  }

  if (title.toLowerCase() === 'advertisement') {
    return false;
  }

  if (input?.playbackStatus === 'Stopped') {
    return false;
  }

  if (typeof input?.durationMs !== 'number' || !Number.isFinite(input.durationMs)) {
    return true;
  }

  return input.durationMs >= 30_000;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeMaybeText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
