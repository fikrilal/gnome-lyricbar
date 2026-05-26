import { PLAYER_PROFILES } from './profile.js';

/**
 * @import { PlayerProfile, PlayerProfileId } from './profile.js'
 *
 * @typedef {Readonly<{
 *   debounceMetadataMs: number,
 *   advertisementRetentionMs: number,
 *   retainLastValidOnEmpty: boolean,
 *   retainLastValidOnAdvertisement: boolean,
 *   requireArtistForLookup: boolean,
 *   pollPositionWhenSynced: boolean,
 * }>} PlayerProfilePolicy
 */

const DESKTOP_POLICY = Object.freeze({
  debounceMetadataMs: 0,
  advertisementRetentionMs: 0,
  retainLastValidOnEmpty: false,
  retainLastValidOnAdvertisement: false,
  requireArtistForLookup: true,
  pollPositionWhenSynced: true,
});

const BROWSER_POLICY = Object.freeze({
  debounceMetadataMs: 350,
  advertisementRetentionMs: 2000,
  retainLastValidOnEmpty: true,
  retainLastValidOnAdvertisement: true,
  requireArtistForLookup: true,
  pollPositionWhenSynced: true,
});

const GENERIC_POLICY = Object.freeze({
  debounceMetadataMs: 0,
  advertisementRetentionMs: 0,
  retainLastValidOnEmpty: false,
  retainLastValidOnAdvertisement: false,
  requireArtistForLookup: true,
  pollPositionWhenSynced: true,
});

/** @type {Readonly<Record<PlayerProfileId, PlayerProfilePolicy>>} */
export const PLAYER_PROFILE_POLICIES = Object.freeze({
  [PLAYER_PROFILES.spotifyDesktop.id]: DESKTOP_POLICY,
  [PLAYER_PROFILES.spotifyWeb.id]: BROWSER_POLICY,
  [PLAYER_PROFILES.youtubeMusicWeb.id]: BROWSER_POLICY,
  [PLAYER_PROFILES.chromiumBrowser.id]: BROWSER_POLICY,
  [PLAYER_PROFILES.firefoxBrowser.id]: BROWSER_POLICY,
  [PLAYER_PROFILES.genericMpris.id]: GENERIC_POLICY,
});

/**
 * @param {PlayerProfile | null | undefined} profile
 * @returns {PlayerProfilePolicy}
 */
export function policyForPlayerProfile(profile) {
  if (profile === null || profile === undefined) {
    return GENERIC_POLICY;
  }

  return PLAYER_PROFILE_POLICIES[profile.id] ?? GENERIC_POLICY;
}
