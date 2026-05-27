/**
 * @typedef {'left' | 'center' | 'right'} PanelPosition
 * @typedef {'left' | 'center' | 'right'} TextAlign
 * @typedef {'track' | 'idle' | 'hidden'} FallbackMode
 * @typedef {'auto' | 'spotify' | 'youtube-music' | 'apple-music' | 'generic'} BrowserPlayerService
 *
 * @typedef {Readonly<{
 *   panelPosition?: unknown,
 *   maxWidth?: unknown,
 *   textAlign?: unknown,
 *   fallbackMode?: unknown,
 *   playerPriority?: unknown,
 *   browserPlayerService?: unknown,
 *   cacheEnabled?: unknown,
 *   debugLogging?: unknown,
 * }>} RawSettings
 *
 * @typedef {Readonly<{
 *   panelPosition: PanelPosition,
 *   maxWidth: number,
 *   textAlign: TextAlign,
 *   fallbackMode: FallbackMode,
 *   playerPriority: readonly string[],
 *   browserPlayerService: BrowserPlayerService,
 *   cacheEnabled: boolean,
 *   debugLogging: boolean,
 * }>} LyricBarSettings
 */

export {};
