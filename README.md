# camis-lowcoder

Lightweight helper SDK for building **Lowcoder custom components** with
less boilerplate.

`camis-lowcoder` helps you:

-   auto-load **Ant Design**
-   handle `runQuery` differences between **editor/preview** and
    **embed/view**
-   auto-create a React root container
-   simplify `Lowcoder.connect(...)` + `ReactDOM.createRoot(...)`

------------------------------------------------------------------------

## Features

-   Async-first API
-   Automatic Ant Design loader
-   Query compatibility helper
-   Automatic root container creation
-   Simple React render helper
-   Small global SDK for Lowcoder custom components

------------------------------------------------------------------------

## CDN

Use it directly from jsDelivr:

``` html
<script src="https://cdn.jsdelivr.net/gh/onchainyaotoshi/camis-lowcoder@main/camis-lowcoder.js"></script>
```

------------------------------------------------------------------------

## Basic Usage

You do **not** need to manually create a root container like:

``` html
<div id="root"></div>
```

The library will create its own root container automatically.

Example:

``` html
<script src="https://cdn.jsdelivr.net/gh/onchainyaotoshi/camis-lowcoder/camis-lowcoder.js"></script>

<script type="text/babel">
const MyComponent = ({ runQuery, model }) => {
  const { Button, Card, Space } = antd;

  return (
    <Card title={"Hello " + (model.name || "")}>
      <Space>
        <Button
          type="primary"
          onClick={() => camisLowcoder.runQuery(runQuery, model.query)}
        >
          Run Query
        </Button>
      </Space>
    </Card>
  );
};

(async () => {
  await camisLowcoder.render(MyComponent);
})();
</script>
```

------------------------------------------------------------------------

## What the library handles for you

Without `camis-lowcoder`, you usually need to write:

``` javascript
const Connected = Lowcoder.connect(MyComponent);

const rootEl = document.getElementById("root");
const root = ReactDOM.createRoot(rootEl);

root.render(
  React.createElement(Connected)
);
```

With `camis-lowcoder`, you only write:

``` javascript
await camisLowcoder.render(MyComponent);
```

------------------------------------------------------------------------

## API

### `camisLowcoder.ready()`

Ensures Ant Design is loaded and returns the `antd` global.

``` javascript
const antd = await camisLowcoder.ready();
```

------------------------------------------------------------------------

### `camisLowcoder.runQuery(runQuery, queryName)`

Runs a Lowcoder query with runtime compatibility.

``` javascript
camisLowcoder.runQuery(runQuery, "query1");
```

This automatically resolves the difference between:

Editor / Preview

``` javascript
runQuery({ queryName: "query1" });
```

Embed / View

``` javascript
runQuery("query1");
```

You can also use the domain-style API:

``` javascript
camisLowcoder.query.run(runQuery, "query1");
```

------------------------------------------------------------------------

### `camisLowcoder.render(Component)`

Automatically:

-   ensures Ant Design is loaded
-   connects your component using `Lowcoder.connect`
-   creates a root container if needed
-   renders your component via React 18

``` javascript
await camisLowcoder.render(MyComponent);
```

Equivalent to:

``` javascript
const Connected = Lowcoder.connect(MyComponent);
const root = ReactDOM.createRoot(document.getElementById("camis-root"));
root.render(React.createElement(Connected));
```

------------------------------------------------------------------------

### `camisLowcoder.configure(options)`

Override default configuration.

``` javascript
camisLowcoder.configure({
  embedHost: "https://sdk.lowcoder.cloud"
});
```

Available options:

  -------------------------------------------------------------------------------------------------
  Option                  Description             Default
  ----------------------- ----------------------- -------------------------------------------------
  antdCss                 Ant Design CSS URL      https://unpkg.com/antd@4.21.4/dist/antd.min.css

  antdJs                  Ant Design JS URL       https://unpkg.com/antd@4.21.4/dist/antd.min.js

  embedHost               Hostname used to detect https://sdk.lowcoder.cloud
                          embed mode              

  rootSelector            Reserved config field   #root
                          from earlier design     
  -------------------------------------------------------------------------------------------------

Note: rendering currently uses an automatic container with id
`camis-root`.

------------------------------------------------------------------------

## Architecture

The SDK is structured into modular domains:

  Module   Purpose
  -------- ----------------------------------
  core     shared configuration and loaders
  detect   environment detection
  query    Lowcoder query compatibility
  assets   external asset management
  react    React rendering helpers

------------------------------------------------------------------------

## Browser Support

Modern browsers with:

-   ES6
-   async/await
-   Promise
-   React 18

------------------------------------------------------------------------

## License

MIT
