/**
 * @typedef {'track' | 'idle' | 'hidden'} FallbackMode
 *
 * @typedef {Readonly<{
 *   artist?: string | null,
 *   title?: string | null,
 * }>} DisplayTrack
 *
 * @typedef {Readonly<{
 *   kind: 'idle',
 * }>} IdleDisplayState
 *
 * @typedef {Readonly<{
 *   kind: 'loading',
 *   track?: DisplayTrack | null,
 * }>} LoadingDisplayState
 *
 * @typedef {Readonly<{
 *   kind: 'track',
 *   track: DisplayTrack,
 * }>} TrackDisplayState
 *
 * @typedef {Readonly<{
 *   kind: 'lyrics',
 *   line: string,
 *   track?: DisplayTrack | null,
 * }>} LyricsDisplayState
 *
 * @typedef {Readonly<{
 *   kind: 'hidden',
 * }>} HiddenDisplayState
 *
 * @typedef {Readonly<{
 *   kind: 'error',
 *   track?: DisplayTrack | null,
 * }>} ErrorDisplayState
 *
 * @typedef {
 *   | IdleDisplayState
 *   | LoadingDisplayState
 *   | TrackDisplayState
 *   | LyricsDisplayState
 *   | HiddenDisplayState
 *   | ErrorDisplayState
 * } DisplayState
 *
 * @typedef {Readonly<{
 *   text: string,
 *   visible: boolean,
 * }>} DisplayText
 */

export {};
