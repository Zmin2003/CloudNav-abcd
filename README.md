# CloudNav (云航)

基于 Cloudflare Pages + KV 的轻量级私有导航站，完全免费，无需服务器。

## 部署指南

### 前置要求

- Cloudflare 账号（[免费注册](https://dash.cloudflare.com/sign-up)）
- GitHub 账号

### 第一步：Fork 仓库

点击本仓库右上角的 `Fork` 按钮，将项目复制到你的 GitHub 账号下。

### 第二步：创建 KV 命名空间

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 `Workers & Pages` → `KV`
3. 点击 `创建命名空间`
4. 输入命名空间名称：`CLOUDNAV_DB`
5. 点击 `添加`

### 第三步：部署到 Cloudflare Pages

1. 在 Cloudflare Dashboard 中，进入 `Workers & Pages`
2. 点击 `创建应用程序` → `Pages` → `连接到 Git`
3. 选择你 Fork 的仓库 `CloudNav-abcd`
4. 配置构建设置：
   - **构建命令**：`npm run build`
   - **构建输出目录**：`dist`
   - **根目录**：`/`（保持默认）
5. 点击 `保存并部署`

### 第四步：绑定 KV 和环境变量

等待首次部署完成后：

1. 进入你的 Pages 项目 → `设置` → `函数`
2. 在 `KV 命名空间绑定` 部分点击 `添加绑定`：
   - **变量名称**：`CLOUDNAV_KV`
   - **KV 命名空间**：选择 `CLOUDNAV_DB`
3. 在 `环境变量` 部分点击 `添加变量`（可选，设置访问密码）：
   - **变量名称**：`PASSWORD`
   - **值**：输入你的访问密码（例如：`mypassword123`）
4. 点击 `保存`

### 第五步：重新部署

配置完成后，需要重新部署使配置生效：

1. 进入 `部署` 标签
2. 找到最新的部署记录
3. 点击右侧的 `...` 菜单
4. 选择 `重试部署`

等待部署完成，即可访问你的私有导航站！

## 功能特性

- **书签管理** - 添加、编辑、删除、分类管理、拖拽排序
- **密码保护** - 全局密码保护，支持分类单独加密
- **数据同步** - 基于 Cloudflare KV 全球边缘存储
- **备份导入** - 支持 WebDAV 备份、浏览器书签导入
- **搜索功能** - 内部搜索和外部搜索引擎集成
- **主题模式** - 浅色/深色/自动主题切换
- **响应式** - 完美适配桌面端和移动端
- **浏览器扩展** - 提供书签快捷收藏工具

## 本地开发

```bash
# 安装依赖
npm install

# 本地开发（需要配置 wrangler）
npm run dev

# 构建
npm run build
```

## 技术栈

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- Cloudflare Pages Functions
- Cloudflare KV

## 常见问题

**Q: 如何修改访问密码？**
A: 在 Pages 项目设置中修改 `PASSWORD` 环境变量，然后重新部署。

**Q: KV 绑定变量名必须是 `CLOUDNAV_KV` 吗？**
A: 是的，代码中使用的是这个变量名，必须完全一致。

**Q: 部署后无法访问？**
A: 确保已完成 KV 绑定并重新部署。首次绑定后必须重新部署才能生效。

**Q: 数据会丢失吗？**
A: 数据存储在 Cloudflare KV 中，具有高可用性。建议定期使用 WebDAV 备份功能。

## License

MIT

---

**如果这个项目对你有帮助，请给一个 Star ⭐**
