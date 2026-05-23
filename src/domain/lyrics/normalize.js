export function normalizeTrackText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function buildLyricsQuery(metadata) {
  return {
    artist: normalizeTrackText(metadata?.artist),
    title: normalizeTrackText(metadata?.title),
    album: normalizeTrackText(metadata?.album),
    durationMs: Number.isFinite(metadata?.durationMs) ? metadata.durationMs : null,
  };
}
