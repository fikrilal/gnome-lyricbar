/**
 * @typedef {'left' | 'center' | 'right'} PanelPosition
 * @typedef {'track' | 'idle' | 'hidden'} FallbackMode
 *
 * @typedef {Readonly<{
 *   panelPosition?: unknown,
 *   maxWidth?: unknown,
 *   fallbackMode?: unknown,
 *   playerPriority?: unknown,
 *   cacheEnabled?: unknown,
 *   debugLogging?: unknown,
 * }>} RawSettings
 *
 * @typedef {Readonly<{
 *   panelPosition: PanelPosition,
 *   maxWidth: number,
 *   fallbackMode: FallbackMode,
 *   playerPriority: readonly string[],
 *   cacheEnabled: boolean,
 *   debugLogging: boolean,
 * }>} LyricBarSettings
 */

export {};
