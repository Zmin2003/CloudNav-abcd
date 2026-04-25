# 🌸 Zmin Nav

基于 Cloudflare Pages + KV 的轻量级私有导航站。零成本、无服务器、全球 CDN 加速。

> 基于 [CloudNav-abcd](https://github.com/aabacada/CloudNav-abcd) 二次修改。

## ✨ 功能

### v0.1.2 更新（全面扁平 MD 风格）

- **UI 统一为扁平 Material 风格**：去除玻璃拟态层、重 blur 与高光装饰，改为实色面板 + 细边框 + 清晰状态色。
- **主要按钮统一为纯色体系**：添加与 AI 操作按钮改为纯色填充，移动端 FAB 同步扁平化，保证风格一致。

### v0.1.1 更新（风格回调）

- **UI 风格调整为现代简约（非重毛玻璃）**：降低拟态强度，减少过多 blur/高光/叠层，提升信息可读性与长期使用舒适度。
- 保留现代视觉语义（圆角、层级、状态色），但采用更克制的阴影与边框体系，兼顾性能与清晰度。

### v0.1.0 更新（本次升级）

- **整体 UI 升级为更现代的 Aurora Glass 风格**：减少“花哨渐变”与过度高光，统一浅/深色层次与阴影系统，提升可读性与高级感。
- **修复交互逻辑问题**：
  - 顶栏新增桌面端 **备份入口**（此前仅移动端可见）。
  - 顶栏新增桌面端 **批量编辑入口**，与移动端能力对齐。
  - 新增实时 **同步状态标签**（同步中 / 已同步 / 同步失败 / 本地模式），降低数据状态不透明问题。
  - 修复 LinkCard 中点击拦截回调依赖不准确的问题，减少长按后的误触跳转风险。
- **清理死代码**：移除 LinkCard 内部无效 `key` 传递，减少冗余渲染噪音。
- **版本号升级**：`0.1.0`。

### 核心功能

- **书签管理** — 添加 / 编辑 / 删除 / 分类 / 拖拽排序 / 批量编辑
- **密码保护** — 全局密码 + 分类独立加密 + 密码过期策略
- **云端同步** — Cloudflare KV 边缘存储，多设备数据一致，乐观并发控制
- **备份恢复** — WebDAV 备份、浏览器书签 HTML/JSON 导入导出

### 智能特性

- **🤖 AI 智能整理** — 接入 OpenAI 兼容接口（OpenAI / DeepSeek / Gemini 等），一键完成：
  - 自动分类排序，支持创建新分类
  - 优化书签名称（去除冗余后缀）
  - 补充缺失的网站图标（favicon）
  - 服务端代理调用，无 CORS / 混合内容问题
- **🌸 樱花飘落背景** — Canvas 绘制的真实樱花花瓣飘落动画，支持开关控制（设置 → 网站设置）

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

配置完成后，点击顶栏的 **「AI 整理」** 按钮即可一键智能整理。

> **说明：**
> - AI 会分析每个书签的标题、URL、描述，自动归入最合适的分类并排序
> - 自动优化书签名称（如 `"GitHub: Let's build from here · GitHub"` → `"GitHub"`）
> - 自动为缺少图标的书签补充 favicon
> - 「常用推荐」分类中的书签不会被移动
> - 如果现有分类不够用，AI 会自动创建新分类
> - API 调用通过服务端代理，支持 HTTP/HTTPS 的 API 地址

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

**樱花动画影响性能吗？** 不会。使用 Canvas 绘制，仅 38 个粒子，占用极低。可在设置 → 网站设置中开关，同时尊重系统的 `prefers-reduced-motion` 设置。

## 📄 License

[Apache-2.0](LICENSE)
