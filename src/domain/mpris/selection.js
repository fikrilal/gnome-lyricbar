/**
 * @import { PlayerSnapshot } from './types.js'
 */

/**
 * @param {readonly PlayerSnapshot[] | null | undefined} players
 * @param {string | null} [previousBusName]
 * @param {readonly string[]} [preferredFragments]
 * @returns {PlayerSnapshot | null}
 */
export function selectActivePlayer(players, previousBusName = null, preferredFragments = []) {
  if (!Array.isArray(players) || players.length === 0) {
    return null;
  }

  const playing = selectPreferredPlaying(players, preferredFragments);
  if (playing) {
    return playing;
  }

  if (typeof previousBusName === 'string' && previousBusName !== '') {
    const previous = players.find((player) => player.busName === previousBusName);
    if (previous) {
      return previous;
    }
  }

  for (const fragment of preferredFragments) {
    const preferred = findByFragment(players, fragment);
    if (preferred) {
      return preferred;
    }
  }

  return sortByBusName(players)[0] ?? null;
}

/**
 * @param {readonly PlayerSnapshot[]} players
 * @param {readonly string[]} preferredFragments
 * @returns {PlayerSnapshot | null}
 */
function selectPreferredPlaying(players, preferredFragments) {
  const playing = players.filter((player) => player.playbackStatus === 'Playing');
  if (playing.length === 0) {
    return null;
  }

  for (const fragment of preferredFragments) {
    const preferred = findByFragment(playing, fragment);
    if (preferred) {
      return preferred;
    }
  }

  return sortByBusName(playing)[0] ?? null;
}

/**
 * @param {readonly PlayerSnapshot[]} players
 * @param {string} fragment
 * @returns {PlayerSnapshot | null}
 */
function findByFragment(players, fragment) {
  if (typeof fragment !== 'string' || fragment.trim() === '') {
    return null;
  }

  const needle = fragment.trim().toLowerCase();
  const matches = players.filter((player) => player.busName.toLowerCase().includes(needle));
  if (matches.length === 0) {
    return null;
  }

  return sortByBusName(matches)[0] ?? null;
}

/**
 * @param {readonly PlayerSnapshot[]} players
 * @returns {PlayerSnapshot[]}
 */
function sortByBusName(players) {
  return [...players].sort((left, right) => left.busName.localeCompare(right.busName));
}
