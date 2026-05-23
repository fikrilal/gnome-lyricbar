const TIMESTAMP_PATTERN = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    return [];
  }

  const lines = [];

  for (const rawLine of input.split(/\r?\n/)) {
    const timestamps = [...rawLine.matchAll(TIMESTAMP_PATTERN)];
    if (timestamps.length === 0) {
      continue;
    }

    const text = rawLine.replace(TIMESTAMP_PATTERN, '').trim();
    if (text === '') {
      continue;
    }

    for (const timestamp of timestamps) {
      const timeMs = parseTimestampMs(timestamp);
      if (timeMs === null) {
        continue;
      }

      lines.push({ timeMs, text });
    }
  }

  return lines.sort((left, right) => left.timeMs - right.timeMs);
}

export function selectLyricLine(lines, positionMs) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return null;
  }

  if (!Number.isFinite(positionMs) || positionMs < 0) {
    return null;
  }

  let current = null;
  for (const line of lines) {
    if (line.timeMs > positionMs) {
      break;
    }
    current = line;
  }

  return current;
}

function parseTimestampMs(match) {
  const minutes = Number.parseInt(match[1], 10);
  const seconds = Number.parseInt(match[2], 10);
  const fraction = match[3] ?? '0';

  if (!Number.isInteger(minutes) || !Number.isInteger(seconds) || seconds > 59) {
    return null;
  }

  const fractionMs = parseFractionMs(fraction);
  return (minutes * 60 + seconds) * 1000 + fractionMs;
}

function parseFractionMs(value) {
  if (value.length === 1) {
    return Number.parseInt(value, 10) * 100;
  }

  if (value.length === 2) {
    return Number.parseInt(value, 10) * 10;
  }

  return Number.parseInt(value.slice(0, 3), 10);
}
