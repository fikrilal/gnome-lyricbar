import { parseLrclibResponse } from '../../domain/lyrics/provider-result.js';

/**
 * @import { LyricsProviderResult } from '../../domain/lyrics/types.js'
 *
 * @typedef {Readonly<{
 *   statusCode?: number | null,
 *   body?: string | null,
 *   error?: string | null,
 *   timedOut?: boolean,
 * }>} HttpResult
 */

/**
 * @param {HttpResult} result
 * @returns {LyricsProviderResult}
 */
export function mapHttpResultToProviderResult(result) {
  if (result.timedOut === true) {
    return error('request timed out');
  }

  const transportError = readError(result);
  if (transportError !== null) {
    return error(transportError);
  }

  const status = readStatus(result);
  if (status === null) {
    return error('missing http status');
  }

  if (status === 404) {
    return Object.freeze({ kind: 'not-found' });
  }

  if (status >= 400) {
    return error(`status ${status}`);
  }

  if (status < 200 || status >= 300) {
    return error(`status ${status}`);
  }

  const body = readBody(result);
  if (body === null) {
    return error('empty response body');
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (parseError) {
    return error(`invalid json: ${describeError(parseError)}`);
  }

  return parseLrclibResponse(parsed);
}

/**
 * @param {HttpResult} result
 * @returns {number | null}
 */
function readStatus(result) {
  const status = result.statusCode;
  return typeof status === 'number' && Number.isFinite(status) ? status : null;
}

/**
 * @param {HttpResult} result
 * @returns {string | null}
 */
function readBody(result) {
  return typeof result.body === 'string' && result.body !== '' ? result.body : null;
}

/**
 * @param {HttpResult} result
 * @returns {string | null}
 */
function readError(result) {
  return typeof result.error === 'string' && result.error !== '' ? result.error : null;
}

/**
 * @param {string} reason
 * @returns {LyricsProviderResult}
 */
function error(reason) {
  return Object.freeze({ kind: 'error', reason });
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function describeError(value) {
  if (value instanceof Error) {
    return value.message;
  }
  return String(value);
}
