#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

import { readStringProperty } from './lib/gdbus-output.mjs';

const MPRIS_PREFIX = 'org.mpris.MediaPlayer2.';
const PLAYER_OBJECT_PATH = '/org/mpris/MediaPlayer2';
const PLAYER_INTERFACE = 'org.mpris.MediaPlayer2.Player';
const ROOT_INTERFACE = 'org.mpris.MediaPlayer2';
const POSITION_SAMPLE_COUNT = 5;
const POSITION_SAMPLE_INTERVAL_MS = 500;
const LYRICBAR_LOG_LIMIT = 80;

/** @type {string[]} */
const report = [];

section('LyricBar MPRIS Inspection');
line(`Timestamp: ${new Date().toISOString()}`);
line(`Node: ${process.version}`);
line('');

const shellVersion = runCommand('gnome-shell', ['--version']);
line(`GNOME Shell: ${singleLine(shellVersion)}`);

const extensionInfo = runCommand('gnome-extensions', ['info', 'lyricbar@fikrilal.github.io']);
line('Extension:');
block(extensionInfo.ok ? extensionInfo.stdout.trim() : extensionInfo.stderr.trim());

const busNames = listMprisBusNames();
section('MPRIS Players');
if (busNames.length === 0) {
  line('No MPRIS players found on the session bus.');
} else {
  for (const busName of busNames) {
    inspectPlayer(busName);
  }
}

section('Recent LyricBar Logs');
const logs = recentLyricBarLogs();
block(logs === '' ? 'No recent LyricBar logs found in the current user boot.' : logs);

process.stdout.write(`${report.join('\n')}\n`);

/**
 * @returns {string[]}
 */
function listMprisBusNames() {
  const result = runCommand('gdbus', [
    'call',
    '--session',
    '--dest',
    'org.freedesktop.DBus',
    '--object-path',
    '/org/freedesktop/DBus',
    '--method',
    'org.freedesktop.DBus.ListNames',
  ]);

  if (!result.ok) {
    section('D-Bus Error');
    block(result.stderr.trim() || result.stdout.trim() || 'Unable to list session bus names.');
    return [];
  }

  return [...result.stdout.matchAll(/'([^']+)'/gu)]
    .map((match) => match.at(1) ?? '')
    .filter((name) => name.startsWith(MPRIS_PREFIX))
    .sort((left, right) => left.localeCompare(right));
}

/**
 * @param {string} busName
 * @returns {void}
 */
function inspectPlayer(busName) {
  section(busName);

  const root = getAllProperties(busName, ROOT_INTERFACE);
  const player = getAllProperties(busName, PLAYER_INTERFACE);

  line('Root properties:');
  block(root);

  line('Player properties:');
  block(player);

  line('Normalized snapshot:');
  block(formatSnapshot(busName, player));

  line('Position samples:');
  block(positionSamples(busName));
}

/**
 * @param {string} busName
 * @param {string} interfaceName
 * @returns {string}
 */
function getAllProperties(busName, interfaceName) {
  const result = runCommand('gdbus', [
    'call',
    '--session',
    '--dest',
    busName,
    '--object-path',
    PLAYER_OBJECT_PATH,
    '--method',
    'org.freedesktop.DBus.Properties.GetAll',
    interfaceName,
  ]);

  if (!result.ok) {
    return result.stderr.trim() || result.stdout.trim() || 'Unable to read properties.';
  }

  return result.stdout.trim();
}

/**
 * @param {string} busName
 * @param {string} raw
 * @returns {string}
 */
function formatSnapshot(busName, raw) {
  const title = readStringProperty(raw, 'xesam:title');
  const artist = readArrayProperty(raw, 'xesam:artist');
  const album = readStringProperty(raw, 'xesam:album');
  const status = readStringProperty(raw, 'PlaybackStatus');
  const lengthUs = readIntegerProperty(raw, 'mpris:length');
  const positionUs = readIntegerProperty(raw, 'Position');
  const trackId = readTrackIdProperty(raw);
  const url = readStringProperty(raw, 'xesam:url');
  const artUrl = readStringProperty(raw, 'mpris:artUrl');

  return [
    `title=${title ?? ''}`,
    `artist=${artist.join(', ')}`,
    `album=${album ?? ''}`,
    `playbackStatus=${status ?? ''}`,
    `durationMs=${lengthUs === null ? '' : Math.round(lengthUs / 1000)}`,
    `positionMs=${positionUs === null ? '' : Math.round(positionUs / 1000)}`,
    `trackId=${trackId ?? ''}`,
    `url=${url ?? ''}`,
    `artUrl=${artUrl ?? ''}`,
    `inferredProfile=${inferProfile({
      busName,
      title,
      artist,
      durationUs: lengthUs,
      trackId,
      status,
    })}`,
  ].join('\n');
}

/**
 * @param {string} busName
 * @returns {string}
 */
function positionSamples(busName) {
  /** @type {string[]} */
  const samples = [];
  for (let index = 0; index < POSITION_SAMPLE_COUNT; index += 1) {
    const raw = getAllProperties(busName, PLAYER_INTERFACE);
    const positionUs = readIntegerProperty(raw, 'Position');
    const status = readStringProperty(raw, 'PlaybackStatus');
    samples.push(
      `${index + 1}. status=${status ?? ''} positionMs=${
        positionUs === null ? '' : Math.round(positionUs / 1000)
      }`,
    );
    if (index < POSITION_SAMPLE_COUNT - 1) {
      sleep(POSITION_SAMPLE_INTERVAL_MS);
    }
  }
  return samples.join('\n');
}

/**
 * @returns {string}
 */
function recentLyricBarLogs() {
  const result = runCommand('journalctl', ['--user', '-b', '--no-pager', '-n', '500']);
  if (!result.ok) {
    return result.stderr.trim() || result.stdout.trim();
  }

  return result.stdout
    .split('\n')
    .filter((entry) => /LyricBar|lyricbar/u.test(entry))
    .slice(-LYRICBAR_LOG_LIMIT)
    .join('\n')
    .trim();
}

/**
 * @param {{
 *   busName: string,
 *   title: string | null,
 *   artist: readonly string[],
 *   durationUs: number | null,
 *   trackId: string | null,
 *   status: string | null,
 * }} snapshot
 * @returns {string}
 */
function inferProfile(snapshot) {
  const appName = snapshot.busName.slice(MPRIS_PREFIX.length).toLowerCase();
  if (appName === 'spotify') {
    return 'spotify-desktop';
  }

  const isBrowser =
    appName === 'chromium' ||
    appName.startsWith('chromium.') ||
    appName === 'firefox' ||
    appName.startsWith('firefox.');
  if (!isBrowser) {
    return 'generic-mpris';
  }

  const trackId = snapshot.trackId?.toLowerCase() ?? '';
  if (trackId.includes('spotify')) {
    return 'spotify-web';
  }

  const hasMusicMetadata =
    snapshot.title !== null &&
    snapshot.title.trim() !== '' &&
    snapshot.title.trim().toLowerCase() !== 'advertisement' &&
    snapshot.artist.length > 0 &&
    snapshot.status !== 'Stopped' &&
    (snapshot.durationUs === null || snapshot.durationUs >= 30_000_000);

  return hasMusicMetadata
    ? 'browser music metadata (spotify-web when browser-player-service=spotify)'
    : 'browser';
}

/**
 * @param {string} raw
 * @param {string} key
 * @returns {string[]}
 */
function readArrayProperty(raw, key) {
  const escapedKey = escapeRegExp(key);
  const match = new RegExp(`'${escapedKey}': <\\[([^\\]]*)\\]>`, 'u').exec(raw);
  if (match?.[1] === undefined) {
    return [];
  }

  return [...match[1].matchAll(/'([^']*)'/gu)].map((entry) => entry.at(1) ?? '');
}

/**
 * @param {string} raw
 * @param {string} key
 * @returns {number | null}
 */
function readIntegerProperty(raw, key) {
  const escapedKey = escapeRegExp(key);
  const match = new RegExp(`'${escapedKey}': <(?:int64|uint64) ([0-9]+)>`, 'u').exec(raw);
  if (match?.[1] === undefined) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

/**
 * @param {string} raw
 * @returns {string | null}
 */
function readTrackIdProperty(raw) {
  return readObjectPathProperty(raw, 'mpris:trackid') ?? readStringProperty(raw, 'mpris:trackid');
}

/**
 * @param {string} raw
 * @param {string} key
 * @returns {string | null}
 */
function readObjectPathProperty(raw, key) {
  const escapedKey = escapeRegExp(key);
  const match = new RegExp(`'${escapedKey}': <objectpath '([^']*)'>`, 'u').exec(raw);
  return match?.[1] ?? null;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * @param {string} command
 * @param {readonly string[]} args
 * @returns {{ ok: boolean, stdout: string, stderr: string, status: number | null }}
 */
function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
  });

  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

/**
 * @param {{ ok: boolean, stdout: string, stderr: string }} result
 * @returns {string}
 */
function singleLine(result) {
  if (result.ok) {
    return result.stdout.trim() || 'unknown';
  }
  return result.stderr.trim() || result.stdout.trim() || 'unavailable';
}

/**
 * @param {number} ms
 * @returns {void}
 */
function sleep(ms) {
  spawnSync('sleep', [String(ms / 1000)]);
}

/**
 * @param {string} title
 * @returns {void}
 */
function section(title) {
  line('');
  line(`## ${title}`);
}

/**
 * @param {string} value
 * @returns {void}
 */
function block(value) {
  const trimmed = value.trim();
  if (trimmed === '') {
    line('(empty)');
    return;
  }

  for (const entry of trimmed.split('\n')) {
    line(`  ${entry}`);
  }
}

/**
 * @param {string} value
 * @returns {void}
 */
function line(value) {
  report.push(value);
}
