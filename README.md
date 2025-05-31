# 悟流 / Stream of Wisdom

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-v16+-green.svg)

将URL内容转化为简洁、生动的文本，如种子在心智中生根，而非沉重砖块。

## 🌟 项目愿景

打造轻量、开源、社区驱动的平台，让用户轻松理解复杂知识。通过AI技术将冗长、抽象的URL内容转化为高可读性的文本，提升理解效率和情感共鸣。

## ✨ 主要特性

- 🔗 **URL内容提取**: 智能提取网页核心内容
- 🤖 **多模型支持**: 支持Grok3、Groq、通义千问、OpenAI等多种AI模型
- 🎯 **智能选择**: 服务端根据配置自动选择最佳可用模型
- 🎨 **个性化定制**: 支持不同转化风格和复杂程度
- 💾 **智能缓存**: 减少重复API调用，提升响应速度
- 📱 **响应式设计**: 支持各种设备访问
- 🔓 **开源免费**: MIT协议，社区驱动

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/username/StreamOfWisdom.git
   cd StreamOfWisdom
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp env.example .env
   ```
   
   编辑 `.env` 文件，配置你的API密钥（至少配置一个）：
   ```env
   # 推荐：xAI Grok 3 API (最新最强)
   XAI_API_KEY=xai-your-api-key-here
   
   # Groq API (免费且快速)
   GROQ_API_KEY=gsk-your-groq-api-key-here
   
   # 通义千问API
   QWEN_API_KEY=sk-your-qwen-api-key-here
   
   # OpenAI API (兜底)
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```

4. **启动服务**
   ```bash
   # 开发模式
   npm run dev
   
   # 生产模式
   npm start
   ```

5. **访问应用**
   
   打开浏览器访问：http://localhost:3000

## 🔧 支持的AI模型

项目内置了多种AI模型的适配器，支持：

### 🚀 xAI Grok 3 (推荐)
- **模型**: Grok 3 Mini
- **优势**: 最新技术，理解能力强，响应快速
- **配置**: `XAI_API_KEY=xai-your-key`
- **获取**: https://x.ai/api

### ⚡ Groq
- **模型**: Llama3-70B
- **优势**: 推理速度快，免费额度高
- **配置**: `GROQ_API_KEY=gsk-your-key`
- **获取**: https://console.groq.com/keys

### 🇨🇳 通义千问
- **模型**: Qwen-Turbo / Qwen-Max
- **优势**: 中文理解能力强
- **配置**: `QWEN_API_KEY=sk-your-key`
- **获取**: https://dashscope.aliyuncs.com/

### 🔥 OpenAI
- **模型**: GPT-4o-mini
- **优势**: 性能稳定，质量高
- **配置**: `OPENAI_API_KEY=sk-your-key`
- **获取**: https://platform.openai.com/account/api-keys

### 🎯 智能选择
系统会根据配置的API密钥自动选择最佳模型，优先级：
`Grok 3 > Groq > 通义千问 > OpenAI`

可通过 `config/models.json` 配置文件调整模型优先级和启用状态。

## 📖 使用指南

### 基本使用

1. 在输入框中粘贴任意URL链接
2. 选择转化风格（叙事故事/技术总结）
3. 选择复杂程度（初学者/中级）
4. 点击"转化"按钮（系统自动选择最佳AI模型）
5. 查看转化结果，可以编辑、复制或分享

### 转化风格说明

- **叙事故事**: 使用生动的比喻和场景描述，更有情感共鸣
- **技术总结**: 保持专业性的同时增强可读性，适合技术内容

### 复杂程度说明

- **初学者**: 使用简单易懂的语言，避免专业术语
- **中级**: 可以包含一些专业术语，适合有基础的读者

## 🏗️ 项目结构

```
StreamOfWisdom/
├── public/                 # 前端静态文件
│   ├── index.html         # 主页面
│   └── app.js             # 前端逻辑
├── lib/                   # 核心库文件
│   └── modelManager.js    # 模型管理器
├── config/                # 配置文件
│   └── models.json        # 模型配置和优先级
├── prompts/               # 提示词文件
│   └── transform-prompt.txt
├── server.js              # 后端服务器
├── package.json           # 项目配置
├── env.example            # 环境变量示例
└── README.md              # 项目文档
```

## 🛠️ 技术栈

- **前端**: Vanilla JavaScript + Tailwind CSS
- **后端**: Node.js + Express
- **AI服务**: OpenAI兼容API
- **内容提取**: Cheerio + Axios
- **部署**: 支持各种云平台

## 🤝 贡献指南

我们欢迎社区贡献！你可以通过以下方式参与：

### 提示词优化

1. Fork 本项目
2. 修改 `prompts/transform-prompt.txt`
3. 提交 Pull Request
4. 描述你的改进理由

### 功能开发

1. 查看 Issues 中的功能需求
2. Fork 并创建特性分支
3. 开发并测试功能
4. 提交 Pull Request

### 问题反馈

- 通过 GitHub Issues 报告Bug
- 提出功能建议
- 分享使用体验

## 📄 开源协议

本项目采用 [MIT 协议](LICENSE)，允许自由使用、修改和分发。

## 🙏 致谢

感谢所有为项目做出贡献的开发者和社区成员。

---

**让知识如种子般在心智中生根发芽** 🌱 