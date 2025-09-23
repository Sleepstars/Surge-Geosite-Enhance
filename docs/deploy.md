# 部署指南（Cloudflare Workers + Pages + CI）

本文档介绍项目在 Cloudflare 平台上的部署方式，并给出基于 GitHub Actions 的 CI/CD 示例。同时说明如何自定义前端使用的 geosite/geoip 源地址。

目录：

- Cloudflare Workers（后端 API）部署
- Cloudflare Pages（前端）部署
- GitHub Actions 持续集成（CI）示例
- 自定义 geosite/geoip 源地址

---

## 一、Cloudflare Workers（后端 API）

本项目的 Worker 位于 `worker/` 目录，默认监听以下路由（简述）：

- `GET /geosite`、`GET /geoip`：返回 JSON 索引
- `GET /geosite/:name[@filter]`、`GET /geoip/:name[@v4|@v6]`：返回 Surge 规则集
- `GET /api/geosite/:name`、`GET /api/geoip/:name`：返回 JSON 明细
- `POST /api/search/geosite`、`POST /api/search/geosite/fast`、`POST /api/search/geoip`：搜索接口

### 1) 本地开发

```bash
npm install
npm run dev    # 本地开发（Wrangler），默认 http://localhost:8787
```

### 2) 正式部署（手动）

1. 确保 `wrangler` 已安装并登录：`npm i -g wrangler && wrangler login`
2. 根据需要在根目录 `wrangler.toml` 配置 KV / R2 / D1 绑定与变量
3. 通过 Secrets 设置敏感信息：`wrangler secret put NAME`
4. 发布：

```bash
npm run deploy
```

Wrangler 会自动构建并发布到 Cloudflare Workers。

### 3) 正式部署（CI）

使用 GitHub Actions 自动部署到 Workers 的示例（`.github/workflows/worker.yml`）：

```yaml
name: Deploy Worker

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install deps
        run: npm ci

      - name: Publish via Wrangler
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: npx wrangler deploy
```

> 提示：本仓库已有自动同步数据的工作流（见 `.github/workflows/auto-update.yaml`）。如需合并或扩展流程，请在同一工作流中新增 Job，或单独创建 `worker.yml`。

---

## 二、Cloudflare Pages（前端）

前端位于 `frontend/` 目录，基于 React + Vite 构建，构建产物输出到 `frontend/dist`。

### 1) 连接仓库

- Cloudflare Dashboard → Pages → Create a project → Connect to Git
- 选择本仓库

### 2) 构建配置

- Root directory：`frontend`
- Build command：`npm run build`
- Build output directory：`dist`

### 3) API 源地址配置（两选一）

方式 A：使用环境变量 `VITE_API_BASE`

- 在 Pages 项目 → Settings → Environment Variables 设置：
  - `VITE_API_BASE=https://your-worker-domain.workers.dev`
- 前端将直接向该域名发起请求（如 `/geosite`、`/api/...`）。

方式 B：使用 `_redirects` 转发

- 编辑 `frontend/_redirects`，替换示例域名：

```
/api/*     https://your-worker-domain/api/:splat      200
/geosite/* https://your-worker-domain/geosite/:splat  200
/geoip/*   https://your-worker-domain/geoip/:splat    200
```

- 不设置 `VITE_API_BASE` 时，前端将相对当前站点发起请求，由 Pages 按上述规则转发到你的 Worker/API。

> 推荐优先使用 `_redirects`，通常无需 CORS 配置；使用 `VITE_API_BASE` 时需保证后端允许跨域来源。

### 4) 自定义域名（可选）

- 在 Pages → Custom domains 绑定你的域名。

---

## 三、GitHub Actions（CI）部署 Pages 示例

在每次推送到 `main` 时自动构建并发布前端到 Pages（`.github/workflows/pages.yml`）：

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install deps
        run: npm ci

      - name: Build
        env:
          VITE_API_BASE: ${{ secrets.VITE_API_BASE }}
        run: npm run build

  - name: Publish to Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ${{ secrets.CLOUDFLARE_PAGES_PROJECT }}
  directory: frontend/dist
  gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

需要在仓库 Secrets 中配置：

- `CLOUDFLARE_API_TOKEN`（Pages Write 权限）
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT`（Pages 项目名）
- （可选）`VITE_API_BASE`

### 可选功能（按需启用）

以下 CI 能力不是强制的，可按需选择：

- 前端 Pages 部署（可选）
  - 若不需要托管前端，直接删除或禁用整个 Pages 工作流/Job 即可；也可改为仅 `workflow_dispatch` 手动触发。

- Worker 自动部署（可选）
  - 若你偏好手动 `wrangler deploy`，可以不创建 `worker.yml`；或在合并发布时再触发。

- 自动更新产物工作流 auto-update.yaml（按需选择步骤）
  - 构建 geosite/geoip JSON（可拆分）：
    - 仅需 geosite 时，保留“Build geosite JSON”并移除/禁用 GeoIP 相关步骤；反之亦然。
  - 构建 SRS（可选）：
    - 如不需要 SRS 产物，移除步骤“Install sing-box CLI”“Build SRS rulesets”“Build SRS GeoIP rulesets”。
    - 或在步骤上添加条件：`if: ${{ vars.BUILD_SRS == 'true' }}`，并在仓库 Variables 设置 `BUILD_SRS=true/false`。
  - R2 同步（可选）：
    - 若不使用 R2 分发，删除“Install AWS CLI v2”“Manifest incremental sync to R2”。
    - 当前脚本已在未配置 `R2_BUCKET`/凭据时自动跳过上传，但为了减少耗时，建议直接禁用相关步骤：
      - 例如为步骤加条件：`if: ${{ secrets.R2_ACCESS_KEY_ID && secrets.R2_SECRET_ACCESS_KEY && vars.SRS_BUCKET_NAME }}`。
  - D1 同步（可选）：
    - 仅当使用 D1 作为搜索/索引加速时启用；未设置 `D1_DATABASE_NAME/ID` 时，脚本会跳过。
  - Workers KV 写入（可选）：
    - 仅当希望把 `index.json/geoip-index.json` 放到 KV 时启用；未配置 `GEO_KV_NAMESPACE_ID`（或别名）将跳过。
  - 自动提交推送（可选）：
    - 若不希望工作流修改并推送 README/清单，移除“Commit and push if necessary”；或加条件：
      - `if: ${{ vars.ENABLE_COMMIT == 'true' }}` 并在仓库 Variables 设置开关。
  - 定时触发（可选）：
    - 需要每日/每周同步时保留 `schedule`；纯手动更新可删除 `schedule`，仅保留 `workflow_dispatch`。

小贴士：上面提到的 `vars.*` 变量可以在 GitHub 仓库 Settings → Variables 中按需新增作为开关，然后在工作流步骤 `if:` 条件中引用。

---

## 四、自定义 geosite/geoip 源地址

前端的 API 路径选择策略：

- 开发环境：固定代理到 `http://localhost:8787`（见 `vite.config.ts` 与 `src/hooks/useApi.ts`）。
- 生产环境：
  - 若设置了 `VITE_API_BASE`，使用该值作为前缀（例如 `https://api.example.com`）；
  - 否则使用相对路径，由 Cloudflare Pages 的 `_redirects` 转发到后端。

推荐做法：

- 本地：复制根目录 `.env.example` 为 `frontend/.env.local`，修改 `VITE_API_BASE` 进行联调。
- 生产：优先用 `_redirects` 指向你的 Worker/API；或在 Pages 环境变量中设置 `VITE_API_BASE`。

接口约定摘要：

- `GET /geosite`、`GET /geoip`：索引
- `GET /api/geosite/:name`、`GET /api/geoip/:name`：明细（支持参数）
- `POST /api/search/geosite`、`/api/search/geosite/fast`、`/api/search/geoip`：搜索

> 若直接跨域访问你的 API，请在后端正确设置 CORS 允许来源；使用 `_redirects` 则无需 CORS。

---

## 五、故障排查（FAQ）

- 列表为空或加载失败：
  - 检查 `VITE_API_BASE` 是否正确，或 `_redirects` 是否指向有效域名；
  - 打开浏览器开发者工具查看网络请求错误。

- CORS 报错：
  - 使用 `VITE_API_BASE` 时需在 Worker/API 侧允许来源；
  - 使用 `_redirects` 通常不会出现 CORS 问题。
