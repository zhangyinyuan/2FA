FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 只复制package.json（忽略lockfile）
COPY package.json ./

# 强制使用官方npm源并安装依赖
RUN npm config set registry https://registry.npmjs.org/ && \
    npm cache clean --force && \
    npm install --production --no-package-lock

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# 启动应用
CMD ["npm", "start"]
