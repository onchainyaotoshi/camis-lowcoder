(function (global) {
    class CamisLowcoderCore {
        constructor(options = {}) {
            this.global = global;
            this.doc = global.document;
            this.config = {
                momentJs: "https://unpkg.com/moment@2.29.4/min/moment.min.js",
                antdCss: "https://unpkg.com/antd@4.21.4/dist/antd.min.css",
                antdJs: "https://unpkg.com/antd@4.21.4/dist/antd.min.js",
                embedHost: "https://sdk.lowcoder.cloud",
                rootSelector: "#root",
                autoBoot: true,
                postMessageType: "camis-lowcoder:size",
                postMessageTargetOrigin: "*",
                autoReportSizeOnRender: true,
                ...options
            };

            this._cache = {
                momentPromise: null,
                antdPromise: null,
                readyPromise: null,
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

        async ensureAntd() {
            if (this.core.global.antd) {
                return this.core.global.antd;
            }

            if (!this.core._cache.antdPromise) {
                this.core._cache.antdPromise = (async () => {
                    await this.core.loadCssOnce(this.core.config.antdCss);
                    await this.ensureMoment();
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
        }

        ready() {
            if (!this.core._cache.readyPromise) {
                this.core._cache.readyPromise = this.ensureAll();
            }
            return this.core._cache.readyPromise;
        }
    }

    class CamisLowcoderBridge {
        constructor(core) {
            this.core = core;
        }

        getRootElement() {
            return this.core.doc.getElementById("camis-root");
        }

        measure() {
            const rootEl = this.getRootElement();

            if (!rootEl) {
                return {
                    width: 0,
                    height: 0
                };
            }

            const rect = rootEl.getBoundingClientRect();

            const width = Math.max(
                Math.ceil(rect.width || 0),
                Math.ceil(rootEl.scrollWidth || 0),
                Math.ceil(rootEl.offsetWidth || 0)
            );

            const height = Math.max(
                Math.ceil(rect.height || 0),
                Math.ceil(rootEl.scrollHeight || 0),
                Math.ceil(rootEl.offsetHeight || 0)
            );

            return { width, height };
        }

        report(extraPayload = {}) {
            const size = this.measure();

            try {
                this.core.global.parent.postMessage(
                    {
                        type: this.core.config.postMessageType,
                        source: "camis-lowcoder",
                        width: size.width,
                        height: size.height,
                        href: this.core.global.location?.href || "",
                        ts: Date.now(),
                        ...extraPayload
                    },
                    this.core.config.postMessageTargetOrigin || "*"
                );
            } catch (err) {
                console.error("[camis-lowcoder] postMessage failed:", err);
            }
        }
    }

    class CamisLowcoderReact {
        constructor(core, assets, bridge) {
            this.core = core;
            this.assets = assets;
            this.bridge = bridge;
        }

        async render(Component) {
            await this.assets.ready();

            const { React, ReactDOM, Lowcoder } = this.core.global;

            if (!Lowcoder || typeof Lowcoder.connect !== "function") {
                throw new Error("Lowcoder.connect is not available");
            }

            if (!ReactDOM) {
                throw new Error("ReactDOM is not available");
            }

            let rootEl = this.core.doc.getElementById("camis-root");

            if (!rootEl) {
                rootEl = this.core.doc.createElement("div");
                rootEl.id = "camis-root";
                this.core.doc.body.appendChild(rootEl);
            }

            const prevRoot = this.core._cache.reactRoots.get(rootEl);
            if (prevRoot && typeof prevRoot.unmount === "function") {
                prevRoot.unmount();
            }

            const Connected = Lowcoder.connect(Component);

            const Reporter = () => {
                React.useLayoutEffect(() => {
                    if (!this.bridge || !this.core.config.autoReportSizeOnRender) {
                        return;
                    }

                    const raf = this.core.global.requestAnimationFrame;
                    if (typeof raf === "function") {
                        raf(() => {
                            this.bridge.report();
                        });
                    } else {
                        setTimeout(() => {
                            this.bridge.report();
                        }, 16);
                    }
                }, []);

                return React.createElement(Connected);
            };

            if (typeof ReactDOM.createRoot === "function") {
                const root = ReactDOM.createRoot(rootEl);
                root.render(React.createElement(Reporter));
                this.core._cache.reactRoots.set(rootEl, root);
                return root;
            }

            if (typeof ReactDOM.render === "function") {
                ReactDOM.render(React.createElement(Reporter), rootEl);
                this.core._cache.reactRoots.set(rootEl, {
                    unmount() {
                        if (typeof ReactDOM.unmountComponentAtNode === "function") {
                            ReactDOM.unmountComponentAtNode(rootEl);
                        }
                    }
                });

                return this.core._cache.reactRoots.get(rootEl);
            }

            throw new Error("No supported ReactDOM render API found");
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

            return `${parts.year}-${parts.month}-${parts.day}`;
        }

        static dateYmdHm(value, fallback = "-") {
            const parts = this.getJakartaParts(value);
            if (!parts) return fallback;

            return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
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

            if (this.detect && this.detect.isEmbed()) {
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
            this.bridge = new CamisLowcoderBridge(this.core);
            this.react = new CamisLowcoderReact(this.core, this.assets, this.bridge);
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

        reportSize(extraPayload = {}) {
            if (this.bridge) {
                this.bridge.report(extraPayload);
            }
        }

        async render(Component) {
            return this.react.render(Component);
        }
    }

    global.CamisLowcoder = CamisLowcoder;
    global.CamisLowcoderFormat = CamisLowcoderFormat;
    global.CamisLowcoderComponent = CamisLowcoderComponent;
    global.camisLowcoder = new CamisLowcoder();
})(window);
