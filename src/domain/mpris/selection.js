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

  return [...validPlayers].sort((left, right) => left.busName.localeCompare(right.busName))[0];
}

function isValidPlayer(player) {
  return (
    player !== null &&
    typeof player === 'object' &&
    typeof player.busName === 'string' &&
    player.busName.startsWith('org.mpris.MediaPlayer2.')
  );
}
