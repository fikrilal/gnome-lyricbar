import { describe, expect, it, vi } from 'vitest';

import { LifecycleRegistry } from '../../src/runtime/lifecycle.js';
import { SettingsAdapter } from '../../src/runtime/settings.js';

describe('SettingsAdapter', () => {
  it('reads normalized settings from GSettings backend', () => {
    const adapter = new SettingsAdapter(
      createSettingsBackend({
        textAlign: 'right',
      }),
      new LifecycleRegistry(),
    );

    expect(adapter.read()).toEqual({
      panelPosition: 'center',
      maxWidth: 360,
      textAlign: 'right',
      fallbackMode: 'track',
      playerPriority: ['spotify'],
      browserPlayerService: 'auto',
      cacheEnabled: true,
      debugLogging: false,
    });
  });

  it('subscribes to every supported setting and disconnects on lifecycle disposal', () => {
    const backend = createSettingsBackend();
    const lifecycle = new LifecycleRegistry();
    const adapter = new SettingsAdapter(backend, lifecycle);
    const callback = vi.fn();

    adapter.subscribe(callback);

    expect(backend.connect).toHaveBeenCalledTimes(8);
    backend.emit('changed::max-width');

    expect(callback).toHaveBeenCalledWith(adapter.read());

    lifecycle.dispose();

    expect(backend.disconnect).toHaveBeenCalledTimes(8);
    expect(backend.disconnect).toHaveBeenNthCalledWith(1, 8);
    expect(backend.disconnect).toHaveBeenNthCalledWith(8, 1);
  });
});

/**
 * @param {{ textAlign?: string }} [overrides]
 * @returns {import('../../src/runtime/settings.js').GSettingsBackend & { emit(signal: string): void }}
 */
function createSettingsBackend(overrides = {}) {
  let nextSignalId = 1;
  /** @type {Map<string, Array<() => void>>} */
  const handlers = new Map();

  return {
    get_string: vi.fn((key) => {
      if (key === 'panel-position') {
        return 'center';
      }
      if (key === 'text-align') {
        return overrides.textAlign ?? 'left';
      }
      if (key === 'fallback-mode') {
        return 'track';
      }
      if (key === 'browser-player-service') {
        return 'auto';
      }
      return '';
    }),
    get_int: vi.fn(() => 360),
    get_strv: vi.fn(() => ['spotify']),
    get_boolean: vi.fn((key) => key === 'cache-enabled'),
    connect: vi.fn((signal, callback) => {
      const signalHandlers = handlers.get(signal) ?? [];
      signalHandlers.push(callback);
      handlers.set(signal, signalHandlers);
      const signalId = nextSignalId;
      nextSignalId += 1;
      return signalId;
    }),
    disconnect: vi.fn(),
    /**
     * @param {string} signal
     * @returns {void}
     */
    emit(signal) {
      for (const handler of handlers.get(signal) ?? []) {
        handler();
      }
    },
  };
}
