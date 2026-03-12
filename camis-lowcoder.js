(function (global) {
  class CamisLowcoderCore {
    constructor(options = {}) {
      this.global = global;
      this.doc = global.document;
      this.config = {
        antdCss: "https://unpkg.com/antd@4.21.4/dist/antd.min.css",
        antdJs: "https://unpkg.com/antd@4.21.4/dist/antd.min.js",
        embedHost: "https://sdk.lowcoder.cloud",
        rootSelector: "#root",
        ...options
      };

      this._cache = {
        antdPromise: null,
        reactRoots: new Map()
      };
    }

    configure(options = {}) {
      Object.assign(this.config, options);
      return this;
    }

    loadCssOnce(url) {
      return new Promise((resolve, reject) => {
        const exists = Array.from(
          this.doc.querySelectorAll("link[rel='stylesheet']")
        ).find((el) => el.href === url);

        if (exists) {
          resolve(exists);
          return;
        }

        const link = this.doc.createElement("link");
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = url;
        link.onload = () => resolve(link);
        link.onerror = () => reject(new Error("Failed to load CSS: " + url));

        this.doc.head.appendChild(link);
      });
    }

    loadScriptOnce(url) {
      return new Promise((resolve, reject) => {
        const exists = Array.from(
          this.doc.querySelectorAll("script[src]")
        ).find((el) => el.src === url);

        if (exists) {
          if (exists.dataset.loaded === "true") {
            resolve(exists);
            return;
          }

          exists.addEventListener("load", () => resolve(exists), { once: true });
          exists.addEventListener(
            "error",
            () => reject(new Error("Failed to load script: " + url)),
            { once: true }
          );
          return;
        }

        const script = this.doc.createElement("script");
        script.src = url;
        script.async = false;
        script.onload = () => {
          script.dataset.loaded = "true";
          resolve(script);
        };
        script.onerror = () => reject(new Error("Failed to load script: " + url));

        this.doc.head.appendChild(script);
      });
    }
  }

  class CamisLowcoderDetect {
    constructor(core) {
      this.core = core;
    }

    href() {
      return this.core.global.location?.href || "";
    }

    isEmbed() {
      return this.href().includes(this.core.config.embedHost);
    }
  }

  class CamisLowcoderQuery {
    constructor(core, detect) {
      this.core = core;
      this.detect = detect;
    }

    run(runQuery, queryName) {
      if (typeof runQuery !== "function" || !queryName) return;

      if (this.detect.isEmbed()) {
        return runQuery(queryName);
      }

      return runQuery({ queryName });
    }
  }

  class CamisLowcoderAssets {
    constructor(core) {
      this.core = core;
    }

    async ensureAntd() {
      if (this.core.global.antd) {
        return this.core.global.antd;
      }

      if (!this.core._cache.antdPromise) {
        this.core._cache.antdPromise = (async () => {
          await this.core.loadCssOnce(this.core.config.antdCss);
          await this.core.loadScriptOnce(this.core.config.antdJs);

          if (!this.core.global.antd) {
            throw new Error("Antd loaded but window.antd is missing");
          }

          return this.core.global.antd;
        })();
      }

      return this.core._cache.antdPromise;
    }
  }

  class CamisLowcoderReact {
    constructor(core, assets) {
      this.core = core;
      this.assets = assets;
    }

    getRootElement(rootSelector) {
      const selector = rootSelector || this.core.config.rootSelector;
      const rootEl = this.core.doc.querySelector(selector);

      if (!rootEl) {
        throw new Error("Root element not found for selector: " + selector);
      }

      return rootEl;
    }

    getOrCreateRoot(rootEl) {
      if (this.core._cache.reactRoots.has(rootEl)) {
        return this.core._cache.reactRoots.get(rootEl);
      }

      if (!this.core.global.ReactDOM || !this.core.global.ReactDOM.createRoot) {
        throw new Error("ReactDOM.createRoot is not available on window.ReactDOM");
      }

      const root = this.core.global.ReactDOM.createRoot(rootEl);
      this.core._cache.reactRoots.set(rootEl, root);
      return root;
    }

    async render(Component, options = {}) {
      await this.assets.ensureAntd();

      if (!this.core.global.Lowcoder || typeof this.core.global.Lowcoder.connect !== "function") {
        throw new Error("Lowcoder.connect is not available");
      }

      if (!this.core.global.React || !this.core.global.React.createElement) {
        throw new Error("React.createElement is not available on window.React");
      }

      const rootEl = this.getRootElement(options.rootSelector);
      const root = this.getOrCreateRoot(rootEl);
      const ConnectedComponent = this.core.global.Lowcoder.connect(Component);

      root.render(
        this.core.global.React.createElement(ConnectedComponent)
      );

      return root;
    }

    unmount(rootSelector) {
      const rootEl = this.getRootElement(rootSelector);
      const root = this.core._cache.reactRoots.get(rootEl);

      if (root) {
        root.unmount();
        this.core._cache.reactRoots.delete(rootEl);
      }
    }
  }

  class CamisLowcoder {
    constructor(options = {}) {
      this.core = new CamisLowcoderCore(options);
      this.detect = new CamisLowcoderDetect(this.core);
      this.query = new CamisLowcoderQuery(this.core, this.detect);
      this.assets = new CamisLowcoderAssets(this.core);
      this.react = new CamisLowcoderReact(this.core, this.assets);
    }

    configure(options = {}) {
      this.core.configure(options);
      return this;
    }

    runQuery(runQuery, queryName) {
      return this.query.run(runQuery, queryName);
    }

    async ready() {
      return this.assets.ensureAntd();
    }
  }

  global.CamisLowcoder = CamisLowcoder;
  global.camisLowcoder = new CamisLowcoder();
})(window);