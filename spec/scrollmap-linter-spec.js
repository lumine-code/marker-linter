const { CompositeDisposable } = require("atom");
const path = require("path");
const fs = require("fs");
const os = require("os");

describe("scrollmap-linter", () => {
  let workspaceElement, editor, editorPath, mainModule, tempDir;

  beforeEach(async () => {
    workspaceElement = atom.views.getView(atom.workspace);
    jasmine.attachToDOM(workspaceElement);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scrollmap-linter-"));
    editorPath = path.join(tempDir, "sample.js");
    fs.writeFileSync(editorPath, Array(30).fill("lorem ipsum").join("\n"));
    editor = await atom.workspace.open(editorPath);
    const pack = await atom.packages.activatePackage("scrollmap-linter");
    mainModule = pack.mainModule;
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
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

  function createLayer(layerEditor) {
    return {
      editor: layerEditor,
      cache: new Map(),
      disposables: new CompositeDisposable(),
      update: jasmine.createSpy("update"),
    };
  }

  describe("activation", () => {
    it("activates and observes the threshold setting", () => {
      expect(atom.packages.isPackageActive("scrollmap-linter")).toBe(true);
      expect(mainModule.threshold).toBe(0);

      atom.config.set("scrollmap-linter.threshold", 4);
      expect(mainModule.threshold).toBe(4);
    });
  });

  describe("linter-ui service provider", () => {
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
      editor.scrollmap = { layers: new Map([["linter", layer]]) };

      const own = message("error", 2, 3);
      const foreign = message("warning", 5, 5, path.join(tempDir, "other.js"));
      ui.render({ added: [own, foreign], removed: [], messages: [own, foreign] });

      expect(layer.cache.get("data")).toEqual([own]);
      expect(layer.update).toHaveBeenCalled();

      delete editor.scrollmap;
    });

    it("does not touch the layer when the patch concerns other files", () => {
      const layer = createLayer(editor);
      editor.scrollmap = { layers: new Map([["linter", layer]]) };

      const foreign = message("warning", 5, 5, path.join(tempDir, "other.js"));
      ui.render({ added: [foreign], removed: [], messages: [foreign] });

      expect(layer.cache.has("data")).toBe(false);
      expect(layer.update).not.toHaveBeenCalled();

      delete editor.scrollmap;
    });

    it("clears layer data when messages are removed", () => {
      const layer = createLayer(editor);
      editor.scrollmap = { layers: new Map([["linter", layer]]) };

      const own = message("error", 2, 3);
      ui.render({ added: [own], removed: [], messages: [own] });
      expect(layer.cache.get("data")).toEqual([own]);

      ui.render({ added: [], removed: [own], messages: [] });
      expect(layer.cache.get("data")).toEqual([]);

      delete editor.scrollmap;
    });
  });

  describe("scrollmap service provider", () => {
    let provider;

    beforeEach(() => {
      provider = mainModule.provideScrollmap();
    });

    it("describes the linter layer", () => {
      expect(provider.name).toBe("linter");
      expect(provider.position).toBe("left");
      expect(typeof provider.initialize).toBe("function");
      expect(typeof provider.getItems).toBe("function");
    });

    it("seeds the cache with current messages for the layer editor", () => {
      const own = message("error", 1, 1);
      const foreign = message("info", 2, 2, path.join(tempDir, "other.js"));
      mainModule.messages = [own, foreign];

      const layer = createLayer(editor);
      provider.initialize(layer);
      expect(layer.cache.get("data")).toEqual([own]);
      layer.disposables.dispose();
    });

    it("re-runs the layer when the threshold changes", () => {
      const layer = createLayer(editor);
      provider.initialize(layer);

      atom.config.set("scrollmap-linter.threshold", 9);
      expect(layer.update).toHaveBeenCalled();
      layer.disposables.dispose();
    });

    it("maps messages to markers with severity classes", () => {
      const layer = createLayer(editor);
      layer.cache.set("data", [message("error", 4, 6), message("warning", 10, 10)]);

      const items = provider.getItems(layer);
      expect(items).toEqual([
        { row: 4, end: 6, cls: "error" },
        { row: 10, end: 10, cls: "warning" },
      ]);
    });

    it("merges adjacent markers of the same severity", () => {
      const layer = createLayer(editor);
      layer.cache.set("data", [
        message("error", 4, 5),
        message("error", 2, 3),
        message("error", 8, 8),
        message("warning", 10, 11),
      ]);

      const items = provider.getItems(layer);
      expect(items).toEqual([
        { row: 2, end: 5, cls: "error" },
        { row: 8, end: 8, cls: "error" },
        { row: 10, end: 11, cls: "warning" },
      ]);
    });

    it("hides all markers when the threshold is exceeded", () => {
      atom.config.set("scrollmap-linter.threshold", 1);
      const layer = createLayer(editor);
      layer.cache.set("data", [message("error", 1, 1), message("warning", 10, 10)]);

      expect(provider.getItems(layer)).toEqual([]);
    });

    it("returns no items without cached data", () => {
      const layer = createLayer(editor);
      expect(provider.getItems(layer)).toEqual([]);
    });
  });
});
