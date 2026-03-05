# 2FA验证 - 双重认证码生成工具

这是一个基于Web的TOTP（时间一次性密码）生成器，相当于Google Authenticator的网页版本。

## 功能特性

- ✅ **TOTP生成**：基于时间的一次性密码生成
- ✅ **密钥管理**：支持输入自定义密钥或生成新密钥
- ✅ **二维码生成**：生成符合Google Authenticator标准的二维码
- ✅ **实时倒计时**：显示验证码有效期
- ✅ **响应式设计**：支持桌面和移动设备
- ✅ **纯客户端验证**：核心TOTP计算在浏览器中执行

## 快速开始

### 本地开发

1. 克隆项目
```bash
git clone <repository-url>
cd 2FA
```

2. 安装依赖
```bash
npm install
```

3. 启动服务器
```bash
npm start
```

4. 打开浏览器访问
```
http://localhost:3000
```

### Linux Docker部署

#### 方式一：使用Docker Compose（推荐）

```bash
# 1) 首次部署时创建环境变量文件
cp .env.example .env

# 2) 可选：修改监听IP和端口（例如仅本机开放 127.0.0.1:13000）
# 编辑 .env：
# HOST_IP=127.0.0.1
# HOST_PORT=13000

# 3) 启动
docker-compose up -d --build
```

默认访问 `http://your-server-ip:${HOST_PORT}`（未配置时默认 `0.0.0.0:3000`）

如果设置为 `HOST_IP=127.0.0.1`，则仅服务器本机可访问（适合配合Nginx反代）。

#### 方式二：手动Docker构建和运行

```bash
# 构建镜像
docker build -t 2fa-authenticator .

# 运行容器
docker run -d -p 3000:3000 --name 2fa-app 2fa-authenticator
```

#### 方式三：直接在Linux上运行（需要Node.js）

```bash
# 安装依赖
npm install

# 启动服务
NODE_ENV=production npm start
```

## 使用说明

1. **输入密钥**：在文本框中输入Base32格式的密钥（例如：JBSWY3DPEHPK3PXP）
2. **点击获取验证码**：生成当前的6位验证码
3. **查看信息**：
   - 双重密钥：显示当前输入的密钥
   - 当前验证码：6位数字验证码
   - 剩余的时间：距离验证码更新的秒数
4. **生成二维码**：点击按钮生成QR码，可用于导入到其他认证器

## API接口

### 生成二维码
```
POST /api/qrcode
Content-Type: application/json

Request:
{
  "secret": "JBSWY3DPEHPK3PXP"
}

Response:
{
  "qrcode": "data:image/png;base64,..."
}
```

### 验证TOTP
```
POST /api/verify
Content-Type: application/json

Request:
{
  "secret": "JBSWY3DPEHPK3PXP",
  "token": "123456"
}

Response:
{
  "valid": true,
  "message": "验证码正确"
}
```

### 生成新密钥
```
POST /api/generate-secret

Response:
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrcode": "otpauth://totp/2FA%20Authenticator?secret=JBSWY3DPEHPK3PXP&issuer=2FA%20Authenticator"
}
```

### 健康检查
```
GET /health

Response:
{
  "status": "ok"
}
```

## 技术栈

- **前端**：
  - HTML5
  - CSS3（响应式设计）
  - JavaScript（原生TOTP实现使用Web Crypto API）
  
- **后端**：
  - Node.js
  - Express.js
  - QRCode（用于二维码生成）
  - Speakeasy（用于TOTP验证）

## 部署到生产环境

### 系统要求
- Linux操作系统（Ubuntu 20.04+ 推荐）
- Docker 和 Docker Compose（推荐方式）
- 或 Node.js 18+

### 推荐的部署方式

```bash
# 1. 克隆项目到服务器
git clone <repository-url> /opt/2fa-authenticator
cd /opt/2fa-authenticator

# 2. 使用Docker Compose启动
docker-compose up -d

# 3. 查看日志
docker-compose logs -f

# 4. 配置反向代理（Nginx示例）
```

### Nginx反向代理配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 环境变量

- `PORT`：服务器监听端口（默认：3000）
- `NODE_ENV`：运行环境（development/production）
- `HOST_IP`：宿主机监听IP（默认：0.0.0.0）
- `HOST_PORT`：宿主机映射端口（默认：3000）

### 首次搭建与后续更新建议

```bash
# 首次搭建
git clone <repository-url> /opt/2fa-authenticator
cd /opt/2fa-authenticator
cp .env.example .env
# 可选：编辑 .env
# HOST_IP=127.0.0.1
# HOST_PORT=13000
docker-compose up -d --build

# 后续更新
git pull
docker-compose up -d --build
```

不要直接修改 `docker-compose.yml` 里的端口映射，避免 `git pull` 时出现冲突。

## 安全说明

1. **密钥保密**：TOTP密钥应该保密，不要在网络上传输
2. **HTTPS**：在生产环境中务必使用HTTPS
3. **备份**：保存TOTP密钥的备份方式

## 功能扩展

可添加的功能：
- 多账户管理
- 密钥数据库存储
- 备份码生成
- 导入/导出功能
- 暗黑模式

## 许可证

MIT

## 贡献

欢迎提交Issue和Pull Request！

## 常见问题

### Q: 验证码不更新？
A: 检查系统时间是否正确，TOTP依赖精确的系统时间。

### Q: 提示"无效的Base32字符"？
A: 确保输入的密钥只包含A-Z和2-7的字符。

### Q: Docker容器无法启动？
A: 运行 `docker logs <container-name>` 查看错误信息。

## 联系方式

如有问题，请提交Issue或联系开发者。
