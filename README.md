# 🌸 Zmin Nav

基于 Cloudflare Pages + KV 的轻量级私有导航站。零成本、无服务器、全球 CDN 加速。

> 基于 [CloudNav-abcd](https://github.com/aabacada/CloudNav-abcd) 二次修改。

## ✨ 功能

### 核心功能

- **书签管理** — 添加 / 编辑 / 删除 / 分类 / 拖拽排序 / 批量编辑
- **密码保护** — 全局密码 + 分类独立加密 + 密码过期策略
- **云端同步** — Cloudflare KV 边缘存储，多设备数据一致，乐观并发控制
- **备份恢复** — WebDAV 备份、浏览器书签 HTML/JSON 导入导出

### 智能特性

- **🤖 AI 智能排序** — 接入 OpenAI 兼容接口（OpenAI / DeepSeek / Gemini 等），一键自动整理书签分类和排序，支持自动创建新分类
- **🌸 樱花飘落背景** — Canvas 绘制的樱花花瓣飘落动画，为页面增添美感

### 体验优化

- **外部搜索** — 可配置多搜索引擎（Google、Bing、百度等）快捷跳转
- **深色模式** — 浅色 / 深色 / 跟随系统
- **响应式布局** — 桌面 & 移动端自适应
- **浏览器扩展** — Chrome Extension 一键收藏当前页面
- **站点自定义** — 自定义标题、导航栏名称、Favicon
- **无障碍支持** — 尊重 `prefers-reduced-motion` 系统设置

## 🚀 部署

### 前置条件

- [Cloudflare](https://dash.cloudflare.com/sign-up) 账号（免费）
- GitHub 账号

### 1. Fork 本仓库

### 2. 创建 KV 命名空间

Cloudflare Dashboard → **Workers & Pages** → **KV** → 创建命名空间，名称填 `CLOUDNAV_DB`。

### 3. 部署到 Pages

1. **Workers & Pages** → **创建应用程序** → **Pages** → 连接到 Git
2. 选择你 Fork 的仓库
3. 构建设置：

   | 配置项 | 值 |
   |--------|------|
   | 构建命令 | `npm run build` |
   | 输出目录 | `dist` |

4. 保存并部署

### 4. 绑定 KV & 环境变量

首次部署完成后，进入 Pages 项目 → **设置** → **函数**：

- **KV 命名空间绑定**：变量名 `CLOUDNAV_KV` → 选择 `CLOUDNAV_DB`
- **环境变量**（可选）：变量名 `PASSWORD` → 你的访问密码

保存后**重新部署**一次使配置生效。

## 🤖 AI 智能排序配置

部署完成后，在页面中进入 **设置 → AI 排序** 标签页：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| API 地址 | OpenAI 兼容的 API 端点 | `https://api.openai.com/v1/chat/completions` |
| API Key | 你的 API 密钥 | `sk-...` |
| 模型 | 使用的模型名称 | `gpt-4o-mini` / `deepseek-chat` / `gemini-2.0-flash` |

配置完成后，点击顶栏的 **「AI 整理」** 按钮即可一键智能分类排序。

> **说明：** AI 会分析每个书签的标题、URL、描述，自动归入最合适的分类并排序。「常用推荐」分类中的书签不会被移动。如果现有分类不够用，AI 会自动创建新分类。

## 🛠️ 本地开发

```bash
npm install
npm run dev     # 开发服务器 (需 wrangler 配合 KV)
npm run build   # 生产构建
```

## 📦 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | React 19 · TypeScript |
| 构建工具 | Vite 6 |
| 样式 | Tailwind CSS 4 |
| 动画 | Canvas API（樱花背景） |
| 后端 | Cloudflare Pages Functions |
| 存储 | Cloudflare KV |
| AI 集成 | OpenAI 兼容 API |

## ❓ FAQ

**修改密码？** Pages 设置中更新 `PASSWORD` 环境变量，重新部署。

**KV 变量名必须是 `CLOUDNAV_KV`？** 是的，代码硬编码了此名称。

**部署后打不开？** 检查 KV 绑定是否完成，绑定后需要重新部署。

**数据安全？** KV 本身高可用，但建议定期通过 WebDAV 或 JSON 导出备份。

**AI 排序需要什么？** 需要一个支持 OpenAI 兼容接口的 API Key，在设置中配置即可。支持 OpenAI、DeepSeek、Gemini 等各种兼容服务。

**樱花动画影响性能吗？** 不会。使用 Canvas 绘制，仅 25 个粒子，占用极低。同时尊重系统的 `prefers-reduced-motion` 设置。

## 📄 License

[Apache-2.0](LICENSE)
