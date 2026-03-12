(function (global) {
    class CamisLowcoderCore {
        constructor(options = {}) {
            this.global = global;
            this.doc = global.document;

            this.config = {
                dayjsJs: "https://unpkg.com/dayjs@1.11.13/dayjs.min.js",
                antdCss: "https://unpkg.com/antd@6.3.2/dist/reset.css",
                antdJs: "https://unpkg.com/antd@6.3.2/dist/antd.min.js",
                embedHost: "https://sdk.lowcoder.cloud",
                rootId: "camis-root",
                autoBoot: true,
                theme: {
                    mode: "dark",
                    token: {}
                },
                ...options
            };

            this._cache = {
                dayjsPromise: null,
                antdPromise: null,
                readyPromise: null,
                reactRoot: null
            };
        }

        configure(options = {}) {
            if (!options || typeof options !== "object") {
                return this;
            }

            if (options.theme && typeof options.theme === "object") {
                this.config.theme = {
                    ...this.config.theme,
                    ...options.theme,
                    token: {
                        ...(this.config.theme?.token || {}),
                        ...(options.theme.token || {})
                    }
                };
            }

            const rest = { ...options };
            delete rest.theme;

            Object.assign(this.config, rest);
            return this;
        }

        loadCssOnce(url) {
            return new Promise((resolve, reject) => {
                const existing = Array.from(
                    this.doc.querySelectorAll("link[rel='stylesheet']")
                ).find((el) => el.href === url);

                if (existing) {
                    resolve(existing);
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
                const existing = Array.from(
                    this.doc.querySelectorAll("script[src]")
                ).find((el) => el.src === url);

                if (existing) {
                    if (existing.dataset.loaded === "true") {
                        resolve(existing);
                        return;
                    }

                    existing.addEventListener("load", () => resolve(existing), { once: true });
                    existing.addEventListener(
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

        ensureHostGlobals() {
            if (!this.global.React) {
                throw new Error("window.React is required");
            }

            if (!this.global.ReactDOM || typeof this.global.ReactDOM.createRoot !== "function") {
                throw new Error("window.ReactDOM.createRoot is required");
            }

            if (!this.global.Lowcoder || typeof this.global.Lowcoder.connect !== "function") {
                throw new Error("window.Lowcoder.connect is required");
            }
        }

        getRootElement() {
            let rootEl = this.doc.getElementById(this.config.rootId);

            if (!rootEl) {
                rootEl = this.doc.createElement("div");
                rootEl.id = this.config.rootId;
                this.doc.body.appendChild(rootEl);
            }

            return rootEl;
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

    class CamisLowcoderAssets {
        constructor(core) {
            this.core = core;
        }

        async ensureDayjs() {
            if (this.core.global.dayjs) {
                return this.core.global.dayjs;
            }

            if (!this.core._cache.dayjsPromise) {
                this.core._cache.dayjsPromise = (async () => {
                    await this.core.loadScriptOnce(this.core.config.dayjsJs);

                    if (!this.core.global.dayjs) {
                        throw new Error("Dayjs loaded but window.dayjs is missing");
                    }

                    return this.core.global.dayjs;
                })();
            }

            return this.core._cache.dayjsPromise;
        }

        async ensureAntd() {
            if (this.core.global.antd) {
                return this.core.global.antd;
            }

            this.core.ensureHostGlobals();

            if (!this.core._cache.antdPromise) {
                this.core._cache.antdPromise = (async () => {
                    await this.core.loadCssOnce(this.core.config.antdCss);
                    await this.ensureDayjs();
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
            this.core.ensureHostGlobals();
            await this.ensureAntd();
        }

        ready() {
            if (!this.core._cache.readyPromise) {
                this.core._cache.readyPromise = this.ensureAll();
            }

            return this.core._cache.readyPromise;
        }
    }

    class CamisLowcoderReact {
        constructor(core, assets) {
            this.core = core;
            this.assets = assets;
        }

        getThemeAlgorithm() {
            const themeApi = this.core.global.antd.theme;
            const mode = this.core.config.theme?.mode || "dark";

            if (mode === "light") {
                return themeApi.defaultAlgorithm;
            }

            if (mode === "compact") {
                return themeApi.compactAlgorithm;
            }

            if (mode === "dark-compact") {
                return [themeApi.darkAlgorithm, themeApi.compactAlgorithm];
            }

            return themeApi.darkAlgorithm;
        }

        getThemeConfig() {
            return {
                algorithm: this.getThemeAlgorithm(),
                token: {
                    ...(this.core.config.theme?.token || {})
                }
            };
        }

        createElement(Component) {
            const React = this.core.global.React;
            const { ConfigProvider, App: AntdApp } = this.core.global.antd;
            const Connected = this.core.global.Lowcoder.connect(Component);

            return React.createElement(
                ConfigProvider,
                {
                    theme: this.getThemeConfig()
                },
                React.createElement(
                    AntdApp,
                    null,
                    React.createElement(Connected)
                )
            );
        }

        async render(Component) {
            await this.assets.ready();

            const ReactDOM = this.core.global.ReactDOM;
            const rootEl = this.core.getRootElement();
            const element = this.createElement(Component);

            if (this.core._cache.reactRoot) {
                this.core._cache.reactRoot.unmount();
                this.core._cache.reactRoot = null;
            }

            const root = ReactDOM.createRoot(rootEl);
            root.render(element);
            this.core._cache.reactRoot = root;

            return root;
        }

        unmount() {
            if (this.core._cache.reactRoot) {
                this.core._cache.reactRoot.unmount();
                this.core._cache.reactRoot = null;
            }
        }
    }

    class CamisLowcoderFormat {
        static get JAKARTA_TZ() {
            return "Asia/Jakarta";
        }

        static isNil(value) {
            return value === null || value === undefined || value === "";
        }

        static toNumber(value) {
            if (this.isNil(value)) return null;

            if (typeof value === "number") {
                return Number.isFinite(value) ? value : null;
            }

            if (typeof value === "string") {
                const trimmed = value.trim();
                if (!trimmed) return null;

                const normalized = trimmed.replace(/\./g, "").replace(",", ".");
                const num = Number(normalized);

                return Number.isFinite(num) ? num : null;
            }

            return null;
        }

        static numberId(value, fallback = "-") {
            const num = this.toNumber(value);
            if (num === null) return fallback;

            try {
                return new Intl.NumberFormat("id-ID", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(num);
            } catch (err) {
                return fallback;
            }
        }

        static percentId(value, fractionDigits = 2, fallback = "-") {
            const num = this.toNumber(value);
            if (num === null) return fallback;

            try {
                return new Intl.NumberFormat("id-ID", {
                    minimumFractionDigits: fractionDigits,
                    maximumFractionDigits: fractionDigits
                }).format(num);
            } catch (err) {
                return fallback;
            }
        }

        static parseDateInput(value) {
            if (this.isNil(value)) return null;

            if (value instanceof Date) {
                return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
            }

            if (typeof value === "number") {
                const date = new Date(value);
                return Number.isNaN(date.getTime()) ? null : date;
            }

            if (typeof value === "string") {
                const trimmed = value.trim();
                if (!trimmed) return null;

                if (/^\d+$/.test(trimmed)) {
                    const asNumber = Number(trimmed);
                    const dateFromNumber = new Date(asNumber);
                    return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
                }

                if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                    const date = new Date(trimmed + "T00:00:00+07:00");
                    return Number.isNaN(date.getTime()) ? null : date;
                }

                const parsed = new Date(trimmed);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }

            return null;
        }

        static getJakartaParts(value) {
            const date = this.parseDateInput(value);
            if (!date) return null;

            try {
                const formatter = new Intl.DateTimeFormat("en-CA", {
                    timeZone: this.JAKARTA_TZ,
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                });

                const parts = formatter.formatToParts(date);
                const map = {};

                for (const part of parts) {
                    if (part.type !== "literal") {
                        map[part.type] = part.value;
                    }
                }

                return {
                    year: map.year,
                    month: map.month,
                    day: map.day,
                    hour: map.hour,
                    minute: map.minute
                };
            } catch (err) {
                return null;
            }
        }

        static dateYmd(value, fallback = "-") {
            const parts = this.getJakartaParts(value);
            if (!parts) return fallback;

            return parts.year + "-" + parts.month + "-" + parts.day;
        }

        static dateYmdHm(value, fallback = "-") {
            const parts = this.getJakartaParts(value);
            if (!parts) return fallback;

            return parts.year + "-" + parts.month + "-" + parts.day + " " + parts.hour + ":" + parts.minute;
        }
    }

    class CamisLowcoderComponent {
        constructor(props = {}, services = {}) {
            this.runQuery = props.runQuery;
            this.model = props.model || {};
            this.updateModel = props.updateModel;
            this.detect = services.detect;
            this.format = services.format;
        }

        query(queryName) {
            const nextQueryName = queryName || this.model?.query;

            if (typeof this.runQuery !== "function" || !nextQueryName) {
                return;
            }

            if (this.detect.isEmbed()) {
                return this.runQuery(nextQueryName);
            }

            return this.runQuery({ queryName: nextQueryName });
        }

        refresh(queryName) {
            return this.query(queryName);
        }
    }

    class CamisLowcoder {
        constructor(options = {}) {
            this.core = new CamisLowcoderCore(options);
            this.detect = new CamisLowcoderDetect(this.core);
            this.assets = new CamisLowcoderAssets(this.core);
            this.react = new CamisLowcoderReact(this.core, this.assets);
            this.format = CamisLowcoderFormat;

            if (this.core.config.autoBoot) {
                this.assets.ready().catch((err) => {
                    console.error("[camis-lowcoder] asset boot failed:", err);
                });
            }
        }

        configure(options = {}) {
            this.core.configure(options);
            return this;
        }

        component(props = {}) {
            return new CamisLowcoderComponent(props, {
                detect: this.detect,
                format: this.format
            });
        }

        async ready() {
            return this.assets.ready();
        }

        async render(Component) {
            return this.react.render(Component);
        }

        unmount() {
            return this.react.unmount();
        }
    }

    global.CamisLowcoder = CamisLowcoder;
    global.CamisLowcoderFormat = CamisLowcoderFormat;
    global.CamisLowcoderComponent = CamisLowcoderComponent;
    global.camisLowcoder = new CamisLowcoder({
        theme: {
            mode: "dark",
            token: {}
        }
    });
})(window);