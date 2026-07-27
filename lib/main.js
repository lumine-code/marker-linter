const { Disposable } = require("atom");

module.exports = {
  activate() {
    this.messages = [];
    // Every renderer builds its own layer from the descriptor, so an editor maps
    // to the set of layers drawing it, never to a single one.
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
        for (const [editor, layers] of this.layers) {
          const editorPath = editor.getPath();
          if (
            added.some((m) => m.location.file === editorPath) ||
            removed.some((m) => m.location.file === editorPath)
          ) {
            const data = messages.filter((m) => m.location.file === editorPath);
            for (const layer of layers) {
              layer.cache.set("data", data);
              layer.update();
            }
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
        let layers = this.layers.get(layer.editor);
        if (!layers) {
          layers = new Set();
          this.layers.set(layer.editor, layers);
        }
        layers.add(layer);
        layer.disposables.add(
          new Disposable(() => {
            layers.delete(layer);
            if (layers.size === 0) {
              this.layers.delete(layer.editor);
            }
          }),
        );
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
