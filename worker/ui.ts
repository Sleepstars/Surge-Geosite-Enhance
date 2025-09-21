export const renderHomePage = (): string => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Surge Geosite Explorer</title>
  <style>
    :root {
      --bg: #0f172a;
      --bg-card: rgba(15, 23, 42, 0.65);
      --bg-card-hover: rgba(30, 41, 59, 0.75);
      --border: rgba(148, 163, 184, 0.18);
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-strong: #0ea5e9;
      --danger: #f87171;
      --positive: #4ade80;
      --font-sans: "Inter", "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
      --font-mono: "JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, monospace;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.12), transparent 35%),
        radial-gradient(circle at 80% 0%, rgba(14, 165, 233, 0.18), transparent 45%),
        radial-gradient(circle at 0% 80%, rgba(148, 163, 184, 0.12), transparent 40%),
        var(--bg);
      color: var(--text);
      font-family: var(--font-sans);
      display: flex;
      flex-direction: column;
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    a:hover {
      color: var(--accent-strong);
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 24px clamp(16px, 4vw, 48px);
      gap: 24px;
    }

    .brand {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .brand .title {
      font-size: clamp(1.6rem, 2.4vw, 2.2rem);
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .brand .subtitle {
      font-size: 0.95rem;
      color: var(--text-muted);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .actions a {
      padding: 10px 18px;
      border-radius: 999px;
      border: 1px solid rgba(56, 189, 248, 0.35);
      background: rgba(56, 189, 248, 0.08);
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }

    .actions a:hover {
      background: rgba(56, 189, 248, 0.16);
      border-color: rgba(56, 189, 248, 0.55);
    }

    .container {
      width: min(1160px, 100% - 32px);
      margin: 0 auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-bottom: 48px;
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: clamp(20px, 4vw, 28px);
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.35);
      backdrop-filter: blur(18px);
      transition: background 0.2s ease, transform 0.2s ease;
    }

    .card:hover {
      background: var(--bg-card-hover);
      transform: translateY(-2px);
    }

    .card h1,
    .card h2,
    .card h3 {
      margin: 0 0 12px;
      font-weight: 600;
    }

    .card p {
      margin: 0 0 12px;
      color: var(--text-muted);
      font-size: 0.95rem;
    }

    .intro .hint-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    .hint-list span {
      background: rgba(148, 163, 184, 0.14);
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 0.82rem;
      color: var(--text-muted);
    }

    .dataset-toggle {
      margin-top: 18px;
      display: inline-flex;
      padding: 4px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.12);
      border: 1px solid rgba(148, 163, 184, 0.25);
    }

    .dataset-toggle button {
      border: none;
      background: transparent;
      color: var(--text-muted);
      padding: 10px 22px;
      font-size: 0.95rem;
      font-weight: 500;
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .dataset-toggle button.active {
      background: var(--accent);
      color: #0f172a;
      box-shadow: 0 8px 24px rgba(56, 189, 248, 0.35);
    }

    .dataset-panel {
      display: none;
    }

    .dataset-panel.active {
      display: block;
      animation: fadeIn 0.25s ease;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .panel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 24px;
    }

    .control-group {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 18px;
    }

    .control-group label {
      display: flex;
      flex-direction: column;
      font-size: 0.82rem;
      color: var(--text-muted);
      gap: 6px;
    }

    input[type="text"],
    input[type="search"],
    select,
    textarea {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 12px;
      padding: 10px 12px;
      color: var(--text);
      font-family: var(--font-sans);
      font-size: 0.95rem;
      min-width: 140px;
      transition: border 0.15s ease, background 0.15s ease;
    }

    input[type="text"]:focus,
    input[type="search"]:focus,
    select:focus,
    textarea:focus {
      outline: none;
      border-color: var(--accent);
      background: rgba(15, 23, 42, 0.78);
    }

    .primary-btn {
      background: var(--accent);
      border: none;
      color: #0f172a;
      font-weight: 600;
      padding: 10px 18px;
      border-radius: 12px;
      cursor: pointer;
      transition: box-shadow 0.2s ease, transform 0.2s ease;
    }

    .primary-btn:hover {
      box-shadow: 0 10px 26px rgba(56, 189, 248, 0.4);
      transform: translateY(-1px);
    }

    .name-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 320px;
      overflow: auto;
      padding-right: 6px;
    }

    .list-group {
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      opacity: 0.8;
      margin-top: 8px;
    }

    .name-item {
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 12px;
      padding: 9px 12px;
      font-size: 0.92rem;
      background: rgba(15, 23, 42, 0.55);
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
    }

    .name-item:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .name-item.active {
      background: var(--accent);
      color: #0f172a;
      border-color: transparent;
      box-shadow: 0 0 0 1px rgba(8, 47, 73, 0.2);
    }

    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;
    }

    .summary .stat {
      background: rgba(148, 163, 184, 0.12);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 14px;
      padding: 10px 14px;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .tag-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }

    .tag-cloud span {
      font-size: 0.78rem;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.25);
      color: var(--accent);
    }

    .rule-controls {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 12px;
    }

    .rule-controls input {
      flex: 1;
    }

    .rule-list,
    .cidr-list,
    .match-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 320px;
      overflow: auto;
      padding-right: 4px;
    }

    .rule-row,
    .cidr-row,
    .match-row {
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 14px;
      padding: 12px 14px;
      background: rgba(15, 23, 42, 0.58);
      display: grid;
      gap: 6px;
    }

    .rule-row:hover,
    .cidr-row:hover,
    .match-row:hover {
      border-color: rgba(56, 189, 248, 0.45);
    }

    .rule-header,
    .match-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 0.85rem;
      flex-wrap: wrap;
    }

    .rule-type,
    .match-meta,
    .cidr-type {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
      color: var(--accent);
    }

    .rule-value,
    .cidr-value {
      font-family: var(--font-mono);
      font-size: 0.93rem;
      color: var(--text);
      word-break: break-all;
    }

    .rule-attrs,
    .match-reason {
      color: var(--text-muted);
      font-size: 0.78rem;
    }

    .empty-state {
      border: 1px dashed rgba(148, 163, 184, 0.35);
      border-radius: 14px;
      padding: 22px;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.95rem;
      background: rgba(15, 23, 42, 0.4);
    }

    .status-line {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 12px;
      min-height: 18px;
    }

    .status-line strong {
      color: var(--accent);
      font-weight: 600;
    }

    .chip-link {
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.25);
      color: var(--accent);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 0.78rem;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .chip-button {
      background: rgba(148, 163, 184, 0.12);
      border: 1px solid rgba(148, 163, 184, 0.25);
      color: var(--text-muted);
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 0.78rem;
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .chip-button:hover {
      border-color: rgba(56, 189, 248, 0.5);
      color: var(--accent);
    }

    .chip-group {
      display: inline-flex;
      gap: 8px;
      align-items: center;
    }

    .footer {
      padding: 20px clamp(16px, 4vw, 48px) 32px;
      color: var(--text-muted);
      font-size: 0.85rem;
      text-align: center;
    }

    .tree-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-bottom: 14px;
    }

    .tree-controls input {
      flex: 1 1 200px;
    }

    .tree-controls button {
      border: 1px solid rgba(148, 163, 184, 0.25);
      background: rgba(148, 163, 184, 0.08);
      color: var(--text-muted);
      padding: 8px 14px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .tree-controls button:hover {
      border-color: rgba(56, 189, 248, 0.45);
      color: var(--accent);
    }

    .tree-container {
      max-height: 420px;
      overflow: auto;
      padding-right: 6px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .tree-node {
      border-left: 1px solid rgba(148, 163, 184, 0.2);
      padding-left: 12px;
    }

    .tree-node.depth-0 {
      border-left: none;
      padding-left: 0;
    }

    .tree-header {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tree-toggle {
      width: 26px;
      height: 26px;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.55);
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .tree-toggle.spacer {
      border: none;
      background: transparent;
      cursor: default;
      width: 24px;
    }

    .tree-toggle:disabled {
      opacity: 0.4;
      cursor: default;
    }

    .tree-label {
      font-size: 0.9rem;
    }

    .tree-label.match {
      color: var(--accent);
    }

    .tree-node.highlight .tree-label {
      color: var(--accent);
    }

    .tree-select {
      border: 1px solid rgba(56, 189, 248, 0.3);
      background: rgba(56, 189, 248, 0.12);
      color: var(--accent);
      border-radius: 12px;
      padding: 6px 12px;
      font-size: 0.8rem;
      font-family: var(--font-mono);
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .tree-select:hover {
      border-color: rgba(56, 189, 248, 0.55);
    }

    .tree-select.active {
      background: var(--accent);
      color: #0f172a;
      border-color: transparent;
      box-shadow: 0 0 0 1px rgba(8, 47, 73, 0.25);
    }

    .tree-children {
      margin-left: 20px;
      margin-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      border-left: 1px dashed rgba(148, 163, 184, 0.25);
      padding-left: 12px;
    }

    @media (max-width: 720px) {
      .topbar {
        flex-direction: column;
        align-items: flex-start;
      }

      .actions {
        align-self: stretch;
      }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span class="title">Surge Geosite Explorer</span>
      <span class="subtitle">直观浏览与反向匹配 GeoSite / GeoIP 规则</span>
    </div>
    <nav class="actions">
      <a href="/github" target="_blank" rel="noreferrer">GitHub</a>
    </nav>
  </header>
  <main class="container">
    <section class="intro card">
      <h1>规则总览</h1>
      <p>GeoSite 提供丰富的域名分类，GeoIP 提供精细的 IP 段划分。通过树状结构与反向检索，可快速定位策略归属。</p>
      <div class="hint-list">
        <span>GeoSite：树状展开，逐级查看规则组</span>
        <span>GeoIP：支持关键字过滤与 IPv4 / IPv6 拆分</span>
        <span>反向匹配：自动识别域名、关键字与 IP/CIDR</span>
      </div>
      <div class="dataset-toggle">
        <button type="button" class="active" data-dataset="geosite">GeoSite</button>
        <button type="button" data-dataset="geoip">GeoIP</button>
      </div>
    </section>

    <section id="geosite-panel" class="dataset-panel active">
      <div class="panel-grid">
        <article class="card">
          <h2>GeoSite · 规则树</h2>
          <p>按名称片段自动构建树状结构，可展开查看子分类，并在右侧载入规则详情。</p>
          <div class="tree-controls">
            <input id="geosite-tree-search" type="search" placeholder="搜索 GeoSite 名称，例如 APPLE 或 MEDIA" />
            <button id="geosite-expand-all" type="button">展开全部</button>
            <button id="geosite-collapse-all" type="button">折叠全部</button>
          </div>
          <div class="tree-container" id="geosite-tree"></div>
        </article>
        <article class="card">
          <h2>规则详情</h2>
          <div class="status-line" id="geosite-status">请选择规则组以查看详情。</div>
          <div class="control-group" style="margin-bottom:12px;">
            <label>
              属性过滤
              <input id="geosite-attr-filter" type="text" placeholder="如 cn 或 !cn，留空为全部" />
            </label>
          </div>
          <div class="summary" id="geosite-summary"></div>
          <div class="tag-cloud" id="geosite-tags"></div>
          <div class="rule-controls">
            <input id="geosite-rule-filter" type="search" placeholder="在当前规则中搜索" />
            <div class="chip-group">
              <a id="geosite-download" class="chip-link" href="#" target="_blank" rel="noreferrer" hidden>下载 SRS</a>
              <button id="geosite-copy" class="chip-button" type="button" hidden>复制下载链接</button>
            </div>
          </div>
          <div class="rule-list" id="geosite-rule-list"></div>
        </article>
      </div>

      <article class="card">
        <h2>GeoSite · 反向查询</h2>
        <p>输入域名 / 关键字，自动匹配所属的规则组，可选限定在当前树搜索结果内。</p>
        <div class="control-group">
          <label style="flex:1">
            查询内容
            <input id="geosite-reverse-input" type="search" placeholder="例如 apple.com 或 youtube" />
          </label>
          <label>
            属性限定
            <input id="geosite-reverse-attr" type="text" placeholder="如 cn 或 !cn" />
          </label>
          <label>
            结果上限
            <select id="geosite-reverse-limit">
              <option value="20">20</option>
              <option value="50" selected>50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
        <div class="control-group" style="align-items:center">
          <label style="flex:1; flex-direction:row; align-items:center; gap:8px;">
            <input id="geosite-reverse-scope" type="checkbox" />
            <span>仅在当前树筛选出的规则组内搜索</span>
          </label>
          <button id="geosite-reverse-btn" class="primary-btn" type="button">开始匹配</button>
        </div>
        <div class="status-line" id="geosite-reverse-status"></div>
        <div class="match-list" id="geosite-reverse-results"></div>
      </article>
    </section>

    <section id="geoip-panel" class="dataset-panel">
      <div class="panel-grid">
        <article class="card">
          <h2>GeoIP · 规则列表</h2>
          <p>按名称快速检索规则集，可选择仅显示 IPv4 或 IPv6，并加载右侧 CIDR 详情。</p>
          <div class="control-group">
            <label style="flex:1">
              名称搜索
              <input id="geoip-search" type="search" placeholder="输入关键字，例如 CN、APPLE" />
            </label>
            <label>
              显示类型
              <select id="geoip-version">
                <option value="both" selected>IPv4 + IPv6</option>
                <option value="ipv4">仅 IPv4</option>
                <option value="ipv6">仅 IPv6</option>
              </select>
            </label>
          </div>
          <div class="name-list" id="geoip-name-list"></div>
        </article>
        <article class="card">
          <h2>CIDR 列表</h2>
          <div class="status-line" id="geoip-status">请选择规则组以查看 CIDR。</div>
          <div class="summary" id="geoip-summary"></div>
          <div class="rule-controls">
            <input id="geoip-cidr-filter" type="search" placeholder="在 CIDR 中搜索" />
            <div class="chip-group">
              <a id="geoip-download" class="chip-link" href="#" target="_blank" rel="noreferrer" hidden>下载 SRS</a>
              <button id="geoip-copy" class="chip-button" type="button" hidden>复制下载链接</button>
            </div>
          </div>
          <div class="cidr-list" id="geoip-cidr-list"></div>
        </article>
      </div>

      <article class="card">
        <h2>GeoIP · 反向查询</h2>
        <p>输入 IP 地址或 CIDR 片段，快速定位所属的规则组。</p>
        <div class="control-group">
          <label style="flex:1">
            查询内容
            <input id="geoip-reverse-input" type="search" placeholder="例如 1.1.1.1 或 2406:da00::" />
          </label>
          <label>
            匹配类型
            <select id="geoip-reverse-version">
              <option value="both" selected>自动识别</option>
              <option value="ipv4">仅 IPv4</option>
              <option value="ipv6">仅 IPv6</option>
            </select>
          </label>
          <label>
            结果上限
            <select id="geoip-reverse-limit">
              <option value="20">20</option>
              <option value="50" selected>50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
        <div class="control-group" style="align-items:center">
          <label style="flex:1; flex-direction:row; align-items:center; gap:8px;">
            <input id="geoip-reverse-scope" type="checkbox" />
            <span>仅在当前过滤结果内搜索</span>
          </label>
          <button id="geoip-reverse-btn" class="primary-btn" type="button">开始匹配</button>
        </div>
        <div class="status-line" id="geoip-reverse-status"></div>
        <div class="match-list" id="geoip-reverse-results"></div>
      </article>
    </section>
  </main>
  <footer class="footer">
    数据源通过 KV / R2 自动同步，页面调用 Worker API 实时获取最新规则。建议配合 Surge 等客户端交叉验证。
  </footer>
  <script>
    "use strict";
    (function () {
      const splitSegments = function (name) {
        return name
          .split(/[-_:]+/)
          .map(function (part) {
            return part.trim();
          })
          .filter(function (part) {
            return part.length > 0;
          });
      };

      const makeTreeNode = function (label, path) {
        return {
          label: label,
          path: path,
          fullName: null,
          children: new Map(),
        };
      };

      const buildGeositeTree = function (names) {
        const root = makeTreeNode("", "");
        for (const name of names) {
          const parts = splitSegments(name);
          const segments = parts.length ? parts : [name];
          let current = root;
          for (let i = 0; i < segments.length; i += 1) {
            const segment = segments[i];
            const nextPath = current.path ? current.path + "/" + segment : segment;
            let child = current.children.get(segment);
            if (!child) {
              child = makeTreeNode(segment, nextPath);
              current.children.set(segment, child);
            }
            if (i === segments.length - 1) {
              child.fullName = name;
            }
            current = child;
          }
        }
        const branchPaths = [];
        const collect = function (node) {
          if (node.children.size > 0 && node.path) {
            branchPaths.push(node.path);
          }
          for (const child of node.children.values()) {
            collect(child);
          }
        };
        collect(root);
        return { root: root, branchPaths: branchPaths };
      };

      const sortChildren = function (node) {
        return Array.from(node.children.values()).sort(function (a, b) {
          return a.label.localeCompare(b.label, "en", { sensitivity: "base" });
        });
      };

      const debounce = function (fn, delay) {
        let timer = null;
        return function () {
          const args = arguments;
          clearTimeout(timer);
          timer = setTimeout(function () {
            fn.apply(null, args);
          }, delay || 200);
        };
      };

      const fetchJson = function (url, options) {
        return fetch(url, options || {}).then(function (res) {
          if (!res.ok) {
            throw new Error("请求失败：" + res.status);
          }
          return res.json();
        });
      };

      const state = {
        active: "geosite",
        geosite: {
          index: {},
          names: [],
          filteredNames: [],
          treeRoot: makeTreeNode("", ""),
          branchPaths: [],
          treeSearch: "",
          expanded: {},
          visibleNames: [],
          detailCache: new Map(),
          currentName: "",
          currentDetail: null,
          ruleFilter: "",
          attribute: "",
        },
        geoip: {
          index: {},
          names: [],
          filteredNames: [],
          filterText: "",
          version: "both",
          detailCache: new Map(),
          currentName: "",
          currentDetail: null,
          cidrFilter: "",
        },
      };

      const dom = {
        datasetButtons: Array.from(document.querySelectorAll("[data-dataset]")),
        panels: {
          geosite: document.getElementById("geosite-panel"),
          geoip: document.getElementById("geoip-panel"),
        },
        geosite: {
          treeSearch: document.getElementById("geosite-tree-search"),
          expandAll: document.getElementById("geosite-expand-all"),
          collapseAll: document.getElementById("geosite-collapse-all"),
          tree: document.getElementById("geosite-tree"),
          status: document.getElementById("geosite-status"),
          summary: document.getElementById("geosite-summary"),
          tags: document.getElementById("geosite-tags"),
          ruleFilter: document.getElementById("geosite-rule-filter"),
          ruleList: document.getElementById("geosite-rule-list"),
          attrFilter: document.getElementById("geosite-attr-filter"),
          download: document.getElementById("geosite-download"),
          copyButton: document.getElementById("geosite-copy"),
          reverseInput: document.getElementById("geosite-reverse-input"),
          reverseAttr: document.getElementById("geosite-reverse-attr"),
          reverseLimit: document.getElementById("geosite-reverse-limit"),
          reverseScope: document.getElementById("geosite-reverse-scope"),
          reverseButton: document.getElementById("geosite-reverse-btn"),
          reverseStatus: document.getElementById("geosite-reverse-status"),
          reverseResults: document.getElementById("geosite-reverse-results"),
        },
        geoip: {
          searchInput: document.getElementById("geoip-search"),
          versionSelect: document.getElementById("geoip-version"),
          nameList: document.getElementById("geoip-name-list"),
          status: document.getElementById("geoip-status"),
          summary: document.getElementById("geoip-summary"),
          cidrFilter: document.getElementById("geoip-cidr-filter"),
          cidrList: document.getElementById("geoip-cidr-list"),
          download: document.getElementById("geoip-download"),
          copyButton: document.getElementById("geoip-copy"),
          reverseInput: document.getElementById("geoip-reverse-input"),
          reverseVersion: document.getElementById("geoip-reverse-version"),
          reverseLimit: document.getElementById("geoip-reverse-limit"),
          reverseScope: document.getElementById("geoip-reverse-scope"),
          reverseButton: document.getElementById("geoip-reverse-btn"),
          reverseStatus: document.getElementById("geoip-reverse-status"),
          reverseResults: document.getElementById("geoip-reverse-results"),
        },
      };

      const updateSrsLink = function (datasetKey, name) {
        const linkEl = dom[datasetKey].download;
        const copyBtn = dom[datasetKey].copyButton;
        if (!name) {
          linkEl.hidden = true;
          linkEl.href = "#";
          copyBtn.hidden = true;
          return;
        }
        const base = datasetKey === "geosite" ? "/srs-geosite/" : "/srs-geoip/";
        linkEl.hidden = false;
        linkEl.href = base + encodeURIComponent(name) + ".srs";
        copyBtn.hidden = false;
        copyBtn.dataset.url = linkEl.href;
      };

      const renderGeositeDetail = function (payload) {
        state.geosite.currentDetail = payload;
        const stats = payload.stats || { overall: { total: 0 }, filtered: { total: 0 } };
        dom.geosite.summary.innerHTML = "";
        const summaryItems = [
          "全部规则 " + stats.overall.total,
          "当前视图 " + stats.filtered.total,
          "DOMAIN " + (stats.filtered.domain || 0),
          "FULL " + (stats.filtered.full || 0),
          "KEYWORD " + (stats.filtered.keyword || 0),
          "REGEXP " + (stats.filtered.regexp || 0),
        ];
        summaryItems.forEach(function (text) {
          const chip = document.createElement("div");
          chip.className = "stat";
          chip.textContent = text;
          dom.geosite.summary.appendChild(chip);
        });

        dom.geosite.tags.innerHTML = "";
        (payload.attributes || []).forEach(function (tag) {
          const span = document.createElement("span");
          span.textContent = tag;
          dom.geosite.tags.appendChild(span);
        });

        dom.geosite.status.innerHTML =
          "<strong>" + payload.name + "</strong> · 共 " + stats.filtered.total + " 条规则";
        updateSrsLink("geosite", payload.name);
        applyGeositeRuleFilter();
      };

      const applyGeositeRuleFilter = function () {
        const detail = state.geosite.currentDetail;
        const listEl = dom.geosite.ruleList;
        listEl.innerHTML = "";
        if (!detail || !Array.isArray(detail.rules) || detail.rules.length === 0) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.textContent = "暂无匹配规则";
          listEl.appendChild(empty);
          return;
        }
        const term = (state.geosite.ruleFilter || "").trim().toLowerCase();
        let rules = detail.rules;
        if (term) {
          rules = rules.filter(function (rule) {
            const combined = (rule.type + " " + rule.value + " " + (rule.attrs || []).join(" ")).toLowerCase();
            return combined.includes(term);
          });
        }
        if (!rules.length) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.textContent = "过滤条件下无匹配结果";
          listEl.appendChild(empty);
          return;
        }
        const frag = document.createDocumentFragment();
        rules.forEach(function (rule) {
          const row = document.createElement("div");
          row.className = "rule-row";

          const header = document.createElement("div");
          header.className = "rule-header";
          const type = document.createElement("span");
          type.className = "rule-type";
          type.textContent = rule.type;
          header.appendChild(type);
          if (detail.url) {
            const link = document.createElement("a");
            link.href = detail.url;
            link.target = "_blank";
            link.rel = "noreferrer";
            link.className = "chip-link";
            link.textContent = "查看文本";
            header.appendChild(link);
          }
          row.appendChild(header);

          const value = document.createElement("div");
          value.className = "rule-value";
          value.textContent = rule.value;
          row.appendChild(value);

          if (rule.attrs && rule.attrs.length) {
            const attrs = document.createElement("div");
            attrs.className = "rule-attrs";
            attrs.textContent = "标签：" + rule.attrs.join(", ");
            row.appendChild(attrs);
          }
          frag.appendChild(row);
        });
        listEl.appendChild(frag);
      };

      const renderGeoipDetail = function (payload) {
        state.geoip.currentDetail = payload;
        const stats = payload.stats || { returnedV4: 0, returnedV6: 0 };
        dom.geoip.summary.innerHTML = "";
        const items = [
          "IPv4 共 " + stats.totalV4,
          "IPv6 共 " + stats.totalV6,
          "当前 IPv4 " + stats.returnedV4,
          "当前 IPv6 " + stats.returnedV6,
        ];
        items.forEach(function (text) {
          const chip = document.createElement("div");
          chip.className = "stat";
          chip.textContent = text;
          dom.geoip.summary.appendChild(chip);
        });
        dom.geoip.status.innerHTML =
          "<strong>" + payload.name + "</strong> · IPv4 " + stats.returnedV4 + " / IPv6 " + stats.returnedV6;
        updateSrsLink("geoip", payload.name);
        applyGeoipCidrFilter();
      };

      const applyGeoipCidrFilter = function () {
        const detail = state.geoip.currentDetail;
        const listEl = dom.geoip.cidrList;
        listEl.innerHTML = "";
        if (!detail) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.textContent = "请选择规则组";
          listEl.appendChild(empty);
          return;
        }
        const term = (state.geoip.cidrFilter || "").trim().toLowerCase();
        let cidrs = [];
        if (detail.cidr4 && detail.cidr4.length) {
          detail.cidr4.forEach(function (cidr) {
            cidrs.push({ version: "IPv4", value: cidr });
          });
        }
        if (detail.cidr6 && detail.cidr6.length) {
          detail.cidr6.forEach(function (cidr) {
            cidrs.push({ version: "IPv6", value: cidr });
          });
        }
        if (term) {
          cidrs = cidrs.filter(function (item) {
            return item.value.toLowerCase().includes(term);
          });
        }
        if (!cidrs.length) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.textContent = "未找到匹配的 CIDR";
          listEl.appendChild(empty);
          return;
        }
        const frag = document.createDocumentFragment();
        cidrs.forEach(function (item) {
          const row = document.createElement("div");
          row.className = "cidr-row";
          const header = document.createElement("div");
          header.className = "rule-header";
          const type = document.createElement("span");
          type.className = "cidr-type";
          type.textContent = item.version;
          header.appendChild(type);
          row.appendChild(header);
          const value = document.createElement("div");
          value.className = "cidr-value";
          value.textContent = item.value;
          row.appendChild(value);
          frag.appendChild(row);
        });
        listEl.appendChild(frag);
      };

      const renderGeositeTree = function () {
        const container = dom.geosite.tree;
        container.innerHTML = "";
        state.geosite.visibleNames = [];
        const term = state.geosite.treeSearch.trim().toLowerCase();
        const filteredSet = new Set();
        if (term) {
          state.geosite.names.forEach(function (name) {
            if (name.toLowerCase().includes(term)) {
              filteredSet.add(name);
            }
          });
        } else {
          state.geosite.names.forEach(function (name) {
            filteredSet.add(name);
          });
        }
        state.geosite.filteredNames = Array.from(filteredSet);

        const renderNode = function (node, depth) {
          const children = sortChildren(node);
          const childElements = [];
          for (const child of children) {
            const childEl = renderNode(child, depth + 1);
            if (childEl) {
              childElements.push(childEl);
            }
          }

          const matchesLeaf = node.fullName ? filteredSet.has(node.fullName) : false;
          const shouldShow = matchesLeaf || childElements.length > 0;
          if (!shouldShow) {
            return null;
          }

          const hasChildren = childElements.length > 0;
          let expanded = false;
          if (hasChildren) {
            if (term) {
              expanded = true;
            } else if (Object.prototype.hasOwnProperty.call(state.geosite.expanded, node.path)) {
              expanded = !!state.geosite.expanded[node.path];
            } else {
              expanded = depth < 1;
            }
          }

          const nodeEl = document.createElement("div");
          nodeEl.className = "tree-node depth-" + depth + (matchesLeaf ? " highlight" : "");
          const header = document.createElement("div");
          header.className = "tree-header";
          nodeEl.appendChild(header);

          if (hasChildren) {
            const toggleBtn = document.createElement("button");
            toggleBtn.type = "button";
            toggleBtn.className = "tree-toggle";
            toggleBtn.textContent = expanded ? "−" : "+";
            if (term) {
              toggleBtn.disabled = true;
            } else {
              toggleBtn.addEventListener("click", function (event) {
                event.stopPropagation();
                state.geosite.expanded[node.path] = !expanded;
                renderGeositeTree();
              });
            }
            header.appendChild(toggleBtn);
          } else {
            const spacer = document.createElement("span");
            spacer.className = "tree-toggle spacer";
            header.appendChild(spacer);
          }

          const label = document.createElement("span");
          label.className = "tree-label" + (matchesLeaf && term ? " match" : "");
          label.textContent = node.label || node.fullName || "(未命名)";
          header.appendChild(label);

          if (node.fullName) {
            const selectBtn = document.createElement("button");
            selectBtn.type = "button";
            selectBtn.className = "tree-select" + (state.geosite.currentName === node.fullName ? " active" : "");
            selectBtn.textContent = node.fullName;
            selectBtn.addEventListener("click", function (event) {
              event.stopPropagation();
              state.geosite.currentName = node.fullName;
              renderGeositeTree();
              loadGeositeDetail(node.fullName);
            });
            header.appendChild(selectBtn);
            if (filteredSet.has(node.fullName) && state.geosite.visibleNames.indexOf(node.fullName) === -1) {
              state.geosite.visibleNames.push(node.fullName);
            }
          }

          if (hasChildren && expanded) {
            const childrenWrap = document.createElement("div");
            childrenWrap.className = "tree-children";
            childElements.forEach(function (childEl) {
              childrenWrap.appendChild(childEl);
            });
            nodeEl.appendChild(childrenWrap);
          }

          return nodeEl;
        };

        const topLevel = sortChildren(state.geosite.treeRoot);
        let appended = false;
        for (const child of topLevel) {
          const el = renderNode(child, 0);
          if (el) {
            container.appendChild(el);
            appended = true;
          }
        }
        if (!appended) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.textContent = state.geosite.names.length ? "没有匹配的规则组" : "暂未加载数据";
          container.appendChild(empty);
        }
      };

      const renderGeoipNameList = function () {
        const container = dom.geoip.nameList;
        container.innerHTML = "";
        const names = state.geoip.filteredNames;
        if (!names.length) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.textContent = state.geoip.names.length ? "没有匹配的规则组" : "暂未加载数据";
          container.appendChild(empty);
          return;
        }
        let currentGroup = "";
        names.forEach(function (name) {
          const group = /^[A-Za-z]/.test(name) ? name[0].toUpperCase() : "#";
          if (group !== currentGroup) {
            currentGroup = group;
            const header = document.createElement("div");
            header.className = "list-group";
            header.textContent = group;
            container.appendChild(header);
          }
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "name-item" + (state.geoip.currentName === name ? " active" : "");
          btn.textContent = name;
          btn.addEventListener("click", function () {
            state.geoip.currentName = name;
            renderGeoipNameList();
            loadGeoipDetail(name);
          });
          container.appendChild(btn);
        });
      };

      const loadGeositeDetail = function (name) {
        const attribute = (state.geosite.attribute || "").trim();
        const cacheKey = name + "::" + attribute;
        const cache = state.geosite.detailCache;
        dom.geosite.status.textContent = "正在加载规则...";
        dom.geosite.ruleList.innerHTML = "";
        if (cache.has(cacheKey)) {
          renderGeositeDetail(cache.get(cacheKey));
          return;
        }
        let url = "/api/geosite/" + encodeURIComponent(name);
        if (attribute) {
          url += "?filter=" + encodeURIComponent(attribute);
        }
        fetchJson(url)
          .then(function (data) {
            cache.set(cacheKey, data);
            renderGeositeDetail(data);
          })
          .catch(function (error) {
            dom.geosite.status.textContent = error.message;
            dom.geosite.ruleList.innerHTML = "";
          });
      };

      const loadGeoipDetail = function (name) {
        const version = state.geoip.version || "both";
        const cacheKey = name + "::" + version;
        const cache = state.geoip.detailCache;
        dom.geoip.status.textContent = "正在加载 CIDR...";
        dom.geoip.cidrList.innerHTML = "";
        if (cache.has(cacheKey)) {
          renderGeoipDetail(cache.get(cacheKey));
          return;
        }
        let url = "/api/geoip/" + encodeURIComponent(name);
        if (version && version !== "both") {
          url += "?filter=" + encodeURIComponent(version);
        }
        fetchJson(url)
          .then(function (data) {
            cache.set(cacheKey, data);
            renderGeoipDetail(data);
          })
          .catch(function (error) {
            dom.geoip.status.textContent = error.message;
            dom.geoip.cidrList.innerHTML = "";
          });
      };

      const setActiveDataset = function (datasetKey) {
        state.active = datasetKey;
        dom.datasetButtons.forEach(function (btn) {
          const active = btn.getAttribute("data-dataset") === datasetKey;
          btn.classList.toggle("active", active);
        });
        Object.keys(dom.panels).forEach(function (key) {
          dom.panels[key].classList.toggle("active", key === datasetKey);
        });
      };

      const ensureIndexLoaded = function (datasetKey) {
        const dataset = state[datasetKey];
        if (dataset.names.length) {
          return Promise.resolve();
        }
        const url = datasetKey === "geosite" ? "/geosite" : "/geoip";
        return fetchJson(url).then(function (index) {
          const names = Object.keys(index).sort(function (a, b) {
            return a.localeCompare(b, "en", { sensitivity: "base" });
          });
          dataset.index = index;
          dataset.names = names;
          if (datasetKey === "geosite") {
            const tree = buildGeositeTree(names);
            state.geosite.treeRoot = tree.root;
            state.geosite.branchPaths = tree.branchPaths;
            state.geosite.expanded = {};
            state.geosite.treeSearch = "";
            dom.geosite.treeSearch.value = "";
            dom.geosite.attrFilter.value = state.geosite.attribute;
            renderGeositeTree();
          } else {
            state.geoip.filteredNames = names.slice();
            renderGeoipNameList();
          }
        });
      };

      const handleDatasetSwitch = function (datasetKey) {
        setActiveDataset(datasetKey);
        ensureIndexLoaded(datasetKey).catch(function (error) {
          console.error(error);
        });
      };

      const runGeositeReverse = function () {
        const query = dom.geosite.reverseInput.value.trim();
        if (!query) {
          dom.geosite.reverseStatus.textContent = "请输入需要匹配的域名或关键字";
          dom.geosite.reverseResults.innerHTML = "";
          return;
        }
        dom.geosite.reverseStatus.textContent = "匹配中...";
        dom.geosite.reverseResults.innerHTML = "";
        const payload = {
          query: query,
          limit: Number(dom.geosite.reverseLimit.value) || 50,
        };
        const attr = dom.geosite.reverseAttr.value.trim();
        if (attr) {
          payload.attributes = attr;
        }
        if (dom.geosite.reverseScope.checked && state.geosite.filteredNames.length) {
          payload.names = state.geosite.filteredNames.slice(0, 600);
        }
        fetchJson("/api/search/geosite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(function (data) {
            dom.geosite.reverseStatus.textContent =
              "共找到 " + data.matches.length + " 条结果 · 检索列表 " + data.scope.scanned;
            renderGeositeReverseResults(data.matches);
          })
          .catch(function (error) {
            dom.geosite.reverseStatus.textContent = error.message;
          });
      };

      const renderGeositeReverseResults = function (matches) {
        const listEl = dom.geosite.reverseResults;
        listEl.innerHTML = "";
        if (!matches || !matches.length) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.textContent = "没有匹配的规则组";
          listEl.appendChild(empty);
          return;
        }
        const frag = document.createDocumentFragment();
        matches.forEach(function (match) {
          const row = document.createElement("div");
          row.className = "match-row";
          const header = document.createElement("div");
          header.className = "match-header";
          const title = document.createElement("button");
          title.type = "button";
          title.className = "name-item";
          title.textContent = match.list;
          title.addEventListener("click", function () {
            state.geosite.currentName = match.list;
            renderGeositeTree();
            loadGeositeDetail(match.list);
            window.scrollTo({ top: dom.geosite.tree.offsetTop - 80, behavior: "smooth" });
          });
          header.appendChild(title);
          const reason = document.createElement("span");
          reason.className = "match-reason";
          reason.textContent = "原因：" + match.reason;
          header.appendChild(reason);
          row.appendChild(header);
          const value = document.createElement("div");
          value.className = "rule-value";
          value.textContent = match.rule.value;
          row.appendChild(value);
          if (match.rule.attrs && match.rule.attrs.length) {
            const attrs = document.createElement("div");
            attrs.className = "rule-attrs";
            attrs.textContent = "标签：" + match.rule.attrs.join(", ");
            row.appendChild(attrs);
          }
          frag.appendChild(row);
        });
        listEl.appendChild(frag);
      };

      const runGeoipReverse = function () {
        const query = dom.geoip.reverseInput.value.trim();
        if (!query) {
          dom.geoip.reverseStatus.textContent = "请输入需要匹配的 IP 或片段";
          dom.geoip.reverseResults.innerHTML = "";
          return;
        }
        dom.geoip.reverseStatus.textContent = "匹配中...";
        dom.geoip.reverseResults.innerHTML = "";
        const payload = {
          query: query,
          limit: Number(dom.geoip.reverseLimit.value) || 50,
          version: dom.geoip.reverseVersion.value,
        };
        if (dom.geoip.reverseScope.checked && state.geoip.filteredNames.length) {
          payload.names = state.geoip.filteredNames.slice(0, 600);
        }
        fetchJson("/api/search/geoip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(function (data) {
            dom.geoip.reverseStatus.textContent =
              "共找到 " + data.matches.length + " 条结果 · 检索列表 " + data.scope.scanned;
            renderGeoipReverseResults(data.matches);
          })
          .catch(function (error) {
            dom.geoip.reverseStatus.textContent = error.message;
          });
      };

      const renderGeoipReverseResults = function (matches) {
        const listEl = dom.geoip.reverseResults;
        listEl.innerHTML = "";
        if (!matches || !matches.length) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.textContent = "没有匹配的规则组";
          listEl.appendChild(empty);
          return;
        }
        const frag = document.createDocumentFragment();
        matches.forEach(function (match) {
          const row = document.createElement("div");
          row.className = "match-row";
          const header = document.createElement("div");
          header.className = "match-header";
          const title = document.createElement("button");
          title.type = "button";
          title.className = "name-item";
          title.textContent = match.list;
          title.addEventListener("click", function () {
            state.geoip.currentName = match.list;
            renderGeoipNameList();
            loadGeoipDetail(match.list);
            window.scrollTo({ top: dom.geoip.nameList.offsetTop - 80, behavior: "smooth" });
          });
          header.appendChild(title);
          const reason = document.createElement("span");
          reason.className = "match-reason";
          reason.textContent = match.version + " · 前缀 /" + match.prefix;
          header.appendChild(reason);
          row.appendChild(header);
          const value = document.createElement("div");
          value.className = "rule-value";
          value.textContent = match.cidr;
          row.appendChild(value);
          frag.appendChild(row);
        });
        listEl.appendChild(frag);
      };

      dom.datasetButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          const datasetKey = btn.getAttribute("data-dataset");
          handleDatasetSwitch(datasetKey);
        });
      });

      dom.geosite.treeSearch.addEventListener(
        "input",
        debounce(function () {
          state.geosite.treeSearch = dom.geosite.treeSearch.value;
          renderGeositeTree();
        }, 200)
      );

      dom.geosite.expandAll.addEventListener("click", function () {
        state.geosite.branchPaths.forEach(function (path) {
          state.geosite.expanded[path] = true;
        });
        renderGeositeTree();
      });

      dom.geosite.collapseAll.addEventListener("click", function () {
        state.geosite.branchPaths.forEach(function (path) {
          state.geosite.expanded[path] = false;
        });
        renderGeositeTree();
      });

      dom.geosite.ruleFilter.addEventListener(
        "input",
        debounce(function () {
          state.geosite.ruleFilter = dom.geosite.ruleFilter.value;
          applyGeositeRuleFilter();
        }, 200)
      );

      dom.geosite.attrFilter.addEventListener(
        "change",
        function () {
          state.geosite.attribute = dom.geosite.attrFilter.value.trim();
          if (state.geosite.currentName) {
            loadGeositeDetail(state.geosite.currentName);
          }
        }
      );

      dom.geosite.copyButton.addEventListener("click", function () {
        const url = dom.geosite.copyButton.dataset.url;
        if (!url) return;
        navigator.clipboard
          .writeText(new URL(url, window.location.origin).href)
          .then(function () {
            dom.geosite.copyButton.textContent = "已复制";
            setTimeout(function () {
              dom.geosite.copyButton.textContent = "复制下载链接";
            }, 1500);
          })
          .catch(function () {
            dom.geosite.copyButton.textContent = "复制失败";
            setTimeout(function () {
              dom.geosite.copyButton.textContent = "复制下载链接";
            }, 2000);
          });
      });

      dom.geosite.reverseButton.addEventListener("click", runGeositeReverse);
      dom.geosite.reverseInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
          runGeositeReverse();
        }
      });

      dom.geoip.searchInput.addEventListener(
        "input",
        debounce(function () {
          state.geoip.filterText = dom.geoip.searchInput.value;
          const term = state.geoip.filterText.trim().toLowerCase();
          let filtered = state.geoip.names;
          if (term) {
            filtered = filtered.filter(function (name) {
              return name.toLowerCase().includes(term);
            });
          }
          state.geoip.filteredNames = filtered;
          renderGeoipNameList();
        }, 200)
      );

      dom.geoip.versionSelect.addEventListener("change", function () {
        state.geoip.version = dom.geoip.versionSelect.value;
        if (state.geoip.currentName) {
          loadGeoipDetail(state.geoip.currentName);
        }
      });

      dom.geoip.cidrFilter.addEventListener(
        "input",
        debounce(function () {
          state.geoip.cidrFilter = dom.geoip.cidrFilter.value;
          applyGeoipCidrFilter();
        }, 200)
      );

      dom.geoip.copyButton.addEventListener("click", function () {
        const url = dom.geoip.copyButton.dataset.url;
        if (!url) return;
        navigator.clipboard
          .writeText(new URL(url, window.location.origin).href)
          .then(function () {
            dom.geoip.copyButton.textContent = "已复制";
            setTimeout(function () {
              dom.geoip.copyButton.textContent = "复制下载链接";
            }, 1500);
          })
          .catch(function () {
            dom.geoip.copyButton.textContent = "复制失败";
            setTimeout(function () {
              dom.geoip.copyButton.textContent = "复制下载链接";
            }, 2000);
          });
      });

      dom.geoip.reverseButton.addEventListener("click", runGeoipReverse);
      dom.geoip.reverseInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter") {
          runGeoipReverse();
        }
      });

      ensureIndexLoaded("geosite").catch(function (error) {
        console.error(error);
      });
    })();
  </script>
</body>
</html>`;
