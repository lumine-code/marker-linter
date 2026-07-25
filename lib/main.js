const { CompositeDisposable, Disposable } = require("atom");

module.exports = {
  activate() {
    this.disposables = new CompositeDisposable(
      atom.config.observe("scrollmap-linter.threshold", (value) => {
        this.threshold = value;
      }),
    );
    this.messages = [];
    // Layers handed over by the scrollmap hub, keyed by editor.
    this.layers = new Map();
  },

  deactivate() {
    this.messages = [];
    this.layers.clear();
    this.disposables.dispose();
  },

  provideLinterUI() {
    return {
      name: "scrollmap-linter",
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

  provideScrollmap() {
    return {
      name: "linter",
      description: "Linter message markers",
      position: "left",
      initialize: (layer) => {
        this.layers.set(layer.editor, layer);
        layer.disposables.add(
          new Disposable(() => this.layers.delete(layer.editor)),
          atom.config.onDidChange("scrollmap-linter.threshold", layer.update),
        );
        const editorPath = layer.editor.getPath();
        const messages = this.messages.filter((m) => m.location.file === editorPath);
        layer.cache.set("data", messages);
      },
      getItems: ({ editor, cache }) => {
        const data = cache.get("data") ?? [];
        const markers = data
          .map((message) => {
            const startRow = editor.screenPositionForBufferPosition(
              message.location.position.start,
            ).row;
            const endRow = editor.screenPositionForBufferPosition(
              message.location.position.end,
            ).row;
            return {
              row: Math.min(startRow, endRow),
              end: Math.max(startRow, endRow),
              cls: message.severity,
            };
          })
          .sort((a, b) => a.row - b.row || a.end - b.end || a.cls.localeCompare(b.cls));
        const items = [];
        let lastItem = null;
        for (const marker of markers) {
          if (
            lastItem &&
            lastItem.cls === marker.cls &&
            marker.row <= (lastItem.end ?? lastItem.row) + 1
          ) {
            lastItem.end = Math.max(lastItem.end ?? lastItem.row, marker.end);
          } else {
            if (lastItem) items.push(lastItem);
            lastItem = marker;
          }
        }
        if (lastItem) items.push(lastItem);
        if (this.threshold && items.length > this.threshold) {
          return [];
        }
        return items;
      },
    };
  },
};
