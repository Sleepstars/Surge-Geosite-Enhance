# Surge Geosite Enhance 使用指南

本文聚焦“如何使用”本项目提供的托管 geosite/geoip 服务，帮助已熟悉 Surge、sing-box、Stash 等工具的用户，将规则集快捷接入到现有配置中。

[配图占位] 项目总览/首页

## 能力一览

- GeoSite 域名规则：按需输出 Surge 纯文本规则或打包 SRS 文件
- GeoIP IP/CIDR 规则：支持仅 IPv4（@v4）或仅 IPv6（@v6）
- 前端浏览/搜索：按分类浏览、关键词搜索、属性过滤（如 cn、!cn）
- 程序化接口：列表索引、规则明细、快速/全面搜索

提示：生成的纯文本规则中会跳过正则（regexp）类规则，避免过宽的匹配。

[配图占位] 数据流转与规则形态示意

## 格式兼容性说明

- Surge：仅支持纯文本规则（本项目的 `/geosite/*`、`/geoip/*` 文本接口）。
- sing-box：仅支持 SRS 规则（本项目的 `/srs-geosite/*`、`/srs-geoip/*` 二进制接口）。

## 为什么不是直接用 .dat

- 二进制容器：上游 geosite.dat/geoip.dat 为二进制，人工不可读，难以直观浏览、检索与核验分类内容。
- 生态兼容性：Surge、sing-box 等无法直接读取上游 .dat，需要转换为可消费的纯文本、SRS 或自有格式。
- 可见性不足：难以按类别、属性做快速查找、对比与筛选，不利于日常维护与策略审计。

## 它们的核心优势

- 细粒度分类：按产品/地域/用途等多维组织，域名规则区分 domain/full/regexp，IP 支持 v4/v6 分离，组合灵活。
- 覆盖广、更新快：社区沉淀的数据集，维护活跃，分类体系不断完善。
- 策略更精准：可按需选择极小粒度的集合，尽量减少误匹配，让路由/分流更贴合自己的使用场景。

## 本项目的落地方案

- 标准化输出：将 geosite/geoip 转换为 Surge 纯文本规则与 SRS 打包，同时提供 JSON 明细与索引。
- 便捷接入：直接通过 `GET /geosite/<name>[@filter]`、`GET /geoip/<name>[@v4|@v6]`、`/srs-geosite/*`、`/srs-geoip/*` 等接口使用。
- 过滤能力：支持属性过滤（如 `@cn`/`@!cn`），GeoIP 支持 `@v4`/`@v6`；在 JSON/API 里还可组合多属性筛选。
- 可视化与检索：前端提供树状浏览、快速/全面搜索与按属性过滤，方便审阅与调试。

## 数据源选择：Loyalsoldier vs 原版 geosite

为保证覆盖度、颗粒度与更新频率，本项目默认使用 `Loyalsoldier/v2ray-rules-dat` 作为 geosite/geoip 的上游；其与原版 geosite（`v2fly/domain-list-community`）的差异概览如下：

- 原版 geosite（v2fly/domain-list-community）
  - 目标中立，仅维护域名分类与属性标注，发布 `dlc.dat`；不包含额外的广告/系统类扩展清单。
  - 更新频率取决于社区 PR；分类体系通用，但对中文场景的覆盖相对保守。

- 分支版（Loyalsoldier/v2ray-rules-dat）
  - geosite：在原版数据基础上融合多源，增加更细的类别与中国大陆相关域名覆盖，例如：
    - 加入 felixonmars 加速域名（`china-list`/`cn`）、Apple/Google 中国域名（`apple-cn`/`google-cn`）
    - 合并 GFWList 到 `geosite:gfw` 与 `geolocation-!cn`
    - 扩展广告/跟踪集合：EasyList/EasyListChina、AdGuard DNS Filter、Peter Lowe → `category-ads-all`
    - WindowsSpyBlocker 系列（慎用）：`win-spy`、`win-update`、`win-extra`
  - geoip：基于 GeoLite2，CN 段融合 IPIP 与 gaoyifan；并提供常见云/平台段如 `cloudflare`、`google`、`fastly`、`netflix`、`telegram` 等。
  - 每日自动构建，发布稳定产物，便于自动化拉取与同步。

选择该分支的原因

- 细粒度更强：在原版分类之上进一步细分，能更精准地拼装自己的分流策略。
- 覆盖面更贴合国内使用：`@cn`、`apple-cn`、`google-cn` 等对“直连/代理”决策很实用。
- 维护活跃、更新可预期：日更构建降低陈旧风险，便于快速修补。
- 仍可控可退：对于“慎用”集合（如广告/系统类域名）可通过属性与名称选择性启用，避免误伤；如需“完全中立”的原版语义，也可在部署/构建时切换回原版数据源。

## 快速上手

1) 选择需要的数据集

- 在前端页面浏览名称： https://geo.sleepstars.de
- 或按名称直接请求：
  - GeoSite：`GET https://direct.sleepstars.de/geosite/<name>[@filter]`
  - GeoIP：  `GET https://direct.sleepstars.de/geoip/<name>[@v4|@v6]`

2) 立即获取规则（示例）

```bash
# GeoSite（附加属性过滤：@cn 或 @!cn）
curl -s https://direct.sleepstars.de/geosite/apple@cn | head

# GeoIP（仅 IPv4）
curl -s https://direct.sleepstars.de/geoip/cn@v4 | head
```

3) 接入到客户端

### Surge 示例

```ini
[Rule]
RULE-SET,https://direct.sleepstars.de/geosite/streaming,Streaming
RULE-SET,https://direct.sleepstars.de/geosite/netflix@!cn,Netflix-Global
GEOIP,https://direct.sleepstars.de/geoip/cn@v4,DIRECT

[Rule Set]
# 如需本地缓存与定时更新，可在此配置
Streaming,policy=Proxy,format=surge3
```

如需 sing-box/Stash（SRS 规则）：

- GeoSite SRS：`https://direct.sleepstars.de/srs-geosite/<name>.srs`
- GeoIP SRS：  `https://direct.sleepstars.de/srs-geoip/<name>.srs`

[配图占位] Surge 规则接入与生效截图

### sing-box 示例

sing-box 仅支持加载 SRS 规则，请将 URL 指向 `.srs`：

```
# 规则集 URL 示例（根据实际配置方式填写到 rule_set 中）
https://direct.sleepstars.de/srs-geosite/streaming.srs
https://direct.sleepstars.de/srs-geosite/netflix@!cn.srs
https://direct.sleepstars.de/srs-geoip/cn@v4.srs
```

提示：使用日志或 `sing-box check` 验证远程规则拉取状态；确保引用的是 `.srs` 链接而非纯文本。

[配图占位] sing-box 远程规则配置与日志截图

### Web 前端用法

1. 打开 https://geo.sleepstars.de
2. 左侧树按类别浏览规则组；右侧实时显示条目
3. 搜索支持：
   - 快速搜索（域名后缀/主机名匹配）
   - 全面搜索（更宽松的关键词与正则等）
4. 顶部可用属性过滤（如 `cn`、`!cn`）来缩小结果
5. 直接复制规则链接或获取对应 SRS 下载链接

[配图占位] 前端界面总览与搜索/过滤截图

## 常见问题（FAQ）

- 返回 404？请先核对名称是否存在；若刚同步完数据，稍后重试即可。
- 名称大小写？接口会尝试大小写变体（如 `APPLE`/`apple`）。
- 属性过滤？
  - 纯文本 `/geosite/<name>@<attr>` 仅支持单一属性（如 `@cn` 或 `@!cn`）。
  - `/api` 系列支持多属性（如 `filter=cn,!cn`）。
- 为什么有些规则缺失？为避免误伤，纯文本输出会跳过正则（regexp）规则。
- GeoIP 过滤？支持 `@v4/@ipv4` 与 `@v6/@ipv6`。
- 索引强制刷新？`/geosite?fresh=1`、`/geoip?fresh=1`。

[配图占位] 错误与排查示例

—— 完 ——
