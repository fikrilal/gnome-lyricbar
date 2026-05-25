import { PLAYER_PROFILES } from './profile.js';

/**
 * @import { PlayerSnapshot } from './types.js'
 * @import { PlayerProfile } from './profile.js'
 *
 * @typedef {Readonly<{
 *   snapshot: PlayerSnapshot,
 *   adapterId: 'spotify-desktop' | 'spotify-web' | 'browser' | 'generic',
 * }>} AdaptedPlayerSnapshot
 */

/**
 * @param {PlayerSnapshot | null} snapshot
 * @param {PlayerProfile} profile
 * @returns {AdaptedPlayerSnapshot | null}
 */
export function adaptPlayerSnapshot(snapshot, profile) {
  if (snapshot === null) {
    return null;
  }

  if (profile.id === PLAYER_PROFILES.spotifyDesktop.id) {
    return {
      snapshot,
      adapterId: 'spotify-desktop',
    };
  }

  if (profile.id === PLAYER_PROFILES.spotifyWeb.id) {
    return {
      snapshot: adaptSpotifyBrowserSnapshot(snapshot),
      adapterId: 'spotify-web',
    };
  }

  if (profile.sourceKind === 'browser') {
    return {
      snapshot: adaptBrowserSnapshot(snapshot),
      adapterId: 'browser',
    };
  }

  return {
    snapshot,
    adapterId: 'generic',
  };
}

/**
 * @param {PlayerSnapshot} snapshot
 * @returns {PlayerSnapshot}
 */
function adaptSpotifyBrowserSnapshot(snapshot) {
  return adaptBrowserSnapshot(snapshot);
}

/**
 * @param {PlayerSnapshot} snapshot
 * @returns {PlayerSnapshot}
 */
function adaptBrowserSnapshot(snapshot) {
  const titleWithoutSuffix = stripSpotifySuffix(snapshot.title);
  const titleParts = splitTitleAndArtist(titleWithoutSuffix);

  if (snapshot.artist === '' && titleParts !== null) {
    return {
      ...snapshot,
      title: titleParts.title,
      artist: titleParts.artist,
    };
  }

  if (titleWithoutSuffix !== snapshot.title) {
    return {
      ...snapshot,
      title: titleWithoutSuffix,
    };
  }

  return snapshot;
}

/**
 * @param {string} value
 * @returns {string}
 */
function stripSpotifySuffix(value) {
  return value
    .replace(/\s+[-–—|•·]\s+Spotify\s*$/iu, '')
    .replace(/\s+[-–—|•·]\s+Spotify Web Player\s*$/iu, '')
    .trim();
}

/**
 * @param {string} value
 * @returns {{ title: string, artist: string } | null}
 */
function splitTitleAndArtist(value) {
  const match = /^(.+?)\s+[-–—]\s+([^-–—]+)$/u.exec(value);
  if (match === null) {
    return null;
  }

  const rawTitle = match.at(1);
  const rawArtist = match.at(2);
  if (rawTitle === undefined || rawArtist === undefined) {
    return null;
  }

  const title = rawTitle.trim();
  const artist = rawArtist.trim();
  if (title === '' || artist === '') {
    return null;
  }

  return { title, artist };
}
