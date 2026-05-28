/**
 * @typedef {'Playing' | 'Paused' | 'Stopped'} PlaybackStatus
 *
 * @typedef {Readonly<{
 *   busName: string,
 *   title: string,
 *   artist: string,
 *   album: string,
 *   durationMs: number | null,
 *   trackId: string | null,
 *   url: string | null,
 *   playbackStatus: PlaybackStatus,
 * }>} PlayerSnapshot
 */

export {};
