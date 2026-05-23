/**
 * @typedef {() => void} CleanupFn
 *
 * @typedef {Readonly<{
 *   dispose(): void,
 * }>} Disposable
 */

export class LifecycleRegistry {
  /** @type {Array<CleanupFn | Disposable>} */
  #cleanups = [];

  /** @type {boolean} */
  #disposed = false;

  /**
   * @returns {boolean}
   */
  get disposed() {
    return this.#disposed;
  }

  /**
   * @param {CleanupFn | Disposable} cleanup
   * @returns {void}
   */
  add(cleanup) {
    if (this.#disposed) {
      runCleanup(cleanup);
      return;
    }

    this.#cleanups.push(cleanup);
  }

  /**
   * @param {() => number | null | undefined} readId
   * @param {(id: number) => void} remove
   * @returns {void}
   */
  addSource(readId, remove) {
    this.add(() => {
      const id = readId();
      if (typeof id === 'number' && id > 0) {
        remove(id);
      }
    });
  }

  /**
   * @param {() => number | null | undefined} readId
   * @param {(id: number) => void} remove
   * @returns {void}
   */
  addBusWatch(readId, remove) {
    this.addSource(readId, remove);
  }

  /**
   * @param {() => unknown | null | undefined} readTarget
   * @param {() => number | string | null | undefined} readSignalId
   * @returns {void}
   */
  addSignal(readTarget, readSignalId) {
    this.add(() => {
      const target = readTarget();
      const signalId = readSignalId();
      if (target && signalId !== null && signalId !== undefined && hasDisconnect(target)) {
        target.disconnect(signalId);
      }
    });
  }

  /**
   * @param {() => unknown | null | undefined} readCancellable
   * @returns {void}
   */
  addCancellable(readCancellable) {
    this.add(() => {
      const cancellable = readCancellable();
      if (cancellable && hasCancel(cancellable)) {
        cancellable.cancel();
      }
    });
  }

  /**
   * @returns {void}
   */
  dispose() {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    const cleanups = this.#cleanups.splice(0).reverse();
    const errors = [];

    for (const cleanup of cleanups) {
      try {
        runCleanup(cleanup);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Lifecycle cleanup failed');
    }
  }
}

/**
 * @param {CleanupFn | Disposable} cleanup
 * @returns {void}
 */
function runCleanup(cleanup) {
  if (typeof cleanup === 'function') {
    cleanup();
    return;
  }

  cleanup.dispose();
}

/**
 * @param {unknown} value
 * @returns {value is { disconnect(id: number | string): void }}
 */
function hasDisconnect(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'disconnect' in value &&
    typeof value.disconnect === 'function'
  );
}

/**
 * @param {unknown} value
 * @returns {value is { cancel(): void }}
 */
function hasCancel(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'cancel' in value &&
    typeof value.cancel === 'function'
  );
}
