# 2FA验证 - 详细部署指南

## 目录
1. [环境要求](#环境要求)
2. [部署方式对比](#部署方式对比)
3. [Docker部署（推荐）](#docker部署推荐)
4. [Linux原生部署](#linux原生部署)
5. [云平台部署](#云平台部署)
6. [生产环境配置](#生产环境配置)
7. [监控和维护](#监控和维护)
8. [故障恢复](#故障恢复)

---

## 环境要求

### 最低系统要求

| 组件 | 最小要求 | 推荐配置 |
|---|---|---|
| **CPU** | 1核心 | 2核心+ |
| **内存** | 256MB | 512MB+ |
| **磁盘** | 500MB | 1GB+ |
| **网络** | 1Mbps | 10Mbps+ |

### 软件版本

| 软件 | 版本 | 安装选项 |
|---|---|---|
| **Node.js** | 18.x LTS或更高 | 直接部署时必需 |
| **Docker** | 20.10+ | Docker部署时必需 |
| **Docker Compose** | 1.29+ | Docker部署时必需 |
| **Nginx** | 1.20+ | 反向代理时可选 |

---

## 部署方式对比

```
┌────────────────────────────────────────────────────────────────┐
│                     部署方式对比矩阵                             │
├────────────────────────────────────────────────────────────────┤
│ 指标        │ Docker  │ Docker Compose │ Node.js原生 │ Kubernetes │
├────────────────────────────────────────────────────────────────┤
│ 部署难度     │ 中     │ 简单           │ 简单        │ 复杂       │
│ 学习曲线     │ 中     │ 低             │ 低          │ 高         │
│ 可维护性     │ 高     │ 高             │ 一般        │ 很高       │
│ 可扩展性     │ 一般   │ 中             │ 差          │ 很好       │
│ 环境一致性   │ 完美   │ 完美           │ 一般        │ 完美       │
│ 启动时间     │ 1-3s   │ 1-3s           │ <1s         │ 5-10s      │
│ 适用场景     │ 小型   │ 小中型         │ 开发测试    │ 大型企业   │
└────────────────────────────────────────────────────────────────┘
```

---

## Docker部署（推荐）

### 部署方式1：Docker Compose（最简单）

#### 前置条件

```bash
# 检查Docker和Docker Compose
docker --version      # Docker version 20.10+
docker-compose --version  # docker-compose version 1.29+
```

#### 单服务器部署步骤

```bash
# 1. 创建应用目录
mkdir -p /opt/2fa-app
cd /opt/2fa-app

# 2. 克隆或上传项目
git clone <your-repo-url> .
# 或
# wget https://your-domain.com/2fa-app.tar.gz
# tar -xzf 2fa-app.tar.gz

# 3. 启动应用
docker-compose up -d

# 4. 验证运行状态
docker-compose ps
docker-compose logs -f

# 5. 访问应用
# http://localhost:3000 或 http://your-server-ip:3000
```

**预期输出**：
```
CONTAINER ID   IMAGE                  STATUS              PORTS
a1b2c3d4e5f6   2fa-authenticator      Up 2 minutes        0.0.0.0:3000->3000/tcp
```

#### docker-compose.yml配置详解

```yaml
version: '3.8'

services:
  2fa-authenticator:
    # 从当前目录的Dockerfile构建镜像
    build:
      context: .           # Dockerfile所在目录
      dockerfile: Dockerfile
    
    # 容器端口映射
    ports:
      - "3000:3000"        # 主机:容器
    
    # 环境变量
    environment:
      - NODE_ENV=production
      - PORT=3000
    
    # 重启策略
    restart: unless-stopped  # 自动重启（除非手动停止）
    
    # 健康检查
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "-", "http://localhost:3000/health"]
      interval: 30s         # 每30秒检查一次
      timeout: 10s          # 超时时间
      retries: 3            # 失败3次后标记不健康
      start_period: 5s      # 启动延迟
    
    # 容器名称
    container_name: 2fa-app
    
    # 日志配置（可选）
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "10"
```

### 部署方式2：多容器编排（带Redis缓存示例）

```yaml
version: '3.8'

services:
  # 主应用
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - REDIS_URL=redis://redis:6379
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

  # Redis缓存（可选）
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - app-network
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

networks:
  app-network:
    driver: bridge

volumes:
  redis-data:
```

### 部署方式3：带Nginx反向代理

`docker-compose.yml`：
```yaml
version: '3.8'

services:
  # Node.js应用
  app:
    build: .
    ports:
      - "3000:3000"  # 仅在内部网络暴露
    environment:
      - NODE_ENV=production
      - PORT=3000
    networks:
      - app-network
    restart: unless-stopped

  # Nginx反向代理
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro           # SSL证书目录
      - ./static:/usr/share/nginx/html:ro # 静态文件
    networks:
      - app-network
    depends_on:
      - app
    restart: unless-stopped

networks:
  app-network:
    driver: bridge
```

`nginx.conf`配置示例：
```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    gzip on;

    # HTTP重定向到HTTPS
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS服务器
    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL配置
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # 反向代理配置
        location / {
            proxy_pass http://app:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # 健康检查端点
        location /health {
            proxy_pass http://app:3000/health;
            access_log off;
        }
    }
}
```

启动命令：
```bash
docker-compose up -d

# 验证
docker-compose ps
curl http://localhost:3000
curl https://your-domain.com
```

---

## Linux原生部署

### 适用场景

- 不想使用Docker
- 已有固定的Node.js环境
- 需要与其他系统集成

### 安装步骤

#### 1. 安装Node.js

**方式A：使用NVM（推荐开发）**

```bash
# 下载并安装NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

# 重新加载shell配置
source ~/.bashrc

# 安装Node.js 18 LTS
nvm install 18
nvm use 18

# 验证
node --version  # v18.x.x
npm --version   # 9.x.x
```

**方式B：使用apt（Ubuntu/Debian）**

```bash
# 添加NodeSource仓库
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# 安装Node.js
sudo apt-get install -y nodejs

# 验证
node --version
npm --version
```

**方式C：使用yum（CentOS/RHEL）**

```bash
# 添加NodeSource仓库
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -

# 安装Node.js
sudo yum install -y nodejs

# 验证
node --version
npm --version
```

#### 2. 部署应用

```bash
# 创建应用目录和用户
sudo mkdir -p /opt/2fa-authenticator
sudo useradd -r -s /bin/false 2fa-user || true

# 克隆项目
cd /opt/2fa-authenticator
sudo git clone <your-repo-url> .
# 或
# sudo wget -qO- https://repo-url/2fa.tar.gz | sudo tar xz

# 设置权限
sudo chown -R 2fa-user:2fa-user /opt/2fa-authenticator

# 安装依赖
sudo -u 2fa-user npm install --production

# 测试运行
sudo -u 2fa-user npm start &
# 等待启动，然后 Ctrl+C 停止
```

#### 3. 创建系统服务

创建`/etc/systemd/system/2fa-authenticator.service`：

```ini
[Unit]
Description=2FA Authenticator Service
After=network.target

[Service]
Type=simple
User=2fa-user
WorkingDirectory=/opt/2fa-authenticator

# 启动命令
ExecStart=/usr/bin/node /opt/2fa-authenticator/server.js

# 重启策略
Restart=on-failure
RestartSec=5s

# 环境变量
Environment="NODE_ENV=production"
Environment="PORT=3000"

# 安全性配置
NoNewPrivileges=true
PrivateTmp=true

# 进程管理
KillMode=process
KillSignal=SIGTERM

# 日志
StandardOutput=journal
StandardError=journal
SyslogIdentifier=2fa-auth

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
# 重新加载systemd配置
sudo systemctl daemon-reload

# 启用服务
sudo systemctl enable 2fa-authenticator

# 启动服务
sudo systemctl start 2fa-authenticator

# 查看状态
sudo systemctl status 2fa-authenticator

# 查看日志
sudo journalctl -u 2fa-authenticator -f
```

#### 4. 配置Nginx反向代理

安装Nginx：

```bash
# Ubuntu/Debian
sudo apt install -y nginx

# CentOS/RHEL
sudo yum install -y nginx
```

配置`/etc/nginx/sites-available/2fa-authenticator`或`/etc/nginx/conf.d/2fa-authenticator.conf`：

```nginx
upstream 2fa_backend {
    server 127.0.0.1:3000;
    
    # 连接池配置
    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL证书
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 日志
    access_log /var/log/nginx/2fa-access.log;
    error_log /var/log/nginx/2fa-error.log;

    # 代理配置
    location / {
        proxy_pass http://2fa_backend;
        proxy_http_version 1.1;
        
        # 升级WebSocket连接（如果需要）
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # 传递头信息
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓冲配置
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # 健康检查不记录日志
    location /health {
        proxy_pass http://2fa_backend;
        access_log off;
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://2fa_backend;
        proxy_cache_valid 200 1d;
        expires 1d;
    }
}
```

启用配置：

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/2fa-authenticator \
           /etc/nginx/sites-enabled/2fa-authenticator
sudo rm -f /etc/nginx/sites-enabled/default  # 移除默认配置

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

#### 5. 获取SSL证书（Let's Encrypt）

```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书（自动配置Nginx）
sudo certbot certonly --standalone -d your-domain.com

# 自动续期（已包含在Ubuntu 20.04+）
sudo systemctl enable certbot.timer
```

---

## 云平台部署

### AWS EC2部署

```bash
# 启动EC2实例
# 选择：Ubuntu 20.04 LTS, t2.micro（免费层）或t2.small

# SSH连接
ssh -i your-key.pem ubuntu@your-instance-ip

# 安装Docker
sudo apt update && sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# 克隆项目
git clone <your-repo-url> /opt/2fa-app
cd /opt/2fa-app

# 启动
docker-compose up -d

# 配置安全组
# - 入站：80 (HTTP), 443 (HTTPS), 22 (SSH)
# - 出站：允许所有
```

### 阿里云容器服务ACR部署

```bash
# 1. 推送镜像到ACR
docker tag 2fa-authenticator:latest registry.cn-xxx.aliyuncs.com/your-namespace/2fa:latest
docker push registry.cn-xxx.aliyuncs.com/your-namespace/2fa:latest

# 2. 创建容器服务
# 通过ACR控制台创建应用

# 3. 配置负载均衡
# 添加监听规则：80 -> 容器 3000
```

### Azure App Service部署

```bash
# 1. 创建App Service
az appservice plan create --name 2fa-plan --resource-group your-rg --sku B1 --is-linux
az webapp create --resource-group your-rg --plan 2fa-plan --name 2fa-app --runtime "NODE|18-lts"

# 2. 部署代码
az webapp up --name 2fa-app --resource-group your-rg

# 3. 配置应用设置
az webapp config appsettings set --resource-group your-rg --name 2fa-app \
  --settings NODE_ENV=production PORT=3000
```

### Heroku部署

```bash
# 1. 创建Heroku应用
heroku create 2fa-app

# 2. 部署
git push heroku main

# 3. 查看日志
heroku logs --tail

# 4. 访问
heroku open
```

---

## 生产环境配置

### 环境变量配置

创建`.env`文件：

```env
# 应用配置
NODE_ENV=production
PORT=3000

# 日志级别（可选）
LOG_LEVEL=info

# 数据库（如果添加）
DB_URL=postgresql://user:pass@localhost/2fa

# Redis缓存（如果添加）
REDIS_URL=redis://localhost:6379

# API限流（如果添加）
RATE_LIMIT=100  # 每分钟请求数

# Sentry错误跟踪（如果添加）
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

server.js中使用环境变量：

```javascript
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

console.log(`环境: ${NODE_ENV}, 端口: ${PORT}, 日志级别: ${LOG_LEVEL}`);
```

### 日志配置

```javascript
// 添加到server.js
const fs = require('fs');
const path = require('path');

// 日志目录
const logsDir = '/var/log/2fa-authenticator';
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// 日志流
const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
);

// 应用到Express
app.use((req, res, next) => {
    const now = new Date().toISOString();
    const log = `${now} ${req.method} ${req.path} ${req.ip}\n`;
    accessLogStream.write(log);
    next();
});
```

### 安全性配置

```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 安全头
app.use(helmet());

// 速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100  // 最多100个请求
});
app.use('/api/', limiter);

// CORS配置
const cors = require('cors');
app.use(cors({
    origin: ['https://your-domain.com'],
    methods: ['GET', 'POST'],
    credentials: true
}));
```

### 性能优化

```javascript
// 启用gzip压缩
const compression = require('compression');
app.use(compression());

// 缓存静态资源
app.use(express.static(path.join(__dirname), {
    maxAge: '1d',
    etag: false
}));

// 缓存API响应（可选）
const mcache = require('memory-cache');

const cache = (duration) => {
    return (req, res, next) => {
        const key = '__express__' + req.originalUrl || req.url;
        const cachedBody = mcache.get(key);
        
        if (cachedBody) {
            res.send(cachedBody);
            return;
        }
        
        res.sendResponse = res.send;
        res.send = (body) => {
            mcache.put(key, body, duration * 1000);
            res.sendResponse(body);
        };
        next();
    };
};

app.get('/api/static-data', cache(10), (req, res) => {
    res.json({ data: 'cached' });
});
```

---

## 监控和维护

### 实时监控

```bash
# 查看容器状态
docker-compose ps

# 查看容器日志
docker-compose logs -f 2fa-authenticator

# 查看容器资源使用
docker stats

# 进入容器
docker-compose exec 2fa-authenticator /bin/sh
```

### Systemd监控

```bash
# 查看服务状态
sudo systemctl status 2fa-authenticator

# 查看实时日志
sudo journalctl -u 2fa-authenticator -f

# 查看最近100行日志
sudo journalctl -u 2fa-authenticator -n 100

# 清除日志
sudo journalctl -u 2fa-authenticator --vacuum-time=7d
```

### 监控脚本

创建`monitor.sh`：

```bash
#!/bin/bash

# 检查应用是否运行
check_app() {
    if curl -s http://localhost:3000/health > /dev/null; then
        echo "✓ 应用正常 $(date '+%Y-%m-%d %H:%M:%S')"
    else
        echo "✗ 应用故障 $(date '+%Y-%m-%d %H:%M:%S')"
        # 发送告警
        echo "应用宕机，请检查" | mail -s "2FA应用告警" admin@example.com
    fi
}

# 检查磁盘空间
check_disk() {
    usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $usage -gt 80 ]; then
        echo "警告：磁盘使用率 ${usage}%"
    fi
}

# 检查内存
check_memory() {
    usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')
    if [ $usage -gt 80 ]; then
        echo "警告：内存使用率 ${usage}%"
    fi
}

check_app
check_disk
check_memory
```

运行监控脚本：

```bash
# 添加到crontab
crontab -e

# 每5分钟检查一次
*/5 * * * * /opt/2fa-authenticator/monitor.sh >> /var/log/2fa-monitor.log 2>&1
```

### 性能指标

```bash
# 使用Artillery进行负载测试
npm install -g artillery

# 创建test.yml
cat > test.yml << 'EOF'
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: 'QR码生成'
    flow:
      - post:
          url: '/api/qrcode'
          json:
            secret: 'JBSWY3DPEHPK3PXP'
EOF

# 运行测试
artillery run test.yml
```

---

## 故障恢复

### 常见问题处理

#### 1. 容器无法启动

```bash
# 查看错误日志
docker-compose logs 2fa-authenticator

# 检查镜像
docker images

# 重建镜像
docker-compose build --no-cache

# 重新启动
docker-compose down
docker-compose up -d
```

#### 2. 端口被占用

```bash
# 查找占用3000端口的进程
sudo lsof -i :3000

# 杀死进程
sudo kill -9 <PID>

# 或修改端口
# 编辑docker-compose.yml：ports: ["3001:3000"]
```

#### 3. 内存溢出

```bash
# 限制容器内存
# 编辑docker-compose.yml：
# deploy:
#   resources:
#     limits:
#       memory: 512M

docker-compose up -d

# 查看内存使用
docker stats
```

#### 4. 高CPU使用率

```bash
# 诊断进程
docker top container-name

# 如果是无限循环，重启容器
docker-compose restart

# 优化代码（后续步骤）
```

### 备份和恢复

```bash
# 完整备份
tar -czf 2fa-backup-$(date +%Y%m%d).tar.gz /opt/2fa-authenticator

# 上传到云存储
scp 2fa-backup-*.tar.gz user@backup-server:/backups/

# 恢复
tar -xzf 2fa-backup-20240304.tar.gz -C /opt/
```

### 版本更新

```bash
# 备份
cp -r /opt/2fa-authenticator /opt/2fa-authenticator.bak

# 拉取新代码
cd /opt/2fa-authenticator
git pull origin main

# 更新依赖
npm install

# 重新构建Docker镜像
docker-compose build

# 启动新版本
docker-compose up -d

# 验证
curl http://localhost:3000/health

# 如果失败，回滚
rm -rf /opt/2fa-authenticator
cp -r /opt/2fa-authenticator.bak /opt/2fa-authenticator
docker-compose up -d
```

---

## 检查清单

### 部署前检查

- [ ] 系统内存不少于256MB
- [ ] 磁盘空间不少于500MB
- [ ] 安装了Docker 20.10+和Docker Compose 1.29+
- [ ] 防火墙开放了80和443端口
- [ ] 域名已解析到服务器IP
- [ ] SSL证书已准备（Let's Encrypt）
- [ ] 备份了代码仓库

### 部署后检查

- [ ] 应用成功启动，无错误日志
- [ ] 健康检查正常 `curl http://localhost:3000/health`
- [ ] 访问主页能看到2FA界面
- [ ] 验证码生成正常
- [ ] QR码生成正常
- [ ] 日志配置完成
- [ ] 监控脚本部署
- [ ] 备份策略制定

### 生产环境检查

- [ ] 使用HTTPS加密
- [ ] 反向代理配置完成
- [ ] 日志切割策略配置
- [ ] 自动监控告警配置
- [ ] 故障转移方案
- [ ] 备份策略测试
- [ ] 性能测试通过
- [ ] 安全审计完成

---

## 总结

| 部署方式 | 推荐学位 | 难度 | 最佳用途 |
|---|---|---|---|
| Docker Compose | ⭐⭐ | 简单 | 单服务器，快速部署 |
| Node.js + Systemd | ⭐⭐⭐ | 中等 | 已有Node.js环境 |
| Kubernetes | ⭐⭐⭐⭐⭐ | 复杂 | 大规模集群部署 |
| 云平台 | ⭐⭐ | 简单 | 快速上线，无需维护 |

**推荐生产部署方案**：
```
Linux服务器 + Docker Compose + Nginx反向代理 + Let's Encrypt SSL
```

这个方案既简单高效，又足够稳定可靠。

