import { describe, expect, it } from 'vitest';

import {
  applyNameOwnerChange,
  diffBusNames,
  filterMprisNames,
  isMprisBusName,
} from '../../src/runtime/mpris/discovery.js';

describe('isMprisBusName', () => {
  it('accepts MPRIS bus names with a non-empty suffix', () => {
    expect(isMprisBusName('org.mpris.MediaPlayer2.spotify')).toBe(true);
    expect(isMprisBusName('org.mpris.MediaPlayer2.firefox.instance1')).toBe(true);
  });

  it('rejects the bare MPRIS prefix', () => {
    expect(isMprisBusName('org.mpris.MediaPlayer2.')).toBe(false);
  });

  it('rejects non-MPRIS names', () => {
    expect(isMprisBusName('org.example.NotMpris')).toBe(false);
    expect(isMprisBusName('org.freedesktop.DBus')).toBe(false);
    expect(isMprisBusName(':1.42')).toBe(false);
  });

  it('rejects non-string inputs', () => {
    expect(isMprisBusName(null)).toBe(false);
    expect(isMprisBusName(undefined)).toBe(false);
    expect(isMprisBusName(42)).toBe(false);
  });
});

describe('filterMprisNames', () => {
  it('keeps MPRIS names in input order', () => {
    expect(
      filterMprisNames([
        'org.example.NotMpris',
        'org.mpris.MediaPlayer2.spotify',
        ':1.42',
        'org.mpris.MediaPlayer2.firefox.instance1',
      ]),
    ).toEqual(['org.mpris.MediaPlayer2.spotify', 'org.mpris.MediaPlayer2.firefox.instance1']);
  });

  it('returns empty array for non-array input', () => {
    expect(filterMprisNames(null)).toEqual([]);
    expect(filterMprisNames(undefined)).toEqual([]);
  });

  it('drops non-string entries', () => {
    expect(filterMprisNames([null, 42, 'org.mpris.MediaPlayer2.spotify'])).toEqual([
      'org.mpris.MediaPlayer2.spotify',
    ]);
  });
});

describe('diffBusNames', () => {
  it('reports added and removed names sorted by bus name', () => {
    const previous = new Set(['org.mpris.MediaPlayer2.spotify']);
    const current = new Set([
      'org.mpris.MediaPlayer2.vlc',
      'org.mpris.MediaPlayer2.firefox.instance1',
    ]);

    expect(diffBusNames(previous, current)).toEqual({
      added: ['org.mpris.MediaPlayer2.firefox.instance1', 'org.mpris.MediaPlayer2.vlc'],
      removed: ['org.mpris.MediaPlayer2.spotify'],
    });
  });

  it('returns empty arrays when sets match', () => {
    const set = new Set(['org.mpris.MediaPlayer2.spotify']);
    expect(diffBusNames(set, set)).toEqual({ added: [], removed: [] });
  });
});

describe('applyNameOwnerChange', () => {
  it('adds an MPRIS player when a new owner appears', () => {
    const next = applyNameOwnerChange(new Set(), {
      name: 'org.mpris.MediaPlayer2.spotify',
      oldOwner: '',
      newOwner: ':1.99',
    });

    expect(next).toBeInstanceOf(Set);
    expect([...(next ?? new Set())]).toEqual(['org.mpris.MediaPlayer2.spotify']);
  });

  it('removes an MPRIS player when its owner leaves', () => {
    const next = applyNameOwnerChange(new Set(['org.mpris.MediaPlayer2.spotify']), {
      name: 'org.mpris.MediaPlayer2.spotify',
      oldOwner: ':1.99',
      newOwner: '',
    });

    expect(next).toBeInstanceOf(Set);
    expect([...(next ?? new Set())]).toEqual([]);
  });

  it('returns null when ownership transfers without changing presence', () => {
    const current = new Set(['org.mpris.MediaPlayer2.spotify']);

    expect(
      applyNameOwnerChange(current, {
        name: 'org.mpris.MediaPlayer2.spotify',
        oldOwner: ':1.99',
        newOwner: ':1.100',
      }),
    ).toBeNull();
  });

  it('ignores changes for non-MPRIS bus names', () => {
    expect(
      applyNameOwnerChange(new Set(), {
        name: 'org.example.NotMpris',
        oldOwner: '',
        newOwner: ':1.99',
      }),
    ).toBeNull();
  });

  it('returns null when an unknown player is announced as removed', () => {
    expect(
      applyNameOwnerChange(new Set(), {
        name: 'org.mpris.MediaPlayer2.spotify',
        oldOwner: ':1.99',
        newOwner: '',
      }),
    ).toBeNull();
  });

  it('returns null when an already-present player gets its initial owner', () => {
    expect(
      applyNameOwnerChange(new Set(['org.mpris.MediaPlayer2.spotify']), {
        name: 'org.mpris.MediaPlayer2.spotify',
        oldOwner: '',
        newOwner: ':1.99',
      }),
    ).toBeNull();
  });
});
