import { describe, expect, it, vi } from 'vitest';

import { RuntimeLogger } from '../../src/runtime/logger.js';

describe('RuntimeLogger', () => {
  it('does not emit when debug logging is disabled', () => {
    const sink = vi.fn();
    const logger = new RuntimeLogger('LyricBar', () => false, sink);

    logger.debug('enabled');

    expect(sink).not.toHaveBeenCalled();
  });

  it('emits stable formatted messages when debug logging is enabled', () => {
    const sink = vi.fn();
    const logger = new RuntimeLogger('LyricBar', () => true, sink);

    logger.debug('selected-player', {
      title: 'Yellow',
      playing: true,
      durationMs: 266773,
    });

    expect(sink).toHaveBeenCalledWith(
      'LyricBar selected-player durationMs=266773 playing=true title="Yellow"',
    );
  });

  it('creates child loggers that share the enabled callback and sink', () => {
    let enabled = false;
    const sink = vi.fn();
    const logger = new RuntimeLogger('LyricBar', () => enabled, sink).child('mpris');

    logger.debug('start');
    enabled = true;
    logger.debug('start');

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith('LyricBar:mpris start');
  });
});
