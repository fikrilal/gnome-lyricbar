/**
 * @typedef {
 *   | 'spotify-desktop'
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
 * }>} PlayerProfileInput
 */

const MPRIS_BUS_PREFIX = 'org.mpris.MediaPlayer2.';

export const PLAYER_PROFILES = Object.freeze({
  spotifyDesktop: Object.freeze({
    id: 'spotify-desktop',
    sourceKind: 'desktop',
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
 * @returns {PlayerProfile}
 */
export function detectPlayerProfile(input) {
  const busName = normalizeBusName(input?.busName);
  if (busName === null) {
    return PLAYER_PROFILES.genericMpris;
  }

  const applicationName = busName.slice(MPRIS_BUS_PREFIX.length).toLowerCase();

  if (applicationName === 'spotify') {
    return PLAYER_PROFILES.spotifyDesktop;
  }

  if (applicationName === 'chromium' || applicationName.startsWith('chromium.')) {
    return PLAYER_PROFILES.chromiumBrowser;
  }

  if (applicationName === 'firefox' || applicationName.startsWith('firefox.')) {
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
