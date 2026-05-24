declare module 'gi://Adw' {
  const Adw: any;
  export default Adw;
}

declare module 'gi://Clutter' {
  const Clutter: {
    ActorAlign: {
      CENTER: unknown;
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

declare module 'gi://Gtk' {
  const Gtk: any;
  export default Gtk;
}

declare module 'gi://Soup' {
  const Soup: any;
  export default Soup;
}

declare module 'gi://St' {
  export class Label {
    constructor(config: { text: string; y_align?: unknown; style_class?: string });

    text: string;
    style: string;
  }

  const St: {
    Label: typeof Label;
  };
  export default St;
}

declare module 'resource:///org/gnome/shell/extensions/extension.js' {
  export class Extension {
    uuid: string;
    getSettings(schema?: string): any;
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
    visible: boolean;
    constructor(menuAlignment?: number, nameText?: string);
    _init(menuAlignment: number, nameText?: string): void;
    add_child(actor: unknown): void;
    destroy(): void;
  }
}
