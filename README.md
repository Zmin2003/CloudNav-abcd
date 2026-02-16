# Zmin Nav

基于 Cloudflare Pages + KV 的轻量级私有导航站。零成本、无服务器、全球 CDN 加速。

> 基于 [CloudNav-abcd](https://github.com/aabacada/CloudNav-abcd) 二次修改。

## 功能

- 书签管理 - 添加 / 编辑 / 删除 / 分类 / 拖拽排序
- 密码保护 - 全局密码 + 分类独立加密
- 云端同步 - Cloudflare KV 边缘存储，多设备数据一致
- 备份恢复 - WebDAV 备份、浏览器书签 HTML/JSON 导入导出
- 外部搜索 - 可配置多搜索引擎（Google、Bing、百度等）快捷跳转
- 深色模式 - 浅色 / 深色 / 跟随系统
- 响应式布局 - 桌面 & 移动端自适应
- 浏览器扩展 - Chrome Extension 一键收藏当前页面
- 站点自定义 - 自定义标题、导航栏名称、Favicon

## 部署

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

## 本地开发

```bash
npm install
npm run dev     # 开发服务器 (需 wrangler 配合 KV)
npm run build   # 生产构建
```

## 技术栈

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Cloudflare Pages Functions · Cloudflare KV

## FAQ

**修改密码？** Pages 设置中更新 `PASSWORD` 环境变量，重新部署。

**KV 变量名必须是 `CLOUDNAV_KV`？** 是的，代码硬编码了此名称。

**部署后打不开？** 检查 KV 绑定是否完成，绑定后需要重新部署。

**数据安全？** KV 本身高可用，但建议定期通过 WebDAV 或 JSON 导出备份。

## License

[Apache-2.0](LICENSE)
