# Surge Geosite Enhance：即取即用的细粒度规则服务

本文聚焦于“如何使用” Surge Geosite Enhance：面向已经熟悉 Surge、Clash、sing-box 或 Stash 的用户，帮助您快速在现有配置中接入这套托管的 geosite/geoip 服务。

## 快速上手

1. **确认需要的规则类型**
   - 域名集：访问 `https://direct.sleepstars.de/geosite/<规则集名称>`，或附加属性过滤 `@cn`、`@!cn` 等。
   - IP 集：访问 `https://direct.sleepstars.de/geoip/<规则集名称>`，可加 `@v4`、`@v6` 指定 IP 版本。
2. **在客户端添加远程规则**
   - Surge 例子：
     ```ini
     [Rule]
     RULE-SET,https://direct.sleepstars.de/geosite/apple@cn,Apple-CN
     GEOIP,https://direct.sleepstars.de/geoip/cn@v4,DIRECT
     ```
   - sing-box 例子：
     ```json
     {
       "type": "remote",
       "tag": "geosite-apple",
       "url": "https://direct.sleepstars.de/geosite/apple@cn"
     }
     ```
3. **验证是否生效**
   - Surge 可在「日志」中确认远程规则加载情况。
   - sing-box 可使用 `sing-box check` / 控制台日志查看拉取状态。
   - 如果首次访问返回 404，意味着后端正在同步最新数据，数秒后重试即可。

## 常见使用场景

### 在 Surge 中添加远程规则集

1. 打开 Surge `Profiles` 中的配置文件。
2. 在 `[Rule]` 模块新增远程规则：
   ```ini
   [Rule]
   RULE-SET,https://direct.sleepstars.de/geosite/streaming,Streaming
   RULE-SET,https://direct.sleepstars.de/geosite/netflix@!cn,Netflix-Global
   GEOIP,https://direct.sleepstars.de/geoip/cn@v4,DIRECT
   ```
3. 需要本地缓存文件时，可在 `[Rule Set]` 区块指定更新间隔：
   ```ini
   [Rule Set]
   Streaming,policy=Proxy,format=surge3
   ```
4. 保存配置并刷新规则，确认 Surge 已下载最新列表。

### 在 sing-box 中使用 geosite / geoip

1. 在 `rule_set` 中定义远程数据源：
   ```json
   {
     "type": "remote",
     "tag": "geosite-streaming",
     "url": "https://direct.sleepstars.de/geosite/streaming"
   }
   ```
2. 在 `route` 配置中引用：
   ```json
   {
     "rule_set": "geosite-streaming",
     "outbound": "proxy"
   }
   ```
3. 对 IP 规则使用 `https://direct.sleepstars.de/geoip/<名称>`；需要特定版本时附加 `@v4` 或 `@v6`。
4. 通过 `sing-box check` 或日志确认规则已同步，必要时设置定时刷新。

### 使用 Web 前端定位域名或 IP

1. 打开托管前端 [https://geo.sleepstars.de](https://geo.sleepstars.de)。
2. 左侧树状目录可按类别浏览所有 geosite 集合，右侧即时展示具体规则条目。
3. 搜索框支持两种模式：
   - 快速搜索：用于域名后缀匹配（如输入 `apple.com`）。
   - 全面搜索：用于模糊匹配或 IP 查询。
4. 顶部属性筛选器可即时过滤（例如 `cn`、`!cn`），便于构建分区域策略。
5. 需要为 Stash 准备规则包时，可下载 `.srs`：`https://direct.sleepstars.de/srs-geosite/<名称>.srs`。

## 进阶：了解服务如何运作

Surge Geosite Enhance 采用“预构建数据 + 无状态边缘接口”的方式，保证托管链接稳定、更新及时：

1. **数据预构建（GitHub Actions）**：每日拉取 Loyalsoldier 上游 `.dat`，完成转换与索引生成。
2. **分层存储（Cloudflare R2/KV/D1）**：规则文件、索引和数据库种子分别存放，降低延迟。
3. **边缘服务（Cloudflare Worker）**：按照内存缓存 → KV → R2/D1 的优先级返回数据。

## 自行部署

1. 克隆仓库并安装依赖：`npm install`（需 Node.js ≥ 20.18、Wrangler 4.x）。
2. 使用 `npm run dev` 在本地验证 Worker 行为。
3. 配置 `wrangler.toml` 中的 R2、KV、D1 绑定及密钥，执行 `npm run deploy` 推送至 Cloudflare。

## 后续计划

后续会根据使用反馈，逐步补充更细的筛选条件、适配更多客户端格式，并考虑引入额外数据源。欢迎通过 Issue 交流实际使用场景，帮助我们继续优化托管体验。
