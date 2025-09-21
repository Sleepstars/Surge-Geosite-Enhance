# Surge Geosite Explorer - Frontend

现代化的 Surge Geosite 规则浏览器前端，基于 React + TypeScript + Vite 构建，部署在 Cloudflare Pages。

## ✨ 特性

- 🚀 **现代技术栈**: React 18 + TypeScript + Vite
- 🎨 **现代设计**: Tailwind CSS + 暗色主题
- ⚡ **高性能**: 虚拟滚动 + React Query 缓存
- 📱 **响应式**: 完美适配桌面和移动设备
- 🔍 **强大搜索**: 实时搜索 + 反向匹配
- 🌐 **CDN 分发**: Cloudflare Pages 全球加速

## 🛠 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **数据获取**: TanStack Query
- **虚拟化**: TanStack Virtual
- **图标**: Lucide React
- **部署**: Cloudflare Pages

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发环境

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 📁 项目结构

```
frontend/
├── src/
│   ├── components/          # React 组件
│   │   ├── ui/             # 基础 UI 组件
│   │   ├── geosite/        # Geosite 相关组件
│   │   ├── geoip/          # GeoIP 相关组件
│   │   └── search/         # 搜索相关组件
│   ├── hooks/              # 自定义 Hooks
│   ├── stores/             # Zustand 状态管理
│   ├── types/              # TypeScript 类型定义
│   ├── utils/              # 工具函数
│   └── main.tsx           # 应用入口
├── public/                 # 静态资源
└── dist/                  # 构建输出
```

## 🔧 配置

### 环境变量

创建 `.env.local` 文件：

```env
# API 基础地址（开发环境会自动代理到 Worker）
VITE_API_BASE=https://your-worker-domain.workers.dev
```

### API 代理

开发环境下，Vite 会自动将 API 请求代理到本地 Worker：

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:8787',
    '/geosite': 'http://localhost:8787',
    '/geoip': 'http://localhost:8787',
  },
}
```

## 🚀 部署到 Cloudflare Pages

### 1. 连接 GitHub 仓库

在 Cloudflare Dashboard 中创建新的 Pages 项目，连接到你的 GitHub 仓库。

### 2. 构建配置

- **构建命令**: `npm run build`
- **构建输出目录**: `dist`
- **根目录**: `frontend`

### 3. 环境变量

在 Pages 设置中添加环境变量：

```
VITE_API_BASE=https://your-worker-domain.workers.dev
```

### 4. 自定义域名

在 Pages 设置中配置自定义域名，并更新 `_redirects` 文件中的 Worker 域名。

## 🎯 性能优化

### 虚拟滚动

使用 TanStack Virtual 实现大列表的虚拟滚动：

```typescript
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,
  overscan: 10,
})
```

### 数据缓存

使用 TanStack Query 实现智能缓存：

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 分钟
      gcTime: 10 * 60 * 1000,   // 10 分钟
    },
  },
})
```

### 代码分割

Vite 自动进行代码分割，将第三方库分离：

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom'],
        query: ['@tanstack/react-query'],
        virtual: ['@tanstack/react-virtual'],
      },
    },
  },
}
```

## 🔍 功能特性

### GeoSite 浏览

- 树状结构展示规则组
- 实时搜索和过滤
- 虚拟滚动支持大量规则
- 属性过滤和规则搜索

### GeoIP 浏览

- 列表形式展示 IP 规则
- IPv4/IPv6 分类显示
- CIDR 搜索和过滤
- 统计信息展示

### 反向匹配

- 域名/IP 反向查找
- 智能匹配算法
- 结果排序和评分
- 批量搜索支持

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
