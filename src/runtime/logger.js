/**
 * @typedef {string | number | boolean | null | undefined} LogValue
 * @typedef {Readonly<Record<string, LogValue>>} LogFields
 * @typedef {(message: string) => void} LogSink
 */

/**
 * Runtime debug logger for GNOME Shell execution.
 *
 * Debug messages are intentionally disabled by default and controlled by a
 * settings-backed callback so a setting flip affects all existing runtime
 * services without rebuilding them.
 */
export class RuntimeLogger {
  /** @type {string} */
  #namespace;

  /** @type {() => boolean} */
  #readEnabled;

  /** @type {LogSink} */
  #sink;

  /**
   * @param {string} namespace
   * @param {() => boolean} readEnabled
   * @param {LogSink} [sink]
   */
  constructor(namespace, readEnabled, sink = defaultSink) {
    this.#namespace = namespace;
    this.#readEnabled = readEnabled;
    this.#sink = sink;
  }

  /**
   * @param {string} scope
   * @returns {RuntimeLogger}
   */
  child(scope) {
    return new RuntimeLogger(`${this.#namespace}:${scope}`, this.#readEnabled, this.#sink);
  }

  /**
   * @param {string} event
   * @param {LogFields} [fields]
   * @returns {void}
   */
  debug(event, fields = {}) {
    if (!this.#readEnabled()) {
      return;
    }

    this.#sink(formatMessage(this.#namespace, event, fields));
  }
}

/**
 * @param {string} namespace
 * @param {string} event
 * @param {LogFields} fields
 * @returns {string}
 */
function formatMessage(namespace, event, fields) {
  const suffix = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(' ');

  return suffix === '' ? `${namespace} ${event}` : `${namespace} ${event} ${suffix}`;
}

/**
 * @param {LogValue} value
 * @returns {string}
 */
function formatValue(value) {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * @param {string} message
 * @returns {void}
 */
function defaultSink(message) {
  const shellLog = Reflect.get(globalThis, 'log');
  if (typeof shellLog === 'function') {
    shellLog(message);
    return;
  }

  console.warn(message);
}
