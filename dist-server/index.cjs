"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/index.ts
var import_express = __toESM(require("express"), 1);
var import_node_crypto = __toESM(require("node:crypto"), 1);
var import_node_fs = __toESM(require("node:fs"), 1);
var import_promises = __toESM(require("node:fs/promises"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_url = require("node:url");

// shared/validation.ts
var KINDS = ["article", "paragraph", "item"];
function err(errors, path2, message) {
  errors.push({ path: path2, message });
}
function isPlainNode(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function validateClauseTree(root) {
  const errors = [];
  const counts = { articles: 0, paragraphs: 0, items: 0, nodes: 0 };
  if (!Array.isArray(root)) {
    err(errors, "document", "document.root \u5FC5\u987B\u662F\u6570\u7EC4");
    return { ok: false, errors };
  }
  const seenIds = /* @__PURE__ */ new Map();
  const walkLevel = (nodes, parentPath, depth) => {
    const expectedKind = KINDS[depth];
    nodes.forEach((rawNode, i) => {
      const nodePath = `${parentPath}[${i}]`;
      if (!isPlainNode(rawNode)) {
        err(errors, nodePath, `\u8282\u70B9\u5FC5\u987B\u662F\u5BF9\u8C61\uFF0C\u5B9E\u9645\u4E3A ${rawNode === null ? "null" : typeof rawNode}`);
        return;
      }
      const node = rawNode;
      if (typeof node.id !== "string" || node.id.length === 0) {
        err(errors, nodePath, "\u7F3A\u5C11\u5FC5\u9700\u5B57\u6BB5 id\uFF08\u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32\uFF09\uFF0C\u8282\u70B9 ID \u662F\u5F15\u7528\u5B9A\u4F4D\u4E0E\u5BA1\u7B7E\u5173\u8054\u7684\u552F\u4E00\u952E");
      } else {
        const firstPath = seenIds.get(node.id);
        if (firstPath) {
          err(errors, nodePath, `\u8282\u70B9 ID\u300C${node.id}\u300D\u4E0E ${firstPath} \u91CD\u590D\uFF1A\u5168\u6811 ID \u5FC5\u987B\u552F\u4E00\uFF0C\u91CD\u590D ID \u4F1A\u4F7F\u5206\u6790\u7D22\u5F15\u8986\u76D6\u524D\u4E00\u8282\u70B9\u3001\u5F15\u7528\u4E0E\u5BA1\u7B7E\u5173\u8054\u9519\u8BEF`);
        } else {
          seenIds.set(node.id, nodePath);
        }
      }
      if (typeof node.kind !== "string") {
        err(errors, nodePath, `\u7F3A\u5C11\u5FC5\u9700\u5B57\u6BB5 kind\uFF08\u8BE5\u5C42\u5FC5\u987B\u4E3A\u300C${expectedKind}\u300D\uFF09`);
      } else if (!KINDS.includes(node.kind)) {
        err(errors, nodePath, `\u8282\u70B9 kind\u300C${node.kind}\u300D\u975E\u6CD5\uFF0C\u4EC5\u652F\u6301 article / paragraph / item`);
      } else if (node.kind !== expectedKind) {
        err(
          errors,
          nodePath,
          `\u5C42\u7EA7\u7C7B\u578B\u9519\u8BEF\uFF1A${pathLabel(parentPath, i)}\u5E94\u4E3A\u300C${expectedKind}\u300D\uFF0C\u5B9E\u9645\u4E3A\u300C${node.kind}\u300D\uFF08\u6761 \u2192 \u6B3E \u2192 \u9879\u4E0D\u53EF\u9519\u4F4D\uFF09`
        );
      } else if (node.kind === "article") {
        counts.articles += 1;
      } else if (node.kind === "paragraph") {
        counts.paragraphs += 1;
      } else {
        counts.items += 1;
      }
      counts.nodes += 1;
      if (typeof node.text !== "string") {
        err(errors, nodePath, '\u7F3A\u5C11\u5FC5\u9700\u5B57\u6BB5 text\uFF08\u5FC5\u987B\u662F\u5B57\u7B26\u4E32\uFF1B\u7A7A\u6B63\u6587\u53EF\u4E3A\u7A7A\u5B57\u7B26\u4E32 ""\uFF09');
      }
      if (node.title !== void 0 && typeof node.title !== "string") {
        err(errors, nodePath, "\u5B57\u6BB5 title \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\uFF08\u6761\u6807\u9898\uFF09");
      }
      if (node.suffix !== void 0 && typeof node.suffix !== "string") {
        err(errors, nodePath, "\u5B57\u6BB5 suffix \u5FC5\u987B\u662F\u5B57\u7B26\u4E32\uFF08\u6761\u5E8F\u53F7\u540E\u7F00\uFF0C\u5982\u300C\u4E4B\u4E00\u300D\uFF09");
      }
      if (node.ordinal !== void 0 && typeof node.ordinal !== "number") {
        err(errors, nodePath, "\u5B57\u6BB5 ordinal \u5FC5\u987B\u662F\u6570\u5B57\uFF08\u5BFC\u5165\u65F6\u4F1A\u6309\u7ED3\u6784\u4F4D\u7F6E\u91CD\u65B0\u7F16\u53F7\uFF09");
      }
      if (!Array.isArray(node.children)) {
        err(errors, nodePath, `\u7F3A\u5C11\u5FC5\u9700\u5B57\u6BB5 children\uFF08\u5FC5\u987B\u662F\u6570\u7EC4\uFF1B${expectedKind === "item" ? "\u9879\u4E3A\u53F6\u5B50\u8282\u70B9\uFF0C\u5E94\u4E3A []" : "\u65E0\u4E0B\u7EA7\u8282\u70B9\u65F6\u4E5F\u5E94\u4E3A []"}\uFF09`);
        return;
      }
      if (depth === 0 || depth === 1) {
        walkLevel(node.children, `${nodePath}.children`, depth + 1);
      } else {
        node.children.forEach((child, ci) => {
          const childPath = `${nodePath}.children[${ci}]`;
          if (!isPlainNode(child)) {
            err(errors, childPath, `\u8282\u70B9\u5FC5\u987B\u662F\u5BF9\u8C61\uFF0C\u5B9E\u9645\u4E3A ${child === null ? "null" : typeof child}`);
            return;
          }
          const childKind = child.kind;
          err(
            errors,
            childPath,
            `\u5C42\u7EA7\u7C7B\u578B\u9519\u8BEF\uFF1A\u9879\uFF08item\uFF09\u4E3A\u53F6\u5B50\u8282\u70B9\uFF0C\u4E0D\u80FD\u518D\u5305\u542B\u4E0B\u7EA7\u8282\u70B9${typeof childKind === "string" ? `\uFF08\u53D1\u73B0 kind\u300C${childKind}\u300D\uFF09` : ""}`
          );
        });
      }
    });
  };
  walkLevel(root, "document.root", 0);
  return errors.length === 0 ? { ok: true, errors: [], counts } : { ok: false, errors };
}
function pathLabel(parentPath, index) {
  const depth = (parentPath.match(/\.children/g) ?? []).length;
  const ordinal = index + 1;
  if (depth === 0) return `\u7B2C ${ordinal} \u6761`;
  if (depth === 1) return `\u8BE5\u6761\u7B2C ${ordinal} \u6B3E`;
  return `\u8BE5\u6B3E\u7B2C ${ordinal} \u9879`;
}
function validateDocument(document) {
  if (!isPlainNode(document)) {
    return {
      ok: false,
      errors: [{ path: "document", message: "\u7F3A\u5C11 document\uFF1A\u5BFC\u5165\u5305\u5FC5\u987B\u5305\u542B document \u5BF9\u8C61" }]
    };
  }
  const errors = [];
  if (typeof document.title !== "string") {
    err(errors, "document.title", "document.title \u5FC5\u987B\u662F\u5B57\u7B26\u4E32");
  }
  const tree = validateClauseTree(document.root);
  if (!tree.ok) errors.push(...tree.errors);
  if (errors.length > 0) return { ok: false, errors };
  const validDoc = document;
  return {
    ok: true,
    errors: [],
    counts: tree.counts,
    title: validDoc.title,
    rootCount: validDoc.root.length
  };
}
function firstErrorMessage(result) {
  const first = result.errors[0];
  return first ? `${first.path}\uFF1A${first.message}` : "\u6587\u6863\u7ED3\u6784\u4E0D\u5408\u6CD5";
}

// server/index.ts
var import_meta = {};
var here = import_node_path.default.dirname((0, import_node_url.fileURLToPath)(import_meta.url));
var PORT = Number(process.env.PORT ?? 3e3);
var DATA_DIR = process.env.DATA_DIR ? import_node_path.default.resolve(process.env.DATA_DIR) : import_node_path.default.join(process.env.HOME ?? process.cwd(), ".clause-reference-validator");
var DATA_FILE = import_node_path.default.join(DATA_DIR, "state.json");
var app = (0, import_express.default)();
app.use(import_express.default.json({ limit: "10mb" }));
function isPersistedState(v) {
  if (!v || typeof v !== "object") return false;
  const doc = v.doc;
  return Boolean(doc && Array.isArray(doc.root) && typeof doc.title === "string");
}
async function readState() {
  try {
    const raw = await import_promises.default.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return isPersistedState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
async function atomicWriteState(state) {
  await import_promises.default.mkdir(DATA_DIR, { recursive: true });
  const payload = JSON.stringify(state);
  const tmp = import_node_path.default.join(DATA_DIR, `.state.${process.pid}.${import_node_crypto.default.randomUUID()}.tmp`);
  let fh = null;
  try {
    fh = await import_promises.default.open(tmp, "wx");
    await fh.writeFile(payload, "utf8");
    await fh.sync();
    await fh.close();
    fh = null;
    await import_promises.default.rename(tmp, DATA_FILE);
  } catch (err2) {
    if (fh) await fh.close().catch(() => void 0);
    await import_promises.default.rm(tmp, { force: true }).catch(() => void 0);
    throw err2;
  }
}
var writeChain = Promise.resolve();
function enqueueWrite(state) {
  const next = writeChain.then(() => atomicWriteState(state));
  writeChain = next.then(
    () => void 0,
    () => void 0
  );
  return next;
}
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "clause-reference-validator" });
});
app.get("/api/state", async (_req, res) => {
  const state = await readState();
  res.json({ state });
});
app.put("/api/state", async (req, res) => {
  const body = req.body;
  if (!isPersistedState(body)) {
    res.status(400).json({ error: "\u6570\u636E\u683C\u5F0F\u4E0D\u5408\u6CD5\uFF1A\u9700\u8981 { doc: { title, root }, confirmed }" });
    return;
  }
  try {
    await enqueueWrite(body);
    res.json({ ok: true, savedAt: Date.now() });
  } catch (err2) {
    res.status(500).json({ error: `\u4FDD\u5B58\u5931\u8D25\uFF1A${err2.message}` });
  }
});
app.post("/api/validate", (req, res) => {
  const bundle = req.body;
  if (!bundle || typeof bundle !== "object" || !("document" in bundle)) {
    res.status(400).json({ error: "\u5BFC\u5165\u6587\u4EF6\u7F3A\u5C11 document.root" });
    return;
  }
  const result = validateDocument(bundle.document);
  if (!result.ok) {
    res.status(400).json({ error: `\u5BFC\u5165\u6587\u4EF6\u7ED3\u6784\u4E0D\u5408\u6CD5\uFF1A${firstErrorMessage(result)}` });
    return;
  }
  res.json({ ok: true, title: result.title, rootCount: result.rootCount });
});
var distDir = import_node_path.default.resolve(here, "../dist");
if (import_node_fs.default.existsSync(distDir)) {
  app.use(import_express.default.static(distDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile(import_node_path.default.join(distDir, "index.html"));
    } else {
      next();
    }
  });
}
async function cleanupStaleTmpFiles() {
  try {
    const entries = await import_node_fs.default.promises.readdir(DATA_DIR);
    await Promise.all(
      entries.filter(
        (name) => name.startsWith(".state.") && name.endsWith(".tmp") || name === "state.json.tmp"
      ).map(
        (name) => import_node_fs.default.promises.rm(import_node_path.default.join(DATA_DIR, name), { force: true }).catch(() => void 0)
      )
    );
  } catch {
  }
}
void (async () => {
  await cleanupStaleTmpFiles();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\u6761\u6B3E\u5F15\u7528\u6821\u9A8C\u53F0\u5DF2\u542F\u52A8\uFF1A http://localhost:${PORT}`);
    console.log(`\u672C\u5730\u6570\u636E\u6587\u4EF6\uFF1A${DATA_FILE}`);
  });
})();
