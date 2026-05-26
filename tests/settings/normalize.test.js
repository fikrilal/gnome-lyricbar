import { describe, expect, it } from 'vitest';

import {
  normalizeFallbackMode,
  normalizeBrowserPlayerService,
  normalizeMaxWidth,
  normalizePanelPosition,
  normalizePlayerPriority,
  normalizeSettings,
  normalizeTextAlign,
} from '../../src/domain/settings/normalize.js';

describe('normalizeSettings', () => {
  it('normalizes valid settings', () => {
    expect(
      normalizeSettings({
        panelPosition: 'left',
        maxWidth: 420,
        textAlign: 'center',
        fallbackMode: 'hidden',
        playerPriority: ['spotify', 'firefox'],
        browserPlayerService: 'generic',
        cacheEnabled: false,
        debugLogging: true,
      }),
    ).toEqual({
      panelPosition: 'left',
      maxWidth: 420,
      textAlign: 'center',
      fallbackMode: 'hidden',
      playerPriority: ['spotify', 'firefox'],
      browserPlayerService: 'generic',
      cacheEnabled: false,
      debugLogging: true,
    });
  });

  it('falls back safely for invalid settings', () => {
    expect(
      normalizeSettings({
        panelPosition: 'bad',
        maxWidth: 'wide',
        textAlign: 'bad',
        fallbackMode: 'loud',
        playerPriority: 'spotify',
        browserPlayerService: 'bad',
        cacheEnabled: 'yes',
        debugLogging: 'no',
      }),
    ).toEqual({
      panelPosition: 'center',
      maxWidth: 360,
      textAlign: 'left',
      fallbackMode: 'track',
      playerPriority: ['spotify'],
      browserPlayerService: 'auto',
      cacheEnabled: true,
      debugLogging: false,
    });
  });
});

describe('normalizePanelPosition', () => {
  it('accepts known panel positions', () => {
    expect(normalizePanelPosition('right')).toBe('right');
  });

  it('rejects unknown panel positions', () => {
    expect(normalizePanelPosition('top')).toBe('center');
  });
});

describe('normalizeMaxWidth', () => {
  it('rounds finite numbers', () => {
    expect(normalizeMaxWidth(244.7)).toBe(245);
  });

  it('clamps below minimum', () => {
    expect(normalizeMaxWidth(20)).toBe(120);
  });

  it('clamps above maximum', () => {
    expect(normalizeMaxWidth(1200)).toBe(720);
  });
});

describe('normalizeFallbackMode', () => {
  it('accepts known fallback modes', () => {
    expect(normalizeFallbackMode('idle')).toBe('idle');
  });

  it('rejects unknown fallback modes', () => {
    expect(normalizeFallbackMode('error')).toBe('track');
  });
});

describe('normalizePlayerPriority', () => {
  it('normalizes, lowercases, deduplicates, and removes empty fragments', () => {
    expect(normalizePlayerPriority([' Spotify ', '', 'SPOTIFY', 'Firefox'])).toEqual([
      'spotify',
      'firefox',
    ]);
  });
});

describe('normalizeBrowserPlayerService', () => {
  it('accepts known browser player services', () => {
    expect(normalizeBrowserPlayerService('auto')).toBe('auto');
    expect(normalizeBrowserPlayerService('spotify')).toBe('spotify');
    expect(normalizeBrowserPlayerService('youtube-music')).toBe('youtube-music');
    expect(normalizeBrowserPlayerService('generic')).toBe('generic');
  });

  it('rejects unknown browser player services', () => {
    expect(normalizeBrowserPlayerService('youtube')).toBe('auto');
  });
});

describe('normalizeTextAlign', () => {
  it('accepts known text aligns', () => {
    expect(normalizeTextAlign('center')).toBe('center');
  });

  it('rejects unknown text aligns', () => {
    expect(normalizeTextAlign('top')).toBe('left');
  });
});
