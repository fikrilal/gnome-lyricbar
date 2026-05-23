/**
 * @import { PlayerSnapshot } from '../mpris/types.js'
 * @import { DisplayState } from './types.js'
 */

/**
 * @param {PlayerSnapshot | null | undefined} player
 * @returns {DisplayState}
 */
export function displayStateFromPlayer(player) {
  if (player === null || player === undefined) {
    return { kind: 'idle' };
  }

  return {
    kind: 'track',
    track: {
      title: player.title,
      artist: player.artist,
    },
  };
}
