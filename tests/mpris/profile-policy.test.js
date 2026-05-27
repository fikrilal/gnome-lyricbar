import { describe, expect, it } from 'vitest';

import { PLAYER_PROFILES } from '../../src/domain/mpris/profile.js';
import {
  PLAYER_PROFILE_POLICIES,
  policyForPlayerProfile,
} from '../../src/domain/mpris/profile-policy.js';

describe('policyForPlayerProfile', () => {
  it('uses immediate metadata policy for Spotify Desktop', () => {
    expect(policyForPlayerProfile(PLAYER_PROFILES.spotifyDesktop)).toEqual({
      debounceMetadataMs: 0,
      advertisementRetentionMs: 0,
      retainLastValidOnEmpty: false,
      retainLastValidOnAdvertisement: false,
      requireArtistForLookup: true,
      pollPositionWhenSynced: true,
    });
  });

  it('uses stabilizing metadata policy for Chromium browser players', () => {
    expect(policyForPlayerProfile(PLAYER_PROFILES.chromiumBrowser)).toEqual({
      debounceMetadataMs: 350,
      advertisementRetentionMs: 2000,
      retainLastValidOnEmpty: true,
      retainLastValidOnAdvertisement: true,
      requireArtistForLookup: true,
      pollPositionWhenSynced: true,
    });
  });

  it('uses stabilizing metadata policy for Spotify Web players', () => {
    expect(policyForPlayerProfile(PLAYER_PROFILES.spotifyWeb)).toEqual(
      policyForPlayerProfile(PLAYER_PROFILES.chromiumBrowser),
    );
  });

  it('uses stabilizing metadata policy for YouTube Music Web players', () => {
    expect(policyForPlayerProfile(PLAYER_PROFILES.youtubeMusicWeb)).toEqual(
      policyForPlayerProfile(PLAYER_PROFILES.chromiumBrowser),
    );
  });

  it('uses stabilizing metadata policy for Apple Music Web players', () => {
    expect(policyForPlayerProfile(PLAYER_PROFILES.appleMusicWeb)).toEqual(
      policyForPlayerProfile(PLAYER_PROFILES.chromiumBrowser),
    );
  });

  it('uses stabilizing metadata policy for Firefox browser players', () => {
    expect(policyForPlayerProfile(PLAYER_PROFILES.firefoxBrowser)).toEqual(
      policyForPlayerProfile(PLAYER_PROFILES.chromiumBrowser),
    );
  });

  it('uses conservative generic policy for unknown or missing profiles', () => {
    expect(policyForPlayerProfile(PLAYER_PROFILES.genericMpris)).toEqual({
      debounceMetadataMs: 0,
      advertisementRetentionMs: 0,
      retainLastValidOnEmpty: false,
      retainLastValidOnAdvertisement: false,
      requireArtistForLookup: true,
      pollPositionWhenSynced: true,
    });
    expect(policyForPlayerProfile(null)).toEqual(
      policyForPlayerProfile(PLAYER_PROFILES.genericMpris),
    );
    expect(policyForPlayerProfile(undefined)).toEqual(
      policyForPlayerProfile(PLAYER_PROFILES.genericMpris),
    );
  });

  it('exposes policies for every known profile id', () => {
    for (const profile of Object.values(PLAYER_PROFILES)) {
      expect(PLAYER_PROFILE_POLICIES).toHaveProperty(profile.id);
    }
  });
});
