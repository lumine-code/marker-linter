const { CompositeDisposable, Disposable } = require("lumine");

module.exports = {
  activate() {
    this.messages = [];
    // The marker hub builds exactly one layer per (provider, editor), so an
    // editor maps to a single layer. It has to exist before the observer below,
    // which fires synchronously on subscribe.
    this.layers = new Map();
    this.disposables = new CompositeDisposable(
      // Subscribed once for the package rather than once per editor: hints are
      // shown or hidden everywhere at once.
      lumine.config.observe("marker-linter.showHints", (value) => {
        this.showHints = value;
        for (const layer of this.layers.values()) {
          layer.update();
        }
      }),
    );
  },

  deactivate() {
    this.messages = [];
    this.layers.clear();
    this.disposables.dispose();
  },

  messagesFor(editor) {
    const editorPath = editor.getPath();
    return this.messages.filter((m) => m.location.file === editorPath);
  },

  provideLinterUI() {
    return {
      name: "marker-linter",
      render: ({ added, messages, removed }) => {
        this.messages = messages;
        for (const [editor, layer] of this.layers) {
          const editorPath = editor.getPath();
          if (
            added.some((m) => m.location.file === editorPath) ||
            removed.some((m) => m.location.file === editorPath)
          ) {
            layer.cache.set(
              "data",
              messages.filter((m) => m.location.file === editorPath),
            );
            layer.update();
          }
        }
      },
      didBeginLinting() {},
      didFinishLinting() {},
      dispose: () => {},
    };
  },

  provideMarkerLayer() {
    return {
      name: "linter",
      description: "Linter message markers",
      position: "left",
      merge: true,
      threshold: "marker-linter.threshold",
      initialize: (layer) => {
        this.layers.set(layer.editor, layer);
        layer.disposables.add(new Disposable(() => this.layers.delete(layer.editor)));
        layer.cache.set("data", this.messagesFor(layer.editor));
      },
      getItems: ({ editor, cache }) => {
        const data = cache.get("data") ?? [];
        // Dropped here rather than painted transparent: the threshold counts the
        // items a layer returns, and once it is exceeded every renderer skips
        // that layer whole, so a flood of hints would take the error markers
        // down with it.
        const shown = this.showHints ? data : data.filter((m) => m.severity !== "hint");
        return shown.map((message) => {
          const startRow = editor.screenPositionForBufferPosition(
            message.location.position.start,
          ).row;
          const endRow = editor.screenPositionForBufferPosition(message.location.position.end).row;
          return {
            row: Math.min(startRow, endRow),
            end: Math.max(startRow, endRow),
            cls: message.severity,
          };
        });
      },
    };
  },
};
