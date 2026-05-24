/**
 * @typedef {Readonly<{
 *   timeMs: number,
 *   text: string,
 * }>} LyricLine
 *
 * @typedef {Readonly<{
 *   artist?: string | null,
 *   title?: string | null,
 *   album?: string | null,
 *   durationMs?: number | null,
 * }>} TrackMetadataInput
 *
 * @typedef {Readonly<{
 *   artist: string,
 *   title: string,
 *   album: string,
 *   durationMs: number | null,
 * }>} LyricsQuery
 *
 * @typedef {Readonly<{
 *   trackName: string,
 *   artistName: string,
 *   albumName: string,
 *   durationMs: number | null,
 * }>} ProviderTrackInfo
 *
 * @typedef {Readonly<{
 *   kind: 'synced',
 *   track: ProviderTrackInfo,
 *   lines: readonly LyricLine[],
 *   plainText: string,
 * }>} SyncedLyricsResult
 *
 * @typedef {Readonly<{
 *   kind: 'plain',
 *   track: ProviderTrackInfo,
 *   text: string,
 * }>} PlainLyricsResult
 *
 * @typedef {Readonly<{
 *   kind: 'instrumental',
 *   track: ProviderTrackInfo,
 * }>} InstrumentalResult
 *
 * @typedef {Readonly<{
 *   kind: 'not-found',
 * }>} NotFoundResult
 *
 * @typedef {Readonly<{
 *   kind: 'error',
 *   reason: string,
 * }>} ProviderErrorResult
 *
 * @typedef {
 *   | SyncedLyricsResult
 *   | PlainLyricsResult
 *   | InstrumentalResult
 *   | NotFoundResult
 *   | ProviderErrorResult
 * } LyricsProviderResult
 */

export {};
