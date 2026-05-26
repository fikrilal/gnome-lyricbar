import { buildLyricsQuery } from '../../domain/lyrics/normalize.js';
import { buildTrackIdentityKey } from '../../domain/lyrics/track-identity.js';
import { shouldWriteLyricsCache } from '../../domain/lyrics/cache-policy.js';

/**
 * @import { LifecycleRegistry } from '../lifecycle.js'
 * @import { RuntimeLogger } from '../logger.js'
 * @import { LyricsProviderResult, LyricsQuery } from '../../domain/lyrics/types.js'
 * @import { PlayerSnapshot } from '../../domain/mpris/types.js'
 * @import { BrowserPlayerService } from '../../domain/settings/types.js'
 *
 * @typedef {Readonly<{
 *   lookup(query: LyricsQuery, callback: (result: LyricsProviderResult) => void): void,
 * }>} ServiceProvider
 *
 * @typedef {Readonly<{
 *   get(query: LyricsQuery, callback: (result: LyricsProviderResult | null) => void): void,
 *   put(query: LyricsQuery, result: LyricsProviderResult): void,
 * }>} ServiceCache
 *
 * @typedef {(
 *   player: PlayerSnapshot | null,
 *   lookup: LyricsProviderResult | null,
 * ) => void} LyricsLookupListener
 */

export class LyricsService {
  /** @type {LifecycleRegistry} */
  #lifecycle;

  /** @type {ServiceProvider} */
  #provider;

  /** @type {ServiceCache} */
  #cache;

  /** @type {Set<LyricsLookupListener>} */
  #listeners = new Set();

  /** @type {boolean} */
  #enabled = true;

  /** @type {number} */
  #generation = 0;

  /** @type {string | null} */
  #currentKey = null;

  /** @type {PlayerSnapshot | null} */
  #currentPlayer = null;

  /** @type {LyricsProviderResult | null} */
  #currentLookup = null;

  /** @type {RuntimeLogger | null} */
  #logger = null;

  /** @type {() => BrowserPlayerService} */
  #getBrowserPlayerService;

  /**
   * @param {LifecycleRegistry} lifecycle
   * @param {ServiceProvider} provider
   * @param {ServiceCache} cache
   * @param {{
   *   logger?: RuntimeLogger | undefined,
   *   getBrowserPlayerService?: () => BrowserPlayerService,
   * }} [options]
   */
  constructor(lifecycle, provider, cache, options = {}) {
    this.#lifecycle = lifecycle;
    this.#provider = provider;
    this.#cache = cache;
    this.#logger = options.logger ?? null;
    this.#getBrowserPlayerService = options.getBrowserPlayerService ?? (() => 'auto');

    this.#lifecycle.add(() => {
      this.#logger?.debug('service-dispose');
      this.#enabled = false;
      this.#listeners.clear();
    });
  }

  /**
   * @param {PlayerSnapshot | null} player
   * @returns {void}
   */
  setActivePlayer(player) {
    if (!this.#enabled) {
      return;
    }

    const key = buildTrackIdentityKey(player, {
      browserPlayerService: this.#getBrowserPlayerService(),
    });

    if (key === this.#currentKey) {
      if (this.#sameSnapshot(player)) {
        return;
      }
      this.#currentPlayer = player;
      this.#logger?.debug('active-player-refresh', {
        busName: player?.busName ?? null,
        title: player?.title ?? null,
        playbackStatus: player?.playbackStatus ?? null,
      });
      this.#emit();
      return;
    }

    this.#generation += 1;
    const generation = this.#generation;
    this.#currentKey = key;
    this.#currentPlayer = player;
    this.#currentLookup = null;
    this.#logger?.debug('lookup-start', {
      busName: player?.busName ?? null,
      title: player?.title ?? null,
    });
    this.#emit();

    if (player === null || key === null) {
      this.#logger?.debug('lookup-skipped', { reason: 'no-active-player' });
      return;
    }

    const query = buildLyricsQuery({
      title: player.title,
      artist: player.artist,
      album: player.album,
      durationMs: player.durationMs,
    });

    if (query.title === '' || query.artist === '') {
      this.#logger?.debug('lookup-skipped', { reason: 'incomplete-metadata' });
      this.#applyResult(generation, key, Object.freeze({ kind: 'not-found' }));
      return;
    }

    this.#cache.get(query, (cached) => {
      if (!this.#shouldApply(generation, key)) {
        this.#logger?.debug('lookup-stale', { stage: 'cache' });
        return;
      }
      if (cached !== null) {
        this.#logger?.debug('cache-result', { kind: cached.kind, source: 'hit' });
        this.#applyResult(generation, key, cached);
        return;
      }
      this.#logger?.debug('cache-result', { source: 'miss' });
      this.#provider.lookup(query, (result) => {
        if (!this.#shouldApply(generation, key)) {
          this.#logger?.debug('lookup-stale', { stage: 'provider' });
          return;
        }
        if (
          shouldWriteLyricsCache(player, result, {
            browserPlayerService: this.#getBrowserPlayerService(),
          })
        ) {
          try {
            this.#cache.put(query, result);
          } catch {
            // best-effort; cache failure must not break the live emission
          }
        } else {
          this.#logger?.debug('cache-put-skipped', { reason: 'low-confidence-browser-miss' });
        }
        this.#logger?.debug('provider-result', { kind: result.kind });
        this.#applyResult(generation, key, result);
      });
    });
  }

  /**
   * @param {LyricsLookupListener} listener
   * @returns {void}
   */
  onLookupChanged(listener) {
    this.#listeners.add(listener);
    this.#lifecycle.add(() => {
      this.#listeners.delete(listener);
    });
    listener(this.#currentPlayer, this.#currentLookup);
  }

  /**
   * @returns {LyricsProviderResult | null}
   */
  currentLookup() {
    return this.#currentLookup;
  }

  /**
   * @returns {PlayerSnapshot | null}
   */
  currentPlayer() {
    return this.#currentPlayer;
  }

  /**
   * @param {number} generation
   * @param {string} key
   * @param {LyricsProviderResult} result
   * @returns {void}
   */
  #applyResult(generation, key, result) {
    if (!this.#shouldApply(generation, key)) {
      return;
    }
    this.#currentLookup = result;
    this.#emit();
  }

  /**
   * @param {number} generation
   * @param {string} key
   * @returns {boolean}
   */
  #shouldApply(generation, key) {
    return this.#enabled && this.#generation === generation && this.#currentKey === key;
  }

  /**
   * @param {PlayerSnapshot | null} player
   * @returns {boolean}
   */
  #sameSnapshot(player) {
    const current = this.#currentPlayer;
    if (player === null || current === null) {
      return player === current;
    }
    return (
      current.busName === player.busName &&
      current.title === player.title &&
      current.artist === player.artist &&
      current.album === player.album &&
      current.durationMs === player.durationMs &&
      current.trackId === player.trackId &&
      current.playbackStatus === player.playbackStatus
    );
  }

  /**
   * @returns {void}
   */
  #emit() {
    if (!this.#enabled) {
      return;
    }
    for (const listener of this.#listeners) {
      listener(this.#currentPlayer, this.#currentLookup);
    }
  }
}
