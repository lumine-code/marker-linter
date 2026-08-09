const { CompositeDisposable } = require("lumine");
const path = require("path");
const fs = require("fs");
const os = require("os");

describe("marker-linter", () => {
  let workspaceElement, editor, editorPath, mainModule, tempDir;

  beforeEach(async () => {
    workspaceElement = lumine.views.getView(lumine.workspace);
    jasmine.attachToDOM(workspaceElement);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "marker-linter-"));
    editorPath = path.join(tempDir, "sample.js");
    fs.writeFileSync(editorPath, Array(30).fill("lorem ipsum").join("\n"));
    editor = await lumine.workspace.open(editorPath);
    const pack = await lumine.packages.activatePackage("marker-linter");
    mainModule = pack.mainModule;
    // The harness keeps one config for the whole window, so without this a spec
    // that enables hints leaves them enabled for every spec after it -- and the
    // next `set(true)` would be a no-op that never reaches the observer.
    lumine.config.unset("marker-linter.showHints");
  });

  afterEach(() => {
    try {
      // Retries because Windows keeps a directory non-empty until the last handle on a
      // child closes, and `force` swallows only ENOENT.
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    } catch {
      // Windows can hold locks on freshly opened files; the OS cleans temp anyway.
    }
  });

  function message(severity, startRow, endRow, file = editorPath) {
    return {
      severity,
      location: {
        file,
        position: {
          start: { row: startRow, column: 0 },
          end: { row: endRow, column: 5 },
        },
      },
    };
  }

  function createLayer(layerEditor, props = mainModule.provideMarkerLayer()) {
    const layer = {
      editor: layerEditor,
      props,
      cache: new Map(),
      items: [],
      disposables: new CompositeDisposable(),
      update: jasmine.createSpy("update"),
    };
    // Attached the way the marker hub attaches it.
    props.initialize(layer);
    return layer;
  }

  describe("activation", () => {
    it("activates", () => {
      expect(lumine.packages.isPackageActive("marker-linter")).toBe(true);
    });
  });

  describe("linter.ui service provider", () => {
    let ui;

    beforeEach(() => {
      ui = mainModule.provideLinterUI();
    });

    it("matches the shape expected by the linter package", () => {
      expect(typeof ui.name).toBe("string");
      expect(typeof ui.render).toBe("function");
      expect(typeof ui.didBeginLinting).toBe("function");
      expect(typeof ui.didFinishLinting).toBe("function");
      expect(typeof ui.dispose).toBe("function");
    });

    it("stores rendered messages on the main module", () => {
      const messages = [message("error", 1, 1)];
      ui.render({ added: messages, removed: [], messages });
      expect(mainModule.messages).toBe(messages);
    });

    it("pushes messages of the matching file into the linter layer", () => {
      const layer = createLayer(editor);

      const own = message("error", 2, 3);
      const foreign = message("warning", 5, 5, path.join(tempDir, "other.js"));
      ui.render({ added: [own, foreign], removed: [], messages: [own, foreign] });

      expect(layer.cache.get("data")).toEqual([own]);
      expect(layer.update).toHaveBeenCalled();

      layer.disposables.dispose();
    });

    it("does not touch the layer when the patch concerns other files", () => {
      const layer = createLayer(editor);

      const foreign = message("warning", 5, 5, path.join(tempDir, "other.js"));
      ui.render({ added: [foreign], removed: [], messages: [foreign] });

      // The layer keeps the empty seed from initialize; the foreign patch
      // neither updates the data nor schedules a redraw.
      expect(layer.cache.get("data")).toEqual([]);
      expect(layer.update).not.toHaveBeenCalled();

      layer.disposables.dispose();
    });

    it("clears layer data when messages are removed", () => {
      const layer = createLayer(editor);

      const own = message("error", 2, 3);
      ui.render({ added: [own], removed: [], messages: [own] });
      expect(layer.cache.get("data")).toEqual([own]);

      ui.render({ added: [], removed: [own], messages: [] });
      expect(layer.cache.get("data")).toEqual([]);

      layer.disposables.dispose();
    });
  });

  describe("marker.layer service provider", () => {
    let provider;

    beforeEach(() => {
      provider = mainModule.provideMarkerLayer();
    });

    it("describes the linter layer", () => {
      expect(provider.name).toBe("linter");
      expect(provider.position).toBe("left");
      expect(provider.merge).toBe(true);
      expect(provider.threshold).toBe("marker-linter.threshold");
      expect(typeof provider.initialize).toBe("function");
      expect(typeof provider.getItems).toBe("function");
    });

    it("seeds the cache with current messages for the layer editor", () => {
      const own = message("error", 1, 1);
      const foreign = message("info", 2, 2, path.join(tempDir, "other.js"));
      mainModule.messages = [own, foreign];

      const layer = createLayer(editor, provider);
      expect(layer.cache.get("data")).toEqual([own]);
      layer.disposables.dispose();
    });

    it("maps messages to raw markers with severity classes", () => {
      const layer = createLayer(editor, provider);
      layer.cache.set("data", [
        message("error", 4, 6),
        message("error", 2, 3),
        message("warning", 10, 10),
      ]);

      // Sorting and merging are left to the host.
      const items = provider.getItems(layer);
      expect(items).toEqual([
        { row: 4, end: 6, cls: "error" },
        { row: 2, end: 3, cls: "error" },
        { row: 10, end: 10, cls: "warning" },
      ]);

      layer.disposables.dispose();
    });

    it("drops hint messages by default", () => {
      const layer = createLayer(editor, provider);
      layer.cache.set("data", [message("error", 1, 1), message("hint", 4, 4)]);

      expect(provider.getItems(layer)).toEqual([{ row: 1, end: 1, cls: "error" }]);

      layer.disposables.dispose();
    });

    it("maps hint messages once they are enabled", () => {
      lumine.config.set("marker-linter.showHints", true);
      const layer = createLayer(editor, provider);
      layer.cache.set("data", [message("error", 1, 1), message("hint", 4, 4)]);

      expect(provider.getItems(layer)).toEqual([
        { row: 1, end: 1, cls: "error" },
        { row: 4, end: 4, cls: "hint" },
      ]);

      layer.disposables.dispose();
    });

    it("re-runs the layer when the hint setting is toggled", () => {
      const layer = createLayer(editor, provider);
      expect(layer.update).not.toHaveBeenCalled();

      lumine.config.set("marker-linter.showHints", true);
      expect(layer.update).toHaveBeenCalled();

      layer.disposables.dispose();
    });

    it("returns no items without cached data", () => {
      const layer = createLayer(editor, provider);
      layer.cache.clear();
      expect(provider.getItems(layer)).toEqual([]);
      layer.disposables.dispose();
    });
  });
});
