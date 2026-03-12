(function (global) {
    class CamisLowcoderCore {
        constructor(options = {}) {
            this.global = global;
            this.doc = global.document;
            this.config = {
                momentJs: "https://unpkg.com/moment@2.29.4/min/moment.min.js",
                babelJs: "https://unpkg.com/@babel/standalone/babel.min.js",
                antdCss: "https://unpkg.com/antd@4.21.4/dist/antd.min.css",
                antdJs: "https://unpkg.com/antd@4.21.4/dist/antd.min.js",
                embedHost: "https://sdk.lowcoder.cloud",
                rootSelector: "#root",
                ...options
            };

            this._cache = {
                momentPromise: null,
                babelPromise: null,
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

        async ensureMoment() {
            if (this.core.global.moment) {
                return this.core.global.moment;
            }

            if (!this.core._cache.momentPromise) {
                this.core._cache.momentPromise = (async () => {
                    await this.core.loadScriptOnce(this.core.config.momentJs);

                    if (!this.core.global.moment) {
                        throw new Error("Moment loaded but window.moment is missing");
                    }

                    return this.core.global.moment;
                })();
            }

            return this.core._cache.momentPromise;
        }

        async ensureBabel() {
            if (this.core.global.Babel) {
                return this.core.global.Babel;
            }

            if (!this.core._cache.babelPromise) {
                this.core._cache.babelPromise = (async () => {
                    await this.core.loadScriptOnce(this.core.config.babelJs);

                    if (!this.core.global.Babel) {
                        throw new Error("Babel loaded but window.Babel is missing");
                    }

                    return this.core.global.Babel;
                })();
            }

            return this.core._cache.babelPromise;
        }

        async ensureAntd() {
            if (this.core.global.antd) {
                return this.core.global.antd;
            }

            if (!this.core._cache.antdPromise) {
                this.core._cache.antdPromise = (async () => {
                    await this.core.loadCssOnce(this.core.config.antdCss);
                    await this.ensureMoment(); // wajib sebelum antd
                    await this.core.loadScriptOnce(this.core.config.antdJs);

                    if (!this.core.global.antd) {
                        throw new Error("Antd loaded but window.antd is missing");
                    }

                    return this.core.global.antd;
                })();
            }

            return this.core._cache.antdPromise;
        }

        async ensureAll() {
            await this.ensureAntd();
            await this.ensureBabel();
        }
    }

    class CamisLowcoderReact {
        constructor(core, assets) {
            this.core = core;
            this.assets = assets;
        }

        async render(Component) {
            await this.assets.ensureAll();

            const { React, ReactDOM, Lowcoder } = this.core.global;

            if (!Lowcoder?.connect) {
                throw new Error("Lowcoder.connect is not available");
            }

            if (!ReactDOM?.createRoot) {
                throw new Error("ReactDOM.createRoot not available");
            }

            let rootEl = this.core.doc.getElementById("camis-root");

            if (!rootEl) {
                rootEl = this.core.doc.createElement("div");
                rootEl.id = "camis-root";
                this.core.doc.body.appendChild(rootEl);
            }

            const Connected = Lowcoder.connect(Component);
            const root = ReactDOM.createRoot(rootEl);

            root.render(
                React.createElement(Connected)
            );

            return root;
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
            return this.assets.ensureAll();
        }

        async render(Component, options = {}) {
            return this.react.render(Component, options);
        }
    }

    global.CamisLowcoder = CamisLowcoder;
    global.camisLowcoder = new CamisLowcoder();
})(window);