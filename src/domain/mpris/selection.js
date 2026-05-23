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
  const validPlayers = Array.isArray(players)
    ? players.filter((player) => isValidPlayer(player))
    : [];
  if (validPlayers.length === 0) {
    return null;
  }

  const playing = validPlayers.find((player) => player.playbackStatus === 'Playing');
  if (playing) {
    return playing;
  }

  const previous = validPlayers.find((player) => player.busName === previousBusName);
  if (previous) {
    return previous;
  }

  for (const fragment of preferredFragments) {
    const preferred = validPlayers.find((player) => player.busName.includes(fragment));
    if (preferred) {
      return preferred;
    }
  }

  return (
    [...validPlayers].sort((left, right) => left.busName.localeCompare(right.busName))[0] ?? null
  );
}

/**
 * @param {unknown} player
 * @returns {player is PlayerSnapshot}
 */
function isValidPlayer(player) {
  if (player === null || typeof player !== 'object' || !('busName' in player)) {
    return false;
  }

  const candidate = /** @type {{ busName?: unknown }} */ (player);
  return (
    typeof candidate.busName === 'string' && candidate.busName.startsWith('org.mpris.MediaPlayer2.')
  );
}
