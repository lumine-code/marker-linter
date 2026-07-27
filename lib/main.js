const { Disposable } = require("atom");

module.exports = {
  activate() {
    this.messages = [];
    // The marker hub builds exactly one layer per (provider, editor), so an
    // editor maps to a single layer.
    this.layers = new Map();
  },

  deactivate() {
    this.messages = [];
    this.layers.clear();
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
        return data.map((message) => {
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
