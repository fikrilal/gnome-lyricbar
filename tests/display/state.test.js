import { describe, expect, it } from 'vitest';

import { formatDisplayState, formatTrackText } from '../../src/domain/display/state.js';

describe('formatDisplayState', () => {
  it('shows the current lyric line when available', () => {
    expect(formatDisplayState({ kind: 'lyrics', line: '  Hello   world  ' }, 'track')).toEqual({
      text: 'Hello world',
      visible: true,
    });
  });

  it('falls back to track text when lyric line is empty', () => {
    expect(
      formatDisplayState(
        {
          kind: 'lyrics',
          line: ' ',
          track: { artist: 'Artist', title: 'Song' },
        },
        'track',
      ),
    ).toEqual({
      text: 'Artist - Song',
      visible: true,
    });
  });

  it('formats track fallback state', () => {
    expect(
      formatDisplayState(
        {
          kind: 'track',
          track: { artist: 'Artist', title: 'Song' },
        },
        'track',
      ),
    ).toEqual({
      text: 'Artist - Song',
      visible: true,
    });
  });

  it('uses the idle fallback mode when track fallback is disabled', () => {
    expect(
      formatDisplayState(
        {
          kind: 'track',
          track: { artist: 'Artist', title: 'Song' },
        },
        'idle',
      ),
    ).toEqual({
      text: 'LyricBar',
      visible: true,
    });
  });

  it('uses the hidden fallback mode when requested', () => {
    expect(
      formatDisplayState(
        {
          kind: 'track',
          track: { artist: 'Artist', title: 'Song' },
        },
        'hidden',
      ),
    ).toEqual({
      text: '',
      visible: false,
    });
  });

  it('shows a neutral idle state', () => {
    expect(formatDisplayState({ kind: 'idle' }, 'track')).toEqual({
      text: 'LyricBar',
      visible: true,
    });
  });

  it('hides the idle state when fallback mode is hidden', () => {
    expect(formatDisplayState({ kind: 'idle' }, 'hidden')).toEqual({
      text: '',
      visible: false,
    });
  });

  it('shows loading state with track context', () => {
    expect(
      formatDisplayState(
        {
          kind: 'loading',
          track: { artist: 'Artist', title: 'Song' },
        },
        'track',
      ),
    ).toEqual({
      text: 'Loading lyrics: Artist - Song',
      visible: true,
    });
  });

  it('shows loading state without track context', () => {
    expect(formatDisplayState({ kind: 'loading' }, 'track')).toEqual({
      text: 'Loading lyrics',
      visible: true,
    });
  });

  it('uses track fallback for error state when configured', () => {
    expect(
      formatDisplayState(
        {
          kind: 'error',
          track: { artist: 'Artist', title: 'Song' },
        },
        'track',
      ),
    ).toEqual({
      text: 'Artist - Song',
      visible: true,
    });
  });

  it('uses neutral error text when fallback mode is idle', () => {
    expect(formatDisplayState({ kind: 'error' }, 'idle')).toEqual({
      text: 'Lyrics unavailable',
      visible: true,
    });
  });

  it('preserves long lyric lines for the Shell layer to ellipsize', () => {
    const longLine = 'This is a very long lyric line that should not be truncated in domain logic';

    expect(formatDisplayState({ kind: 'lyrics', line: longLine }, 'track')).toEqual({
      text: longLine,
      visible: true,
    });
  });
});

describe('formatTrackText', () => {
  it('uses title when artist is missing', () => {
    expect(formatTrackText({ title: 'Song' })).toBe('Song');
  });

  it('uses artist when title is missing', () => {
    expect(formatTrackText({ artist: 'Artist' })).toBe('Artist');
  });

  it('returns null when track metadata is empty', () => {
    expect(formatTrackText({ artist: ' ', title: ' ' })).toBeNull();
  });
});
