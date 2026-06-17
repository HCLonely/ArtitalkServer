# Artitalk Vercel 服务端

这个目录用于部署 Artitalk 的 Vercel 服务端，用 Neon Postgres 替代即将下线的 LeanCloud 服务。

## 环境变量

在 Vercel 中配置 `DATABASE_URL`，值为 `artitalk` 数据库对应的 Neon Postgres 连接字符串。

可选配置 `ALLOW_ORIGIN` 限制允许跨域访问的站点域名，多个域名用英文逗号分隔，例如 `https://blog.example.com,https://admin.example.com`。未配置时允许所有域名访问。

## 本地命令

```bash
npm install
npm test
```

## 初始化页面

部署到 Vercel 后，访问站点根路径。如果数据库中没有 Artitalk 数据，页面会显示两个选项：

- `初始化数据库`：只创建数据库表结构。
- `从 LeanCloud 迁移`：在浏览器中上传 `shuoshuo.0.jsonl` 和 `atComment.0.jsonl`，然后导入数据库。

迁移会导入 `shuoshuo` 和 `atComment` 三类 JSONL 导出数据。

## 客户端配置

部署这个目录后，在 Artitalk 配置中把部署地址填为 `serverURL`，并启用 Vercel 后端：

```js
new Artitalk({
  backend: 'vercel',
  serverURL: 'https://your-vercel-app.vercel.app'
})
```
