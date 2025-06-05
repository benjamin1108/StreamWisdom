#!/bin/bash

# 悟流部署脚本
# Stream Wisdom Deployment Script

set -e

echo "🚀 开始部署悟流 / Stream Wisdom..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装，请先安装 Docker Compose${NC}"
    exit 1
fi

# 检查.env文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env 文件不存在，正在创建...${NC}"
    cp env.example .env
    echo -e "${YELLOW}📝 请编辑 .env 文件配置API密钥后重新运行此脚本${NC}"
    exit 1
fi

# 检查API密钥配置
if ! grep -q "^XAI_API_KEY=.*[^=]$" .env && \
   ! grep -q "^GROQ_API_KEY=.*[^=]$" .env && \
   ! grep -q "^DASHSCOPE_API_KEY=.*[^=]$" .env && \
   ! grep -q "^OPENAI_API_KEY=.*[^=]$" .env; then
    echo -e "${RED}❌ 未检测到有效的API密钥配置${NC}"
    echo -e "${YELLOW}📝 请在 .env 文件中配置至少一个AI模型的API密钥${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 环境检查通过${NC}"

# 创建必要的目录
mkdir -p data logs

# 停止现有容器
echo -e "${BLUE}🛑 停止现有容器...${NC}"
docker-compose down 2>/dev/null || true

# 构建镜像
echo -e "${BLUE}🔨 构建Docker镜像...${NC}"
docker-compose build

# 启动服务
echo -e "${BLUE}🚀 启动服务...${NC}"
docker-compose up -d

# 等待服务启动
echo -e "${BLUE}⏳ 等待服务启动...${NC}"
sleep 10

# 检查服务状态
if curl -f http://localhost:8080/ >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 部署成功！${NC}"
    echo -e "${GREEN}🌐 访问地址: http://localhost:8080${NC}"
    echo -e "${GREEN}📊 查看状态: docker-compose ps${NC}"
    echo -e "${GREEN}📋 查看日志: docker-compose logs -f${NC}"
else
    echo -e "${RED}❌ 服务启动失败${NC}"
    echo -e "${YELLOW}📋 查看日志: docker-compose logs${NC}"
    exit 1
fi

echo -e "${BLUE}🎉 悟流部署完成！${NC}" 