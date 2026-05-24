import { describe, expect, it } from 'vitest';

import { shouldRefreshPlayerSelection } from '../../src/domain/settings/change.js';

describe('shouldRefreshPlayerSelection', () => {
  it('returns false when player priority is unchanged', () => {
    expect(shouldRefreshPlayerSelection(settings(['spotify']), settings(['spotify']))).toBe(false);
  });

  it('returns true when player priority ordering changes', () => {
    expect(
      shouldRefreshPlayerSelection(settings(['spotify', 'vlc']), settings(['vlc', 'spotify'])),
    ).toBe(true);
  });

  it('returns true when player priority entries change', () => {
    expect(shouldRefreshPlayerSelection(settings(['spotify']), settings(['vlc']))).toBe(true);
  });

  it('ignores unrelated display settings', () => {
    expect(
      shouldRefreshPlayerSelection(
        { ...settings(['spotify']), maxWidth: 240, fallbackMode: 'track' },
        { ...settings(['spotify']), maxWidth: 480, fallbackMode: 'hidden' },
      ),
    ).toBe(false);
  });
});

/**
 * @param {readonly string[]} playerPriority
 * @returns {import('../../src/domain/settings/types.js').LyricBarSettings}
 */
function settings(playerPriority) {
  return {
    panelPosition: 'center',
    maxWidth: 360,
    fallbackMode: 'track',
    playerPriority,
    cacheEnabled: true,
    debugLogging: false,
  };
}
