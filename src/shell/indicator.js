import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

/**
 * @import { IndicatorViewModel } from '../domain/display/view-model.js'
 */

class LyricBarIndicatorBase extends PanelMenu.Button {
  /** @override */
  _init() {
    super._init(0.0, 'LyricBar');

    this._preferencesAction = null;
    this._preferencesButtonPressId = 0;

    this._lyricBarBox = new St.BoxLayout({
      style_class: 'panel-status-indicators-box lyricbar-container',
    });
    this._lyricBarBin = new St.Bin({
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._lyricBarLabel = new St.Label({
      text: '',
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'lyricbar-label',
    });
    setSingleLineMode(this._lyricBarLabel);

    this._lyricBarBin.set_child(this._lyricBarLabel);
    this._lyricBarBox.add_child(this._lyricBarBin);
    this.add_child(this._lyricBarBox);
    this.label_actor = this._lyricBarLabel;
  }

  /**
   * @param {IndicatorViewModel} viewModel
   * @returns {void}
   */
  render(viewModel) {
    if (!this._lyricBarLabel) {
      return;
    }

    setActorVisible(this, viewModel.visible);
    setLabelText(this._lyricBarLabel, viewModel.text);
    setActorWidth(this._lyricBarLabel, viewModel.maxWidth);
    setActorStyle(
      this._lyricBarLabel,
      `width: ${viewModel.maxWidth}px; min-width: 1px; text-align: ${viewModel.textAlign};`,
    );
    setLabelAlignment(this._lyricBarLabel, viewModel.textAlign);

    queueRelayout(this._lyricBarLabel);
    queueRelayout(this._lyricBarBin);
    queueRelayout(this._lyricBarBox);
    queueRelayout(this);
  }

  /**
   * @param {(() => void) | null} callback
   * @returns {void}
   */
  setPreferencesAction(callback) {
    this._disconnectPreferencesAction();
    this._preferencesAction = callback;

    if (callback === null) {
      return;
    }

    this._preferencesButtonPressId = this.connect('button-press-event', () => {
      this._preferencesAction?.();
      return true;
    });
  }

  /** @override */
  destroy() {
    this._disconnectPreferencesAction();
    this._lyricBarLabel = null;
    this._lyricBarBin = null;
    this._lyricBarBox = null;
    this._preferencesAction = null;
    super.destroy();
  }

  /**
   * @returns {void}
   */
  _disconnectPreferencesAction() {
    if (this._preferencesButtonPressId === 0) {
      return;
    }
    const signalId = /** @type {number} */ (this._preferencesButtonPressId);
    this.disconnect(signalId);
    this._preferencesButtonPressId = 0;
  }
}

export const LyricBarIndicator = /** @type {typeof LyricBarIndicatorBase} */ (
  GObject.registerClass(LyricBarIndicatorBase)
);

class LyricBarSettingsIndicatorBase extends PanelMenu.Button {
  /**
   * @override
   * @param {any} settings
   * @param {any} extension
   */
  _init(settings, extension) {
    super._init(0.0, 'LyricBar Settings', false);

    this._settings = settings;
    this._extension = extension;

    this._icon = new St.Icon({
      gicon: Gio.Icon.new_for_string('audio-x-generic-symbolic'),
      style_class: 'system-status-icon',
    });
    this.add_child(this._icon);

    // Panel Position Submenu
    this._positionSubMenu = new PopupMenu.PopupSubMenuMenuItem('Panel Position', false);

    this._leftItem = new PopupMenu.PopupMenuItem('Left');
    this._leftActivatedId = this._leftItem.connect('activate', () => {
      settings.set_string('panel-position', 'left');
    });

    this._centerItem = new PopupMenu.PopupMenuItem('Center');
    this._centerActivatedId = this._centerItem.connect('activate', () => {
      settings.set_string('panel-position', 'center');
    });

    this._rightItem = new PopupMenu.PopupMenuItem('Right');
    this._rightActivatedId = this._rightItem.connect('activate', () => {
      settings.set_string('panel-position', 'right');
    });

    this._positionSubMenu.menu.addMenuItem(this._leftItem);
    this._positionSubMenu.menu.addMenuItem(this._centerItem);
    this._positionSubMenu.menu.addMenuItem(this._rightItem);
    this.menu.addMenuItem(this._positionSubMenu);

    const currentPos = settings.get_string('panel-position');
    this._updatePositionOrnaments(currentPos);

    this._posChangedId = settings.connect('changed::panel-position', () => {
      const state = settings.get_string('panel-position');
      this._updatePositionOrnaments(state);
    });

    // Text Alignment Submenu
    this._alignSubMenu = new PopupMenu.PopupSubMenuMenuItem('Text Alignment', false);

    this._alignLeftItem = new PopupMenu.PopupMenuItem('Left');
    this._alignLeftActivatedId = this._alignLeftItem.connect('activate', () => {
      settings.set_string('text-align', 'left');
    });

    this._alignCenterItem = new PopupMenu.PopupMenuItem('Center');
    this._alignCenterActivatedId = this._alignCenterItem.connect('activate', () => {
      settings.set_string('text-align', 'center');
    });

    this._alignRightItem = new PopupMenu.PopupMenuItem('Right');
    this._alignRightActivatedId = this._alignRightItem.connect('activate', () => {
      settings.set_string('text-align', 'right');
    });

    this._alignSubMenu.menu.addMenuItem(this._alignLeftItem);
    this._alignSubMenu.menu.addMenuItem(this._alignCenterItem);
    this._alignSubMenu.menu.addMenuItem(this._alignRightItem);
    this.menu.addMenuItem(this._alignSubMenu);

    const currentAlign = settings.get_string('text-align');
    this._updateAlignmentOrnaments(currentAlign);

    this._alignChangedId = settings.connect('changed::text-align', () => {
      const state = settings.get_string('text-align');
      this._updateAlignmentOrnaments(state);
    });

    // Separator
    this._separator = new PopupMenu.PopupSeparatorMenuItem();
    this.menu.addMenuItem(this._separator);

    // Full Preferences link
    this._prefsItem = new PopupMenu.PopupMenuItem('LyricBar Preferences');
    this._prefsActivatedId = this._prefsItem.connect('activate', () => {
      extension.openPreferences();
    });
    this.menu.addMenuItem(this._prefsItem);
  }

  /**
   * @param {string} currentPos
   * @returns {void}
   */
  _updatePositionOrnaments(currentPos) {
    const { Ornament } = PopupMenu;
    this._leftItem?.setOrnament(currentPos === 'left' ? Ornament.DOT : Ornament.NONE);
    this._centerItem?.setOrnament(currentPos === 'center' ? Ornament.DOT : Ornament.NONE);
    this._rightItem?.setOrnament(currentPos === 'right' ? Ornament.DOT : Ornament.NONE);
  }

  /**
   * @param {string} currentAlign
   * @returns {void}
   */
  _updateAlignmentOrnaments(currentAlign) {
    const { Ornament } = PopupMenu;
    this._alignLeftItem?.setOrnament(currentAlign === 'left' ? Ornament.DOT : Ornament.NONE);
    this._alignCenterItem?.setOrnament(currentAlign === 'center' ? Ornament.DOT : Ornament.NONE);
    this._alignRightItem?.setOrnament(currentAlign === 'right' ? Ornament.DOT : Ornament.NONE);
  }

  /** @override */
  destroy() {
    if (this._settings && this._posChangedId) {
      this._settings.disconnect(this._posChangedId);
      this._posChangedId = null;
    }
    if (this._settings && this._alignChangedId) {
      this._settings.disconnect(this._alignChangedId);
      this._alignChangedId = null;
    }

    if (this._leftItem && this._leftActivatedId) {
      this._leftItem.disconnect(this._leftActivatedId);
    }
    if (this._centerItem && this._centerActivatedId) {
      this._centerItem.disconnect(this._centerActivatedId);
    }
    if (this._rightItem && this._rightActivatedId) {
      this._rightItem.disconnect(this._rightActivatedId);
    }
    if (this._alignLeftItem && this._alignLeftActivatedId) {
      this._alignLeftItem.disconnect(this._alignLeftActivatedId);
    }
    if (this._alignCenterItem && this._alignCenterActivatedId) {
      this._alignCenterItem.disconnect(this._alignCenterActivatedId);
    }
    if (this._alignRightItem && this._alignRightActivatedId) {
      this._alignRightItem.disconnect(this._alignRightActivatedId);
    }
    if (this._prefsItem && this._prefsActivatedId) {
      this._prefsItem.disconnect(this._prefsActivatedId);
    }

    this._icon = null;
    this._leftItem = null;
    this._centerItem = null;
    this._rightItem = null;
    this._positionSubMenu = null;
    this._alignLeftItem = null;
    this._alignCenterItem = null;
    this._alignRightItem = null;
    this._alignSubMenu = null;
    this._separator = null;
    this._prefsItem = null;

    super.destroy();
  }
}

export const LyricBarSettingsIndicator = /** @type {any} */ (
  GObject.registerClass(LyricBarSettingsIndicatorBase)
);

/**
 * @param {unknown} actor
 * @param {boolean} visible
 * @returns {void}
 */
function setActorVisible(actor, visible) {
  const setter = Reflect.get(/** @type {object} */ (actor), 'set_visible');
  if (typeof setter === 'function') {
    setter.call(actor, visible);
    return;
  }
  Reflect.set(/** @type {object} */ (actor), 'visible', visible);
}

/**
 * @param {InstanceType<typeof St.Label>} label
 * @param {string} text
 * @returns {void}
 */
function setLabelText(label, text) {
  Reflect.set(label, 'text', text);

  const setter = Reflect.get(label, 'set_text');
  if (typeof setter === 'function') {
    setter.call(label, text);
  }

  const clutterText = Reflect.get(label, 'clutter_text');
  const clutterSetter = Reflect.get(/** @type {object} */ (clutterText), 'set_text');
  if (typeof clutterSetter === 'function') {
    clutterSetter.call(clutterText, text);
  }
}

/**
 * @param {unknown} actor
 * @param {string} style
 * @returns {void}
 */
function setActorStyle(actor, style) {
  const setter = Reflect.get(/** @type {object} */ (actor), 'set_style');
  if (typeof setter === 'function') {
    setter.call(actor, style);
    return;
  }
  Reflect.set(/** @type {object} */ (actor), 'style', style);
}

/**
 * @param {unknown} actor
 * @param {number} width
 * @returns {void}
 */
function setActorWidth(actor, width) {
  const setter = Reflect.get(/** @type {object} */ (actor), 'set_width');
  if (typeof setter === 'function') {
    setter.call(actor, width);
    return;
  }
  Reflect.set(/** @type {object} */ (actor), 'width', width);
}

/**
 * @param {InstanceType<typeof St.Label>} label
 * @returns {void}
 */
function setSingleLineMode(label) {
  const clutterText = Reflect.get(label, 'clutter_text');
  if (clutterText === null || clutterText === undefined) {
    return;
  }

  const setSingleLine = Reflect.get(/** @type {object} */ (clutterText), 'set_single_line_mode');
  if (typeof setSingleLine === 'function') {
    setSingleLine.call(clutterText, true);
  }

  const setEllipsize = Reflect.get(/** @type {object} */ (clutterText), 'set_ellipsize');
  if (typeof setEllipsize === 'function') {
    setEllipsize.call(clutterText, Pango.EllipsizeMode.END);
    return;
  }

  Reflect.set(/** @type {object} */ (clutterText), 'ellipsize', Pango.EllipsizeMode.END);
}

/**
 * @param {unknown} actor
 * @returns {void}
 */
function queueRelayout(actor) {
  const relayout = Reflect.get(/** @type {object} */ (actor), 'queue_relayout');
  if (typeof relayout === 'function') {
    relayout.call(actor);
  }
}

/**
 * @param {unknown} actor
 * @param {unknown} galign
 * @returns {void}
 */
function setActorAlign(actor, galign) {
  const setter = Reflect.get(/** @type {object} */ (actor), 'set_x_align');
  if (typeof setter === 'function') {
    setter.call(actor, galign);
    return;
  }
  Reflect.set(/** @type {object} */ (actor), 'x_align', galign);
}

/**
 * @param {InstanceType<typeof St.Label>} label
 * @param {import('../domain/settings/types.js').TextAlign} align
 * @returns {void}
 */
function setLabelAlignment(label, align) {
  let galign = Clutter.ActorAlign.START;
  if (align === 'center') {
    galign = Clutter.ActorAlign.CENTER;
  } else if (align === 'right') {
    galign = Clutter.ActorAlign.END;
  }

  // Align the label widget itself inside its parent St.Bin
  setActorAlign(label, galign);
  queueRelayout(label);

  const clutterText = Reflect.get(label, 'clutter_text');
  if (clutterText !== null && clutterText !== undefined) {
    let pangoAlign = Pango.Alignment.LEFT;
    if (align === 'center') {
      pangoAlign = Pango.Alignment.CENTER;
    } else if (align === 'right') {
      pangoAlign = Pango.Alignment.RIGHT;
    }

    // Set line_alignment on the Clutter.Text actor to align text inside the label
    const setLineAlign = Reflect.get(/** @type {object} */ (clutterText), 'set_line_alignment');
    if (typeof setLineAlign === 'function') {
      setLineAlign.call(clutterText, pangoAlign);
    } else {
      Reflect.set(/** @type {object} */ (clutterText), 'line_alignment', pangoAlign);
    }

    // Keep setting the actor x_align on the clutterText as well as fallback
    setActorAlign(clutterText, galign);
    queueRelayout(clutterText);
  }
}
