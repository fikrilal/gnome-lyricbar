declare module 'gi://Adw' {
  const Adw: any;
  export default Adw;
}

declare module 'gi://Clutter' {
  const Clutter: {
    ActorAlign: {
      START: unknown;
      CENTER: unknown;
      END: unknown;
      FILL: unknown;
    };
  };
  export default Clutter;
}

declare module 'gi://Gio' {
  const Gio: any;
  export default Gio;
}

declare module 'gi://GLib' {
  const GLib: any;
  export default GLib;
}

declare module 'gi://GObject' {
  const GObject: {
    registerClass<T>(klass: T): T;
  };
  export default GObject;
}

declare module 'gi://Gdk' {
  export class RGBA {
    red: number;
    green: number;
    blue: number;
    alpha: number;

    parse(input: string): boolean;
  }

  const Gdk: {
    RGBA: typeof RGBA;
  };
  export default Gdk;
}

declare module 'gi://Gtk' {
  const Gtk: any;
  export default Gtk;
}

declare module 'gi://Pango' {
  const Pango: {
    EllipsizeMode: {
      END: unknown;
    };
    Alignment: {
      LEFT: unknown;
      CENTER: unknown;
      RIGHT: unknown;
    };
  };
  export default Pango;
}

declare module 'gi://Soup' {
  const Soup: any;
  export default Soup;
}

declare module 'gi://St' {
  export class Bin {
    constructor(config?: { style_class?: string; y_align?: unknown });

    set_child(actor: unknown): void;
  }

  export class BoxLayout {
    constructor(config?: { style_class?: string });

    add_child(actor: unknown): void;
  }

  export class Label {
    constructor(config: { text: string; y_align?: unknown; style_class?: string });

    text: string;
    style: string;
  }

  export class Icon {
    constructor(config?: { gicon?: unknown; style_class?: string });
  }

  export enum TextAlign {
    START = 0,
    CENTER = 1,
    END = 2,
  }

  const St: {
    Bin: typeof Bin;
    BoxLayout: typeof BoxLayout;
    Label: typeof Label;
    Icon: typeof Icon;
    TextAlign: typeof TextAlign;
  };
  export default St;
}

declare module 'resource:///org/gnome/shell/extensions/extension.js' {
  export class Extension {
    uuid: string;
    getSettings(schema?: string): any;
    openPreferences(): void;
  }
}

declare module 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js' {
  export class ExtensionPreferences {
    getSettings(schema?: string): any;
  }
}

declare module 'resource:///org/gnome/shell/ui/main.js' {
  export const panel: {
    addToStatusArea(
      role: string,
      indicator: unknown,
      position?: number,
      box?: 'left' | 'center' | 'right',
    ): void;
  };
}

declare module 'resource:///org/gnome/shell/ui/panelMenu.js' {
  export class Button {
    menu: any;
    label_actor: unknown;
    visible: boolean;
    constructor(menuAlignment?: number, nameText?: string | null, dontCreateMenu?: boolean);
    _init(menuAlignment: number, nameText?: string | null, dontCreateMenu?: boolean): void;
    add_child(actor: unknown): void;
    add_style_class_name(name: string): void;
    destroy(): void;
    connect(signal: string, callback: (...args: any[]) => any): number;
    disconnect(id: number): void;
  }
}

declare module 'resource:///org/gnome/shell/ui/popupMenu.js' {
  export enum Ornament {
    NONE = 0,
    DOT = 1,
    CHECK = 2,
    HIDDEN = 3,
  }
  export class PopupMenu {
    addMenuItem(item: unknown, position?: number): void;
  }
  export class PopupBaseMenuItem {
    setOrnament(ornament: Ornament): void;
  }
  export class PopupMenuItem extends PopupBaseMenuItem {
    constructor(text: string, params?: unknown);
    connect(signal: 'activate', callback: () => void): number;
    disconnect(id: number): void;
  }
  export class PopupSubMenuMenuItem extends PopupBaseMenuItem {
    menu: PopupMenu;
    constructor(text: string, wantsIcon?: boolean);
  }
  export class PopupSwitchMenuItem extends PopupBaseMenuItem {
    constructor(text: string, active: boolean, params?: unknown);
    connect(signal: 'toggled', callback: (item: unknown, active: boolean) => void): number;
    disconnect(id: number): void;
    setToggleState(active: boolean): void;
  }
  export class PopupSeparatorMenuItem {
    constructor();
  }
}
