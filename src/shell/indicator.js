import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

/**
 * @import { IndicatorViewModel } from '../domain/display/view-model.js'
 */

class LyricBarIndicatorBase extends PanelMenu.Button {
  /** @override */
  _init() {
    super._init(0.0, 'LyricBar');

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
    setActorStyle(this._lyricBarLabel, `width: ${viewModel.maxWidth}px; min-width: 1px;`);
    queueRelayout(this._lyricBarLabel);
    queueRelayout(this._lyricBarBin);
    queueRelayout(this._lyricBarBox);
    queueRelayout(this);
  }

  /** @override */
  destroy() {
    this._lyricBarLabel = null;
    this._lyricBarBin = null;
    this._lyricBarBox = null;
    super.destroy();
  }
}

export const LyricBarIndicator = /** @type {typeof LyricBarIndicatorBase} */ (
  GObject.registerClass(LyricBarIndicatorBase)
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
