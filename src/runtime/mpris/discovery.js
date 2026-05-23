const MPRIS_BUS_PREFIX = 'org.mpris.MediaPlayer2.';

/**
 * @typedef {Readonly<{
 *   name: string,
 *   oldOwner: string,
 *   newOwner: string,
 * }>} NameOwnerChange
 *
 * @typedef {Readonly<{
 *   added: readonly string[],
 *   removed: readonly string[],
 * }>} BusNameDiff
 */

/**
 * @param {unknown} name
 * @returns {name is string}
 */
export function isMprisBusName(name) {
  return (
    typeof name === 'string' &&
    name.startsWith(MPRIS_BUS_PREFIX) &&
    name.length > MPRIS_BUS_PREFIX.length
  );
}

/**
 * @param {readonly unknown[] | null | undefined} names
 * @returns {string[]}
 */
export function filterMprisNames(names) {
  if (!Array.isArray(names)) {
    return [];
  }

  /** @type {string[]} */
  const filtered = [];
  for (const name of names) {
    if (isMprisBusName(name)) {
      filtered.push(name);
    }
  }
  return filtered;
}

/**
 * @param {ReadonlySet<string>} previous
 * @param {ReadonlySet<string>} current
 * @returns {BusNameDiff}
 */
export function diffBusNames(previous, current) {
  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const removed = [];

  for (const name of current) {
    if (!previous.has(name)) {
      added.push(name);
    }
  }
  for (const name of previous) {
    if (!current.has(name)) {
      removed.push(name);
    }
  }

  added.sort((left, right) => left.localeCompare(right));
  removed.sort((left, right) => left.localeCompare(right));

  return { added, removed };
}

/**
 * @param {ReadonlySet<string>} current
 * @param {NameOwnerChange} change
 * @returns {Set<string> | null}
 */
export function applyNameOwnerChange(current, change) {
  if (!isMprisBusName(change.name)) {
    return null;
  }

  const hasNewOwner = typeof change.newOwner === 'string' && change.newOwner !== '';
  const present = current.has(change.name);

  if (hasNewOwner && !present) {
    const next = new Set(current);
    next.add(change.name);
    return next;
  }

  if (!hasNewOwner && present) {
    const next = new Set(current);
    next.delete(change.name);
    return next;
  }

  return null;
}
