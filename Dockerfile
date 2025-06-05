# 使用官方 Node.js 运行时作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖（用于 sqlite3 编译）
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装项目依赖
RUN npm ci --only=production && npm cache clean --force

# 复制项目文件
COPY . .

# 创建必要的目录
RUN mkdir -p data logs

# 设置文件权限
RUN chown -R node:node /app
USER node

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# 启动应用
CMD ["npm", "start"] 