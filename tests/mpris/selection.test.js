import { describe, expect, it } from 'vitest';

import { selectActivePlayer } from '../../src/domain/mpris/selection.js';

describe('selectActivePlayer', () => {
  it('selects the currently playing player first', () => {
    const selected = selectActivePlayer([
      { busName: 'org.mpris.MediaPlayer2.spotify', playbackStatus: 'Paused' },
      { busName: 'org.mpris.MediaPlayer2.firefox.instance1', playbackStatus: 'Playing' },
    ]);

    expect(selected?.busName).toBe('org.mpris.MediaPlayer2.firefox.instance1');
  });

  it('keeps the previous player when nothing is playing', () => {
    const selected = selectActivePlayer(
      [
        { busName: 'org.mpris.MediaPlayer2.spotify', playbackStatus: 'Paused' },
        { busName: 'org.mpris.MediaPlayer2.firefox.instance1', playbackStatus: 'Paused' },
      ],
      'org.mpris.MediaPlayer2.spotify',
    );

    expect(selected?.busName).toBe('org.mpris.MediaPlayer2.spotify');
  });

  it('uses preferred fragments before sorted fallback', () => {
    const selected = selectActivePlayer(
      [
        { busName: 'org.mpris.MediaPlayer2.firefox.instance1', playbackStatus: 'Paused' },
        { busName: 'org.mpris.MediaPlayer2.spotify', playbackStatus: 'Paused' },
      ],
      null,
      ['spotify'],
    );

    expect(selected?.busName).toBe('org.mpris.MediaPlayer2.spotify');
  });
});
