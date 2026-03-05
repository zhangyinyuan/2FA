# 快速开始指南

## 本地开发（Windows/Mac/Linux）

### 1. 安装依赖

```bash
cd c:\dev\workspace\nguone\2FA
npm install
```

### 2. 启动服务器

```bash
npm start
```

输出应该显示：
```
2FA 认证器运行在 http://0.0.0.0:3000
```

### 3. 打开浏览器

访问：`http://localhost:3000`

### 4. 测试功能

1. **查看默认密钥**：页面已预填 `JBSWY3DPEHPK3PXP`
2. **点击"获取验证码"**：会立即生成一个6位验证码
3. **实时倒计时**：显示验证码距离过期的秒数
4. **点击"生成二维码"**：生成可扫描的QR码

---

## Linux部署（详细步骤）

### 快速部署（Docker Compose）

```bash
# 1. 在Linux服务器上准备
mkdir -p /opt/2fa-authenticator
cd /opt/2fa-authenticator

# 2. 上传/克隆项目文件
git clone <your-repo-url> .

# 3. 首次部署：创建环境变量文件
cp .env.example .env

# 4. 如需自定义监听IP和端口（示例：127.0.0.1:13000）
# HOST_IP=127.0.0.1
# HOST_PORT=13000

# 5. 启动应用
docker-compose up -d --build

# 6. 查看日志
docker-compose logs -f

# 7. 访问应用
# 打开浏览器：http://服务器IP:${HOST_PORT}
```

### 修改端口（推荐方式）

不要修改 `docker-compose.yml`，只改 `.env`：

```env
HOST_IP=127.0.0.1
HOST_PORT=13000
```

然后：
```bash
docker-compose up -d
```

### 后续更新代码（避免git pull冲突）

```bash
# 1. 拉取最新代码
git pull

# 2. 重建并启动
docker-compose up -d --build
```

说明：
- 端口配置保存在 `.env`（未纳入版本控制）
- 可通过 `HOST_IP` 控制监听范围（`127.0.0.1` 仅本机，`0.0.0.0` 对外可访问）
- 这样更新代码时不会因为 `docker-compose.yml` 被本地修改而冲突

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `index.html` | 前端界面 |
| `style.css` | 样式文件 |
| `app.js` | 客户端JS（TOTP算法实现）|
| `server.js` | Node.js服务器 |
| `package.json` | 依赖配置 |
| `Dockerfile` | Docker镜像配置 |
| `docker-compose.yml` | Docker容器编排 |
| `README.md` | 项目文档 |
| `DEPLOY_LINUX.md` | Linux部署详细指南 |

---

## 核心特性

✅ **纯客户端TOTP计算**：使用Web Crypto API在浏览器中计算，密钥不上传服务器

✅ **实时验证码更新**：每30秒自动更新一次

✅ **QR码生成**：支持扫描导入到Google Authenticator等应用

✅ **响应式设计**：支持桌面、平板、手机

✅ **无数据库**：轻量级应用，开箱即用

---

## 测试用的示例密钥

```
JBSWY3DPEHPK3PXP
```

这是Base32编码的密钥，可直接使用。

---

## API接口（可选开发）

应用已预制以下API，可用于扩展功能：

```bash
# 生成二维码
curl -X POST http://localhost:3000/api/qrcode \
  -H "Content-Type: application/json" \
  -d '{"secret":"JBSWY3DPEHPK3PXP"}'

# 验证验证码（可选）
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"secret":"JBSWY3DPEHPK3PXP","token":"123456"}'

# 生成新密钥
curl -X POST http://localhost:3000/api/generate-secret
```

---

## 问题排查

### npm: 无该命令？
```bash
# Windows：重装Node.js
# Linux：按DEPLOY_LINUX.md安装Node.js
```

### Docker无法启动？
```bash
docker-compose logs
# 查看错误信息，通常是端口占用或镜像拉取失败
```

### 访问localhost:3000显示无法连接？
```bash
# 检查服务是否运行
docker-compose ps
# 或
npm start
```

---

## 下一步

1. **自定义界面**：修改 `style.css` 调整颜色和布局
2. **增加多语言**：在 `index.html` 添加语言切换
3. **数据持久化**：添加本地存储或数据库支持
4. **客户端导出**：支持导出验证码到文件

---

**现在您可以：**
- ✅ 在Windows本地开发（运行 `npm start`）
- ✅ 推送到Linux部署（使用Docker Compose）
- ✅ 自定义和扩展功能

祝您使用愉快！
