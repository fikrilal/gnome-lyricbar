import { describe, expect, it } from 'vitest';

import {
  shouldRefreshPlayerSelection,
  shouldRefreshSettingsAccess,
  shouldRepositionPanelIndicator,
} from '../../src/domain/settings/change.js';

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

  it('returns true when browser player service changes', () => {
    expect(
      shouldRefreshPlayerSelection(
        settings(['spotify'], { browserPlayerService: 'spotify' }),
        settings(['spotify'], { browserPlayerService: 'generic' }),
      ),
    ).toBe(true);
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

describe('shouldRepositionPanelIndicator', () => {
  it('returns false when panel position is unchanged', () => {
    expect(shouldRepositionPanelIndicator(settings(['spotify']), settings(['vlc']))).toBe(false);
  });

  it('returns true when panel position changes', () => {
    expect(
      shouldRepositionPanelIndicator(
        { ...settings(['spotify']), panelPosition: 'left' },
        { ...settings(['spotify']), panelPosition: 'right' },
      ),
    ).toBe(true);
  });
});

describe('shouldRefreshSettingsAccess', () => {
  it('returns false when settings icon visibility is unchanged', () => {
    expect(shouldRefreshSettingsAccess(settings(['spotify']), settings(['vlc']))).toBe(false);
  });

  it('returns true when settings icon visibility changes', () => {
    expect(
      shouldRefreshSettingsAccess(
        { ...settings(['spotify']), showSettingsIcon: true },
        { ...settings(['spotify']), showSettingsIcon: false },
      ),
    ).toBe(true);
  });
});

/**
 * @param {readonly string[]} playerPriority
 * @returns {import('../../src/domain/settings/types.js').LyricBarSettings}
 */
function settings(playerPriority, overrides = {}) {
  return {
    panelPosition: 'center',
    maxWidth: 360,
    textAlign: 'left',
    fallbackMode: 'track',
    showSettingsIcon: true,
    playerPriority,
    browserPlayerService: 'spotify',
    cacheEnabled: true,
    debugLogging: false,
    ...overrides,
  };
}
