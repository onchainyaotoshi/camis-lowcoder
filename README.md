# camis-lowcoder

Lightweight helper SDK for building **Lowcoder custom components** with **React** and **Ant Design**.

This library removes repetitive boilerplate when developing custom components for Lowcoder and ensures compatibility between **Editor**, **Preview**, and **Embed** modes.

---

# Features

* Automatically loads **Ant Design**
* Handles **runQuery compatibility** between editor and embed
* Simplifies **React + Lowcoder.connect rendering**
* Avoids duplicate script/style loading
* Works with **Lowcoder Community Edition**
* Async-first modern API

---

# Installation

Include the library via CDN:

```html
<script src="https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USERNAME/camis-lowcoder/camis-lowcoder.js"></script>
```

Or reference a specific version:

```html
<script src="https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USERNAME/camis-lowcoder@0.0.1/camis-lowcoder.js"></script>
```

---

# Basic Usage

Create a container:

```html
<div id="root"></div>
```

Define your component and render it:

```html
<script type="text/babel">

const MyComponent = ({ runQuery, model }) => {

  const { Button, Card, Space } = antd;

  return (
    <Card title={"Hello " + (model.name || "")}>
      <Space>
        <Button
          type="primary"
          onClick={() =>
            camisLowcoder.query.run(runQuery, model.query)
          }
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

No need to manually call:

* `Lowcoder.connect`
* `ReactDOM.createRoot`
* Ant Design loader

---

# API

## ready()

Ensures Ant Design is loaded.

```javascript
const antd = await camisLowcoder.ready();
```

---

## render(component)

Automatically connects and renders a Lowcoder component.

```javascript
await camisLowcoder.render(MyComponent);
```

Equivalent to:

```javascript
const Connected = Lowcoder.connect(MyComponent);
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Connected />);
```

---

## runQuery()

Handles differences between **Lowcoder Editor** and **Embed mode**.

```javascript
camisLowcoder.runQuery(runQuery, "query1");
```

or

```javascript
camisLowcoder.query.run(runQuery, "query1");
```

Internally this resolves the correct invocation:

Editor / Preview:

```javascript
runQuery({ queryName: "query1" })
```

Embed:

```javascript
runQuery("query1")
```

---

# Configuration

Override default settings:

```javascript
camisLowcoder.configure({
  embedHost: "https://your-lowcoder-host.com"
});
```

Available options:

| option       | description                        |
| ------------ | ---------------------------------- |
| embedHost    | hostname used to detect embed mode |
| antdCss      | Ant Design CSS URL                 |
| antdJs       | Ant Design JS URL                  |
| rootSelector | default React root container       |

---

# Advanced Example

Custom root element:

```html
<div id="widget"></div>

<script type="text/babel">

const Widget = ({ runQuery }) => {

  const { Button } = antd;

  return (
    <Button
      onClick={() =>
        camisLowcoder.runQuery(runQuery,"query1")
      }
    >
      Trigger
    </Button>
  );
};

(async () => {
  await camisLowcoder.render(Widget,{
    rootSelector:"#widget"
  });
})();

</script>
```

---

# Architecture

The SDK is structured into modular domains:

| module | purpose                          |
| ------ | -------------------------------- |
| core   | shared configuration and loaders |
| detect | environment detection            |
| query  | Lowcoder query compatibility     |
| assets | external asset management        |
| react  | React rendering helpers          |

---

# Why This Exists

Lowcoder custom components normally require repetitive boilerplate:

```javascript
const ConnectedComponent = Lowcoder.connect(Component);
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<ConnectedComponent />);
```

`camis-lowcoder` abstracts this into a single line:

```javascript
await camisLowcoder.render(Component);
```

---

# Browser Support

Modern browsers with:

* ES6
* async/await
* Promise
* React 18

---

# License

MIT
