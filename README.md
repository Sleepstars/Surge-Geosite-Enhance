# Surge Geosite Enhance

一个基于 Cloudflare Workers 的服务，按需将 Loyalsoldier 提供的 geosite/geoip 数据集转换为适配 Surge 的纯文本规则集，同时提供 JSON 索引与 SRS 打包文件。项目包含前端浏览器（Cloudflare Pages）用于快速检索、预览与搜索。

👉 部署说明（包含 CI 与 Cloudflare 配置）：[docs/deploy.md](docs/deploy.md)

## 功能与优势

- 动态生成 Surge 规则集（基于 geosite.dat / geoip.dat）
- 提供 JSON 索引与 `.srs` 打包文件，方便 Surge 导入
- 结合 R2、Workers KV 等缓存，降低冷启动与带宽开销
- 附带自动化脚本与工作流，保持数据持续更新
- 前端支持规则浏览、筛选与搜索

## 如何使用（托管服务）

以下示例以公开部署 `https://direct.sleepstars.de` 为例（你也可以部署自己的域名）：

### GeoSite 规则集

- 接口：`GET https://direct.sleepstars.de/geosite/<name>[@filter]`
- 过滤：`@cn`、`@!cn` 或上游数据中的区域标签
- 示例：`https://direct.sleepstars.de/geosite/apple@cn`
- SRS：`https://direct.sleepstars.de/srs-geosite/<name>.srs`

### GeoIP 规则集

- 接口：`GET https://direct.sleepstars.de/geoip/<name>[@v4|@v6]`
- 示例：`https://direct.sleepstars.de/geoip/cn@v4`
- SRS：`https://direct.sleepstars.de/srs-geoip/<name>.srs`

### 索引接口

- Geosite JSON：`https://direct.sleepstars.de/geosite`
- GeoIP JSON：`https://direct.sleepstars.de/geoip`

## 预构建清单

生成产物的清单以 Markdown 形式保存在仓库中，便于浏览：

- Geosite 列表：data_files.md
- GeoIP 列表：geoip_files.md

这些文件由自动化流程生成，并保持与 Worker 暴露的路径结构一致。

## 本地开发

1) 安装依赖与工具

- Node.js 20.18+（推荐 22 LTS）、npm、Wrangler 4.x

2) 启动本地服务

```bash
npm install
npm run dev   # http://localhost:8787
```

3) 验证接口

- 访问 `GET /geosite/apple@cn` 等 URL 验证规则渲染

前端开发（可选，`frontend/` 目录）：

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

## 部署（摘要）

- Worker：`npm run deploy`（发布到 Cloudflare Workers；请先在 `wrangler.toml` 配置绑定并通过 `wrangler secret put` 设置密钥）
- Pages（前端）：见 [docs/deploy.md](docs/deploy.md) 中 Pages 小节；可通过环境变量或 `_redirects` 指向你的 Worker API
- GitHub Actions：见 [docs/deploy.md](docs/deploy.md) 提供的 Worker/Pages CI 示例

## 数据再生成与工具

- 重新生成 geosite 产物：`npm run build:geosite`
- 重新生成 geoip 产物：`npm run build:geoip`
- 生成 SRS：`npm run build:srs`、`npm run build:srs-geoip`
- 更新 D1 种子 SQL：`npm run build:d1`

R2 同步或 KV 上传可使用：`npm run r2:sync`、`npm run kv:put:index`、`npm run kv:put:geoip-index`。