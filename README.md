# Artitalk Vercel 服务端

这个目录用于部署 Artitalk 的 Vercel 服务端，用 Neon Postgres 替代即将下线的 LeanCloud 服务。

## 环境变量

在 Vercel 中配置 `DATABASE_URL`，值为 `artitalk` 数据库对应的 Neon Postgres 连接字符串。

## 本地命令

```bash
npm install
npm test
```

## 初始化页面

部署到 Vercel 后，访问站点根路径。如果数据库中没有 Artitalk 数据，页面会显示两个选项：

- `初始化数据库`：只创建数据库表结构。
- `从 LeanCloud 迁移`：在浏览器中上传 `_User.0.jsonl`、`shuoshuo.0.jsonl` 和 `atComment.0.jsonl`，然后导入数据库。

迁移会导入 `_User`、`shuoshuo` 和 `atComment` 三类 JSONL 导出数据。LeanCloud 导出的用户密码哈希不会直接作为新系统登录密码使用；导入的 `_User.password` 只会保留为一次性的重置凭证。

## 密码重置

访问：

```text
/reset?user=<用户名>&pwd=<导入的 LeanCloud 加密密码>
```

页面会要求输入新密码。如果 `pwd` 与该用户导入的 `_User.password` 完全一致，服务端会把新密码保存为 PBKDF2-SHA256 哈希，并清空旧的重置凭证。

## 客户端配置

部署这个目录后，在 Artitalk 配置中把部署地址填为 `serverURL`，并启用 Vercel 后端：

```js
new Artitalk({
  backend: 'vercel',
  serverURL: 'https://your-vercel-app.vercel.app'
})
```

客户端会从该服务加载 `/artitalk-av.js`，随后通过 `/api` 调用服务端接口。
