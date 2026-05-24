#!/usr/bin/env bash
set -euo pipefail

readonly EXTENSION_UUID="lyricbar@fikrilal.github.io"
readonly REPOSITORY="fikrilal/gnome-lyricbar"
readonly ASSET_NAME="${EXTENSION_UUID}.zip"
readonly DEFAULT_VERSION="latest"
readonly EXTENSION_DIR="${HOME}/.local/share/gnome-shell/extensions/${EXTENSION_UUID}"
readonly SUPPORTED_SHELL_MAJOR_VERSIONS="46 47 48 49"

VERSION="${LYRICBAR_VERSION:-${1:-$DEFAULT_VERSION}}"

if [[ "$VERSION" == "latest" ]]; then
  DOWNLOAD_URL="https://github.com/${REPOSITORY}/releases/latest/download/${ASSET_NAME}"
else
  DOWNLOAD_URL="https://github.com/${REPOSITORY}/releases/download/${VERSION}/${ASSET_NAME}"
fi

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'LyricBar install failed: required command not found: %s\n' "$command_name" >&2
    exit 1
  fi
}

download_file() {
  local url="$1"
  local output_path="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 3 --connect-timeout 20 --output "$output_path" "$url"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -O "$output_path" "$url"
    return
  fi

  printf 'LyricBar install failed: curl or wget is required for download.\n' >&2
  exit 1
}

require_command gnome-shell
require_command gnome-extensions
require_command gsettings

shell_version="$(gnome-shell --version 2>/dev/null || true)"
shell_major_version="$(printf '%s\n' "$shell_version" | sed -nE 's/^GNOME Shell ([0-9]+).*/\1/p')"

if [[ -z "$shell_major_version" ]]; then
  printf 'LyricBar could not detect the GNOME Shell major version. Detected: %s\n' "${shell_version:-unknown}" >&2
  printf 'Continuing anyway; install may fail if this GNOME Shell version is unsupported.\n' >&2
elif [[ " ${SUPPORTED_SHELL_MAJOR_VERSIONS} " != *" ${shell_major_version} "* ]]; then
  printf 'LyricBar supports GNOME Shell %s. Detected: %s\n' "$SUPPORTED_SHELL_MAJOR_VERSIONS" "$shell_version" >&2
  printf 'Continuing anyway; untested GNOME Shell versions may fail.\n' >&2
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

zip_path="${tmp_dir}/${ASSET_NAME}"

printf 'Downloading LyricBar %s...\n' "$VERSION"
download_file "$DOWNLOAD_URL" "$zip_path"

gsettings_has_key() {
  local schema="$1"
  local key="$2"

  gsettings list-keys "$schema" 2>/dev/null | grep -qx "$key"
}

add_extension_to_gsettings_array() {
  local schema="$1"
  local key="$2"
  local uuid="$3"
  local current_value
  local next_value

  current_value="$(gsettings get "$schema" "$key")"
  next_value="$(
    CURRENT_VALUE="$current_value" EXTENSION_UUID="$uuid" python3 - <<'PY'
import ast
import os

current = os.environ["CURRENT_VALUE"].strip()
uuid = os.environ["EXTENSION_UUID"]

if current in {"", "@as []", "[]"}:
    values = []
else:
    values = ast.literal_eval(current.removeprefix("@as "))

if uuid not in values:
    values.append(uuid)

print("[" + ", ".join(repr(value) for value in values) + "]")
PY
  )"

  gsettings set "$schema" "$key" "$next_value"
}

remove_extension_from_gsettings_array() {
  local schema="$1"
  local key="$2"
  local uuid="$3"
  local current_value
  local next_value

  current_value="$(gsettings get "$schema" "$key")"
  next_value="$(
    CURRENT_VALUE="$current_value" EXTENSION_UUID="$uuid" python3 - <<'PY'
import ast
import os

current = os.environ["CURRENT_VALUE"].strip()
uuid = os.environ["EXTENSION_UUID"]

if current in {"", "@as []", "[]"}:
    values = []
else:
    values = ast.literal_eval(current.removeprefix("@as "))

values = [value for value in values if value != uuid]

print("[" + ", ".join(repr(value) for value in values) + "]")
PY
  )"

  gsettings set "$schema" "$key" "$next_value"
}

pre_enable_extension_for_next_login() {
  if ! command -v python3 >/dev/null 2>&1; then
    printf 'LyricBar warning: python3 is unavailable, so installer cannot pre-enable the extension for next login.\n' >&2
    return 1
  fi

  if gsettings_has_key org.gnome.shell disable-user-extensions; then
    gsettings set org.gnome.shell disable-user-extensions false || true
  fi

  add_extension_to_gsettings_array org.gnome.shell enabled-extensions "$EXTENSION_UUID" || return 1

  if gsettings_has_key org.gnome.shell disabled-extensions; then
    remove_extension_from_gsettings_array org.gnome.shell disabled-extensions "$EXTENSION_UUID" || return 1
  fi
}

if gnome-extensions info "$EXTENSION_UUID" >/dev/null 2>&1; then
  gnome-extensions disable "$EXTENSION_UUID" >/dev/null 2>&1 || true
fi

printf 'Installing %s...\n' "$EXTENSION_UUID"
gnome-extensions install --force "$zip_path"

if [[ ! -d "$EXTENSION_DIR" ]]; then
  printf '\nLyricBar install failed: expected extension directory was not created:\n' >&2
  printf '  %s\n' "$EXTENSION_DIR" >&2
  exit 1
fi

pre_enabled_for_next_login=false
if pre_enable_extension_for_next_login; then
  pre_enabled_for_next_login=true
fi

for _ in 1 2 3 4 5; do
  if gnome-extensions info "$EXTENSION_UUID" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if gnome-extensions info "$EXTENSION_UUID" >/dev/null 2>&1; then
  if gnome-extensions enable "$EXTENSION_UUID"; then
    printf '\nLyricBar installed and enabled.\n'
  else
    printf '\nLyricBar installed, but GNOME Shell did not enable it automatically.\n'
    if [[ "$pre_enabled_for_next_login" == "true" ]]; then
      printf 'Log out and log back in; LyricBar should start automatically.\n'
    else
      printf 'Log out and log back in, then run:\n'
      printf '  gnome-extensions enable %s\n' "$EXTENSION_UUID"
    fi
  fi
else
  printf '\nLyricBar installed, but GNOME Shell has not registered it yet.\n'
  if [[ "$pre_enabled_for_next_login" == "true" ]]; then
    printf 'Log out and log back in; LyricBar should start automatically.\n'
  else
    printf 'Log out and log back in, then run:\n'
    printf '  gnome-extensions enable %s\n' "$EXTENSION_UUID"
  fi
fi

printf 'Open preferences with:\n'
printf '  gnome-extensions prefs %s\n' "$EXTENSION_UUID"
