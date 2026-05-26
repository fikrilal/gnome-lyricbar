import { describe, expect, it } from 'vitest';

import { buildIndicatorViewModel } from '../../src/domain/display/view-model.js';

/**
 * @import { LyricBarSettings } from '../../src/domain/settings/types.js'
 */

/** @type {LyricBarSettings} */
const baseSettings = {
  panelPosition: 'center',
  maxWidth: 360,
  textAlign: 'left',
  fallbackMode: 'track',
  playerPriority: ['spotify'],
  browserPlayerService: 'auto',
  cacheEnabled: true,
  debugLogging: false,
};

describe('buildIndicatorViewModel', () => {
  it('formats visible text and width for lyric state', () => {
    expect(
      buildIndicatorViewModel(
        {
          kind: 'lyrics',
          line: 'Hello world',
        },
        baseSettings,
      ),
    ).toEqual({
      text: 'Hello world',
      visible: true,
      maxWidth: 360,
      textAlign: 'left',
    });
  });

  it('passes hidden visibility through to the Shell layer', () => {
    expect(
      buildIndicatorViewModel(
        {
          kind: 'idle',
        },
        {
          ...baseSettings,
          fallbackMode: 'hidden',
          maxWidth: 240,
        },
      ),
    ).toEqual({
      text: '',
      visible: false,
      maxWidth: 240,
      textAlign: 'left',
    });
  });
});
