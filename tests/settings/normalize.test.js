import { describe, expect, it } from 'vitest';

import {
  normalizeFallbackMode,
  normalizeMaxWidth,
  normalizePanelPosition,
  normalizePlayerPriority,
  normalizeSettings,
} from '../../src/domain/settings/normalize.js';

describe('normalizeSettings', () => {
  it('normalizes valid settings', () => {
    expect(
      normalizeSettings({
        panelPosition: 'left',
        maxWidth: 420,
        fallbackMode: 'hidden',
        playerPriority: ['spotify', 'firefox'],
        cacheEnabled: false,
        debugLogging: true,
      }),
    ).toEqual({
      panelPosition: 'left',
      maxWidth: 420,
      fallbackMode: 'hidden',
      playerPriority: ['spotify', 'firefox'],
      cacheEnabled: false,
      debugLogging: true,
    });
  });

  it('falls back safely for invalid settings', () => {
    expect(
      normalizeSettings({
        panelPosition: 'bad',
        maxWidth: 'wide',
        fallbackMode: 'loud',
        playerPriority: 'spotify',
        cacheEnabled: 'yes',
        debugLogging: 'no',
      }),
    ).toEqual({
      panelPosition: 'center',
      maxWidth: 360,
      fallbackMode: 'track',
      playerPriority: ['spotify'],
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
