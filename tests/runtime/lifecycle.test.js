import { describe, expect, it, vi } from 'vitest';

import { LifecycleRegistry } from '../../src/runtime/lifecycle.js';

describe('LifecycleRegistry', () => {
  it('runs cleanups in reverse registration order', () => {
    const registry = new LifecycleRegistry();
    /** @type {string[]} */
    const calls = [];

    registry.add(() => calls.push('first'));
    registry.add(() => calls.push('second'));

    registry.dispose();

    expect(calls).toEqual(['second', 'first']);
  });

  it('is idempotent', () => {
    const registry = new LifecycleRegistry();
    const cleanup = vi.fn();

    registry.add(cleanup);
    registry.dispose();
    registry.dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(registry.disposed).toBe(true);
  });

  it('runs cleanup immediately when added after disposal', () => {
    const registry = new LifecycleRegistry();
    const cleanup = vi.fn();

    registry.dispose();
    registry.add(cleanup);

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('disconnects tracked signals', () => {
    const registry = new LifecycleRegistry();
    const target = { disconnect: vi.fn() };
    const signalId = 42;

    registry.addSignal(
      () => target,
      () => signalId,
    );
    registry.dispose();

    expect(target.disconnect).toHaveBeenCalledWith(signalId);
  });

  it('removes tracked sources', () => {
    const registry = new LifecycleRegistry();
    const remove = vi.fn();
    const sourceId = 7;

    registry.addSource(() => sourceId, remove);
    registry.dispose();

    expect(remove).toHaveBeenCalledWith(sourceId);
  });

  it('cancels tracked cancellables', () => {
    const registry = new LifecycleRegistry();
    const cancellable = { cancel: vi.fn() };

    registry.addCancellable(() => cancellable);
    registry.dispose();

    expect(cancellable.cancel).toHaveBeenCalledOnce();
  });

  it('collects cleanup failures and still runs remaining cleanups', () => {
    const registry = new LifecycleRegistry();
    const cleanup = vi.fn();

    registry.add(cleanup);
    registry.add(() => {
      throw new Error('cleanup failed');
    });

    expect(() => registry.dispose()).toThrow(AggregateError);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
