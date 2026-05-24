# Privacy

LyricBar is a local GNOME Shell extension. It does not include telemetry, analytics, advertising identifiers, or account integration.

## Data Sources

LyricBar reads playback state from the local MPRIS session bus. MPRIS data can include:

- player bus name
- playback status
- track title
- artist
- album
- track duration
- playback position

This data is already exposed locally by the active media player to desktop integrations.

## Network Requests

LyricBar uses LRCLIB to look up synced lyrics. A lookup can send track metadata to LRCLIB, including:

- artist
- title
- album, when available
- duration, when available

LyricBar does not send Spotify account data, playlists, listening history, local usernames, or desktop screenshots.

## Cache

LyricBar caches lyric lookup results locally when `cache-enabled` is true. The cache is used to reduce repeat network lookups and improve startup behavior for tracks that have already been played.

Disable cache from preferences if local lyric metadata storage is not desired.

## Debug Logs

Debug logging is off by default. When enabled, LyricBar writes diagnostic GNOME Shell log messages that can include track titles, artists, player bus names, lookup outcomes, and selected lyric lines.

Use debug logging only while troubleshooting.

## Third Parties

Lyric lookup is provided by LRCLIB. Users should review LRCLIB's own policies before enabling network-backed lyric lookup in environments with strict privacy requirements.
