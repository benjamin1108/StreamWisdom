# 悟流 / Stream of Wisdom

<div align="center">

![悟流](https://img.shields.io/badge/悟流-Stream%20of%20Wisdom-blue?style=for-the-badge&logo=brain&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=for-the-badge&logo=node.js)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-yellow?style=for-the-badge&logo=javascript)

**将内容转化为知识，让智慧如水流淌**

*"在信息泛滥的时代，我们不缺内容，而是缺少被转化的知识"*

[功能演示](#功能特性) • [快速开始](#快速开始) • [API文档](#api-文档) • [贡献指南](#贡献指南)

</div>

## 🌟 项目简介

悟流（Stream of Wisdom）是一个智能的文本转化平台，专注于将网络内容转化为简洁、生动、易于理解的知识形式。不同于传统的信息聚合工具，悟流致力于深度理解和重新组织内容，让每一次阅读都成为知识的积累。

### 🎯 设计理念

- **深度转化** - 不是简单的摘要，而是重新组织和表达
- **智能适配** - 根据内容类型和复杂度自动调整处理策略
- **流式体验** - 实时展示转化过程，让等待变成期待
- **知识沉淀** - 完整的历史记录和分享机制

## ✨ 功能特性

### 🔄 智能内容转化
- **多格式支持** - 支持网页、PDF文档（包括学术论文）的智能识别和提取
- **智能模式** - 自动识别、简化提炼、结构优先、核心要点四种转化模式
- **学术优化** - 专门针对ACM、IEEE、arXiv等学术资源的优化处理
- **反重复机制** - 智能检测已转化内容，避免重复处理

### 🚀 多模型支持
支持多种主流AI模型，自动选择最佳可用模型：
- **xAI Grok 3** - 最新模型，推荐使用
- **Groq LLaMA 3** - 速度快，免费额度丰富
- **通义千问** - 阿里云官方模型，中文支持优秀
- **OpenAI GPT-4** - 经典模型，兜底选择

### 💫 流式处理体验
- **实时流式输出** - 边生成边展示，提供流畅的用户体验
- **智能进度提示** - 详细的处理阶段展示和进度指示
- **可中断处理** - 支持随时停止长时间处理任务
- **错误恢复** - 完善的错误处理和重试机制

### 📚 历史管理系统
- **无限滚动历史** - 智能分页，流畅浏览所有转化记录
- **实时搜索** - 支持标题、URL、内容的全文搜索
- **一键分享** - 生成精美的分享页面，支持多种复制方式
- **管理员功能** - 支持管理员登录和内容管理

### 🎨 现代化界面
- **响应式设计** - 完美适配桌面和移动设备
- **暗色主题** - 护眼的暗色主题设计
- **流畅动画** - 精心设计的过渡动画和交互效果
- **无障碍支持** - 遵循Web无障碍设计标准

### 🔧 技术特性
- **内容缓存** - 智能缓存机制，避免重复抓取
- **PDF增强处理** - 专门的PDF提取器，支持各种PDF格式
- **反爬虫对策** - 多重策略绕过网站反爬虫机制
- **会话管理** - 完整的用户会话和权限管理
- **自动清理** - 定时清理无效文件和数据

## 🚀 快速开始

### 环境要求

- **Node.js** 18.0+ 
- **npm** 8.0+
- 至少一个AI模型的API密钥

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/benjamin1108/StreamWisdom.git
   cd StreamWisdom
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp env.example .env
   ```
   
   编辑 `.env` 文件，配置至少一个AI模型的API密钥：
   ```env
   # 推荐：xAI Grok 3 (最新，效果好)
   XAI_API_KEY=xai-your-api-key-here
   
   # 或者：Groq (速度快，免费额度)
   GROQ_API_KEY=gsk-your-groq-api-key-here
   
   # 或者：通义千问 (中文支持好)
   DASHSCOPE_API_KEY=sk-your-dashscope-api-key-here
   
   # 或者：OpenAI (经典选择)
   OPENAI_API_KEY=sk-your-openai-api-key-here
   
   # 可选：自定义端口
   PORT=8080
   
   # 可选：管理员账户
   admin=your-admin-username
   password=your-admin-password
   ```

4. **启动服务**
   ```bash
   # 生产环境
   npm start
   
   # 或开发环境（支持热重载）
   npm run dev
   ```

5. **访问应用**
   
   打开浏览器访问 `http://localhost:8080`

### Docker 部署

```bash
# 构建镜像
docker build -t stream-wisdom .

# 运行容器
docker run -d \
  --name stream-wisdom \
  -p 8080:8080 \
  -e XAI_API_KEY=your-api-key \
  stream-wisdom
```

## 📖 使用指南

### 基础使用

1. **粘贴链接** - 在输入框中粘贴要转化的网页或PDF链接
2. **选择模式** - 根据需求选择转化模式（推荐使用"自动识别"）
3. **开始转化** - 点击"开始转化"按钮，支持流式或标准模式
4. **查看结果** - 实时查看转化结果，支持复制、分享等操作

### 高级功能

#### 管理员功能
- 登录管理员账户后，可以删除历史记录
- 可以重新转化已存在的URL（绕过重复检测）
- 访问更多系统管理功能

#### 分享功能
- 每个转化结果都有独立的分享页面
- 支持一键复制分享链接
- 分享页面包含完整的转化信息和精美排版

#### 搜索和筛选
- 历史记录支持实时搜索
- 可按标题、URL、内容进行全文搜索
- 无限滚动，支持大量历史记录

## 🛠️ API 文档

### 核心API接口

#### 转化内容
```http
POST /api/transform
Content-Type: application/json

{
  "url": "https://example.com/article",
  "complexity": "default"
}
```

#### 流式转化
```http
POST /api/transform-stream
Content-Type: application/json

{
  "url": "https://example.com/article", 
  "complexity": "detailed"
}
```

#### 获取历史记录
```http
GET /api/transformations?offset=0&limit=20&search=keyword
```

#### 获取转化内容
```http
GET /api/transformations/:uuid
```

#### 分享页面
```http
GET /share/:uuid
```

### 复杂度模式说明

- `default` - 自动识别：根据内容自动选择最适合的处理方式
- `concise` - 简化提炼：生成简洁的要点总结
- `detailed` - 结构优先：保持原文结构，适合学术内容
- `key_points` - 核心要点：提取关键信息点

## 🏗️ 技术架构

### 后端架构
```
src/server/
├── server.js          # 主服务器文件
├── lib/
│   ├── modelManager.js # AI模型管理
│   ├── pdfExtractor.js # PDF提取器
│   ├── database.js     # 数据库管理
│   ├── fileCleanup.js  # 文件清理
│   └── urlUtils.js     # URL工具
```

### 前端架构
```
public/
├── index.html          # 主页面
├── modules/
│   ├── stream-wisdom.js        # 主应用逻辑
│   ├── transformationsHistory.js # 历史管理
│   ├── services/       # API服务
│   ├── utils/          # 工具函数
│   └── ui/             # UI组件
```

### 技术栈

**后端**
- Node.js + Express.js
- SQLite3 数据库
- axios + cheerio (网页抓取)
- pdf-parse (PDF处理) 
- express-session (会话管理)

**前端**
- 原生 JavaScript (ES6+)
- Tailwind CSS (样式)
- Marked.js (Markdown渲染)
- Font Awesome (图标)

**AI模型集成**
- 支持多种API格式
- 智能模型选择和降级
- 统一的调用接口

## 📋 依赖列表

### 生产依赖
```json
{
  "axios": "^1.6.0",           // HTTP客户端
  "cheerio": "^1.0.0-rc.12",   // HTML解析
  "cors": "^2.8.5",            // 跨域支持
  "dotenv": "^16.3.1",         // 环境变量
  "express": "^4.18.2",        // Web框架
  "express-session": "^1.18.1", // 会话管理
  "pdf-parse": "^1.1.1",       // PDF解析
  "sqlite3": "^5.1.7",         // 数据库
  "uuid": "^11.1.0"            // UUID生成
}
```

### 开发依赖
```json
{
  "nodemon": "^3.0.1"          // 开发热重载
}
```

## 🤝 贡献指南

我们欢迎各种形式的贡献！

### 如何贡献

1. **Fork 项目**
2. **创建功能分支** (`git checkout -b feature/AmazingFeature`)
3. **提交更改** (`git commit -m 'Add some AmazingFeature'`)
4. **推送到分支** (`git push origin feature/AmazingFeature`)
5. **提交 Pull Request**

### 贡献类型

- 🐛 **Bug 修复** - 报告或修复发现的问题
- ✨ **新功能** - 提议或实现新的功能特性
- 📝 **文档** - 改进文档或添加示例
- 🎨 **UI/UX** - 界面和用户体验改进
- ⚡ **性能** - 性能优化和改进
- 🔧 **配置** - 配置文件和构建脚本改进

### 开发环境设置

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 代码规范检查
npm run lint
```

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE) - 详情请查看 LICENSE 文件。

## 🙏 致谢

感谢以下项目和服务：

- [OpenAI](https://openai.com/) - GPT模型支持
- [xAI](https://x.ai/) - Grok模型支持  
- [Groq](https://groq.com/) - 高速推理服务
- [阿里云](https://www.aliyun.com/) - 通义千问模型
- [Tailwind CSS](https://tailwindcss.com/) - 样式框架
- [Express.js](https://expressjs.com/) - Web框架

## 📞 联系方式

- **项目地址**: [https://github.com/benjamin1108/StreamWisdom](https://github.com/benjamin1108/StreamWisdom)
- **问题报告**: [GitHub Issues](https://github.com/benjamin1108/StreamWisdom/issues)
- **功能请求**: [GitHub Issues](https://github.com/benjamin1108/StreamWisdom/issues)

---

<div align="center">

**悟流 / Stream of Wisdom** - 让知识如水流淌 💧

Made with ❤️ by [benjamin1108](https://github.com/benjamin1108)

</div>
