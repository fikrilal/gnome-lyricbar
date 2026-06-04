/**
 * @typedef {'left' | 'center' | 'right'} PanelPosition
 * @typedef {'left' | 'center' | 'right'} TextAlign
 * @typedef {'track' | 'idle' | 'hidden'} FallbackMode
 * @typedef {'auto' | 'spotify' | 'youtube-music' | 'apple-music' | 'generic'} BrowserPlayerService
 * @typedef {'default' | 'system' | 'white' | 'black' | 'custom'} TextColorMode
 *
 * @typedef {Readonly<{
 *   panelPosition?: unknown,
 *   maxWidth?: unknown,
 *   textAlign?: unknown,
 *   fallbackMode?: unknown,
 *   showSettingsIcon?: unknown,
 *   playerPriority?: unknown,
 *   browserPlayerService?: unknown,
 *   cacheEnabled?: unknown,
 *   debugLogging?: unknown,
 *   textColorMode?: unknown,
 *   customTextColor?: unknown,
 *   textShadowEnabled?: unknown,
 * }>} RawSettings
 *
 * @typedef {Readonly<{
 *   panelPosition: PanelPosition,
 *   maxWidth: number,
 *   textAlign: TextAlign,
 *   fallbackMode: FallbackMode,
 *   showSettingsIcon: boolean,
 *   playerPriority: readonly string[],
 *   browserPlayerService: BrowserPlayerService,
 *   cacheEnabled: boolean,
 *   debugLogging: boolean,
 *   textColorMode: TextColorMode,
 *   customTextColor: string,
 *   textShadowEnabled: boolean,
 * }>} LyricBarSettings
 */

export {};
