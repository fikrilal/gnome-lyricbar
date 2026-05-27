/**
 * @param {string} raw
 * @param {string} key
 * @returns {string | null}
 */
export function readStringProperty(raw, key) {
  const escapedKey = escapeRegExp(key);
  const prefix = `'${escapedKey}': <`;
  const singleQuoted = new RegExp(`${prefix}'([^']*)'>`, 'u').exec(raw);
  if (singleQuoted?.[1] !== undefined) {
    return singleQuoted[1];
  }

  const doubleQuoted = new RegExp(`${prefix}"((?:\\\\.|[^"\\\\])*)">`, 'u').exec(raw);
  if (doubleQuoted?.[1] === undefined) {
    return null;
  }

  return decodeDoubleQuotedGVariantString(doubleQuoted[1]);
}

/**
 * @param {string} value
 * @returns {string}
 */
function decodeDoubleQuotedGVariantString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value.replace(/\\(["\\])/gu, '$1');
  }
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
