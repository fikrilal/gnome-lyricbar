import { describe, expect, it } from 'vitest';

import { selectActivePlayer } from '../../src/domain/mpris/selection.js';

/**
 * @import { PlaybackStatus, PlayerSnapshot } from '../../src/domain/mpris/types.js'
 */

/**
 * @param {string} busName
 * @param {PlaybackStatus} playbackStatus
 * @param {Partial<Omit<PlayerSnapshot, 'busName' | 'playbackStatus'>>} [overrides]
 * @returns {PlayerSnapshot}
 */
function snapshot(busName, playbackStatus, overrides = {}) {
  return {
    busName,
    title: overrides.title ?? '',
    artist: overrides.artist ?? '',
    album: overrides.album ?? '',
    durationMs: overrides.durationMs ?? null,
    trackId: overrides.trackId ?? null,
    playbackStatus,
  };
}

describe('selectActivePlayer', () => {
  it('returns null when there are no players', () => {
    expect(selectActivePlayer([])).toBeNull();
  });

  it('returns null when input is missing', () => {
    expect(selectActivePlayer(null)).toBeNull();
    expect(selectActivePlayer(undefined)).toBeNull();
  });

  it('selects the currently playing player first', () => {
    const selected = selectActivePlayer([
      snapshot('org.mpris.MediaPlayer2.spotify', 'Paused'),
      snapshot('org.mpris.MediaPlayer2.firefox.instance1', 'Playing'),
    ]);

    expect(selected?.busName).toBe('org.mpris.MediaPlayer2.firefox.instance1');
  });

  it('breaks ties between playing players deterministically by bus name', () => {
    const selected = selectActivePlayer([
      snapshot('org.mpris.MediaPlayer2.vlc', 'Playing'),
      snapshot('org.mpris.MediaPlayer2.firefox.instance1', 'Playing'),
      snapshot('org.mpris.MediaPlayer2.spotify', 'Playing'),
    ]);

    expect(selected?.busName).toBe('org.mpris.MediaPlayer2.firefox.instance1');
  });

  it('keeps the previous player when nothing is playing', () => {
    const selected = selectActivePlayer(
      [
        snapshot('org.mpris.MediaPlayer2.spotify', 'Paused'),
        snapshot('org.mpris.MediaPlayer2.firefox.instance1', 'Paused'),
      ],
      'org.mpris.MediaPlayer2.spotify',
    );

    expect(selected?.busName).toBe('org.mpris.MediaPlayer2.spotify');
  });

  it('ignores the previous bus name when it no longer exists', () => {
    const selected = selectActivePlayer(
      [
        snapshot('org.mpris.MediaPlayer2.firefox.instance1', 'Paused'),
        snapshot('org.mpris.MediaPlayer2.spotify', 'Paused'),
      ],
      'org.mpris.MediaPlayer2.gone',
      ['spotify'],
    );

    expect(selected?.busName).toBe('org.mpris.MediaPlayer2.spotify');
  });

  it('uses preferred fragments before sorted fallback', () => {
    const selected = selectActivePlayer(
      [
        snapshot('org.mpris.MediaPlayer2.firefox.instance1', 'Paused'),
        snapshot('org.mpris.MediaPlayer2.spotify', 'Paused'),
      ],
      null,
      ['spotify'],
    );

    expect(selected?.busName).toBe('org.mpris.MediaPlayer2.spotify');
  });

  it('matches preferred fragments case-insensitively', () => {
    const selected = selectActivePlayer(
      [
        snapshot('org.mpris.MediaPlayer2.firefox.instance1', 'Paused'),
        snapshot('org.mpris.MediaPlayer2.spotify', 'Paused'),
      ],
      null,
      ['SPOTIFY'],
    );

    expect(selected?.busName).toBe('org.mpris.MediaPlayer2.spotify');
  });

  it('honors fragment order when multiple fragments would match', () => {
    const selected = selectActivePlayer(
      [
        snapshot('org.mpris.MediaPlayer2.firefox.instance1', 'Paused'),
        snapshot('org.mpris.MediaPlayer2.spotify', 'Paused'),
      ],
      null,
      ['firefox', 'spotify'],
    );

    expect(selected?.busName).toBe('org.mpris.MediaPlayer2.firefox.instance1');
  });

  it('falls back to deterministic sorted bus name when no rule matches', () => {
    const selected = selectActivePlayer([
      snapshot('org.mpris.MediaPlayer2.vlc', 'Paused'),
      snapshot('org.mpris.MediaPlayer2.firefox.instance1', 'Paused'),
      snapshot('org.mpris.MediaPlayer2.spotify', 'Paused'),
    ]);

    expect(selected?.busName).toBe('org.mpris.MediaPlayer2.firefox.instance1');
  });

  it('ignores empty preferred fragments', () => {
    const selected = selectActivePlayer(
      [
        snapshot('org.mpris.MediaPlayer2.firefox.instance1', 'Paused'),
        snapshot('org.mpris.MediaPlayer2.spotify', 'Paused'),
      ],
      null,
      ['', '   ', 'spotify'],
    );

    expect(selected?.busName).toBe('org.mpris.MediaPlayer2.spotify');
  });
});
