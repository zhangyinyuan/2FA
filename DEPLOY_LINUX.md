# Linux部署指南

## 前置条件

### 选项1：使用Docker部署（推荐）

#### 系统要求
- Linux操作系统（Ubuntu 20.04+、CentOS 8+ 或其他发行版）
- Docker 20.10+
- Docker Compose 1.29+

#### 检查Docker安装
```bash
docker --version
docker-compose --version
```

### 选项2：直接Node.js部署

#### 系统要求
- Linux操作系统
- Node.js 18.0.0+（推荐18.x或20.x LTS版本）
- npm 9.0.0+

#### 检查Node.js安装
```bash
node --version
npm --version
```

---

## 部署步骤

### 方式一：Docker Compose 快速部署（推荐）

#### 1. 准备服务器

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Docker（如果未安装）
sudo apt install -y docker.io docker-compose

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker

# 添加当前用户到docker组（可选，避免使用sudo）
sudo usermod -aG docker $USER
```

#### 2. 上传项目

```bash
# 方式A：从Git仓库克隆
git clone https://your-repo-url.git /opt/2fa-authenticator
cd /opt/2fa-authenticator

# 或方式B：上传压缩包
# scp 2fa-authenticator.tar.gz user@server:/opt/
# tar -xzf /opt/2fa-authenticator.tar.gz
```

#### 3. 启动应用

```bash
cd /opt/2fa-authenticator

# 启动容器
docker-compose up -d

# 验证启动
docker-compose ps
docker-compose logs -f
```

#### 4. 配置防火墙

```bash
# UFW防火墙（Ubuntu）
sudo ufw allow 3000/tcp

# 或 firewalld（CentOS）
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

#### 5. 访问应用

```
http://your-server-ip:3000
```

---

### 方式二：Nginx反向代理 + Docker

创建 `/etc/nginx/sites-available/2fa-authenticator`：

```nginx
upstream 2fa_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 20M;

    # 重定向到HTTPS（可选）
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL证书配置（使用Let's Encrypt为例）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://2fa_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/2fa-authenticator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

获取SSL证书（如果使用Let's Encrypt）：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d your-domain.com
```

---

### 方式三：不使用Docker的直接部署

#### 1. 安装Node.js

```bash
# 方式A：使用NVM（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# 方式B：使用apt
sudo apt install -y nodejs npm
```

#### 2. 部署应用

```bash
# 创建应用目录
mkdir -p /opt/2fa-authenticator
cd /opt/2fa-authenticator

# 克隆或上传项目代码
git clone https://your-repo-url.git .

# 安装依赖
npm install --production
```

#### 3. 创建系统服务

创建 `/etc/systemd/system/2fa-authenticator.service`：

```ini
[Unit]
Description=2FA Authenticator Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/2fa-authenticator
ExecStart=/usr/bin/node /opt/2fa-authenticator/server.js
Restart=on-failure
RestartSec=5

Environment="NODE_ENV=production"
Environment="PORT=3000"

# 安全性设置
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable 2fa-authenticator
sudo systemctl start 2fa-authenticator
sudo systemctl status 2fa-authenticator
```

#### 4. 使用Nginx反向代理

参考方式二中的Nginx配置。

---

## 监控和维护

### 查看日志

```bash
# Docker方式
docker-compose logs -f
docker-compose logs --tail 100

# Systemd方式
sudo journalctl -u 2fa-authenticator -f
sudo journalctl -u 2fa-authenticator --lines 100
```

### 重启服务

```bash
# Docker方式
docker-compose restart

# Systemd方式
sudo systemctl restart 2fa-authenticator
```

### 更新应用

```bash
cd /opt/2fa-authenticator

# 拉取最新代码
git pull origin main

# Docker方式
docker-compose up -d --build

# Node.js方式
npm install
sudo systemctl restart 2fa-authenticator
```

### 备份

```bash
# 备份应用目录
tar -czf 2fa-backup-$(date +%Y%m%d).tar.gz /opt/2fa-authenticator

# 或使用S3等云存储
# aws s3 cp 2fa-backup-*.tar.gz s3://your-bucket/
```

---

## 性能调优

### Node.js优化

编辑 `/etc/systemd/system/2fa-authenticator.service`：

```ini
Environment="NODE_ENV=production"
Environment="NODE_OPTIONS=--max-old-space-size=512"
```

### Nginx优化

```nginx
worker_processes auto;
worker_connections 4096;

gzip on;
gzip_types text/plain text/css text/javascript application/json;
```

---

## 安全建议

1. **使用HTTPS**：始终在生产环境使用SSL/TLS加密
2. **防火墙**：限制访问端口和IP
3. **定期更新**：定期更新Docker镜像和依赖包
4. **备份**：定期备份应用和数据
5. **监控**：使用监控工具追踪应用状态

```bash
# 定期更新Docker镜像
docker-compose pull
docker-compose up -d

# 定期检查依赖包安全性
npm audit
npm audit fix
```

---

## 故障排除

### 容器启动失败

```bash
docker-compose logs 2fa-authenticator
docker-compose down
docker-compose up -d
```

### 端口被占用

```bash
# 查看占用3000端口的进程
sudo lsof -i :3000
# 杀死进程
sudo kill -9 <PID>

# 或修改docker-compose.yml中的端口
```

### 内存不足

```bash
docker stats  # 查看容器资源使用情况
docker-compose down
docker system prune  # 清理未使用的Docker资源
```

---

## 常见问题

**Q: 如何修改端口？**
A: 编辑docker-compose.yml中的ports部分，或设置PORT环境变量。

**Q: 如何设置开机自动启动？**
A: Docker方式已自动启用。Systemd方式已配置WantedBy=multi-user.target。

**Q: 如何实现自动更新？**
A: 可以配置Git Webhook + systemd Timer自动拉取和重启。

---

## 支持

有问题？提交Issue或查看主README.md文档。
