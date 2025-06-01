# 悟流 - 模型配置指南

## 概述

悟流支持多种AI模型，您可以通过配置文件主动选择使用的模型，而无需依赖默认的优先级自动选择。

## 支持的模型

| 模型ID | 模型名称 | 描述 | 特点 |
|--------|---------|------|------|
| `grok3-mini` | xAI Grok 3 Mini | 快速响应，理解能力强 | 新一代AI，推理能力出色 |
| `groq-llama3` | Groq Llama3 | 推理速度快，免费额度高 | 开源模型，速度极快 |
| `qwen-turbo` | 通义千问Turbo | 中文理解优秀，成本较低 | 中文优化，性价比高 |
| `openai-gpt4` | OpenAI GPT-4 | 性能稳定，质量保证 | 业界标杆，质量可靠 |
| `qwen-max` | 通义千问Max | 最强性能，成本较高 | 顶级性能，适合复杂任务 |

## 配置方法

### 方法一：使用切换脚本（推荐）

```bash
# 查看当前配置
node scripts/switch-model.js --current

# 查看所有可用模型
node scripts/switch-model.js --list

# 切换到指定模型
node scripts/switch-model.js qwen-turbo
node scripts/switch-model.js grok3-mini
node scripts/switch-model.js openai-gpt4
```

### 方法二：直接编辑配置文件

编辑 `config/models.json` 文件中的 `selectedModel` 字段：

```json
{
  "selectedModel": "qwen-turbo",
  "priority": [...],
  "settings": {...}
}
```

## 工作机制

1. **主动选择优先**：系统首先检查 `selectedModel` 字段指定的模型
2. **验证可用性**：确认该模型有有效的API密钥且模型配置正确
3. **自动回退**：如果指定模型不可用，按 `priority` 数组的顺序选择备用模型
4. **智能兜底**：确保始终有可用的模型处理请求

## 配置验证

### 查看当前生效的模型

```bash
# 方法1：使用API接口
curl http://localhost:8080/api/models

# 方法2：使用命令行
node -e "
const ModelManager = require('./lib/modelManager');
const mm = new ModelManager();
console.log('配置选择:', mm.loadSelectedModel());
console.log('实际使用:', mm.selectBestModel());
"
```

### 服务器日志

启动服务器时会在控制台显示：
- `使用配置指定的模型: [模型名称]` - 成功使用指定模型
- `配置指定的模型 [模型ID] 无可用API密钥或无效，回退到优先级选择` - 回退到备用模型
- `按优先级选择模型: [模型名称]` - 使用优先级选择

## 最佳实践

1. **选择合适的模型**：
   - 日常使用推荐 `qwen-turbo`（中文优秀，成本低）
   - 追求速度选择 `groq-llama3`（免费额度高）
   - 要求质量选择 `openai-gpt4`（稳定可靠）
   - 复杂任务选择 `grok3-mini` 或 `qwen-max`

2. **备用策略**：即使主动选择了模型，也建议配置好 `priority` 数组作为备用

3. **API密钥管理**：确保选择的模型在 `.env` 文件中配置了相应的API密钥

   **通义千问模型的API密钥配置：**
   - 推荐使用：`DASHSCOPE_API_KEY=sk-your-api-key`（官方推荐）
   - 兼容配置：`QWEN_API_KEY=sk-your-api-key`（向后兼容）
   
   系统会优先使用 `DASHSCOPE_API_KEY`，如果没有设置则使用 `QWEN_API_KEY`。

4. **重启生效**：修改配置后需要重启服务器才能生效

## 故障排除

### 常见问题

1. **配置不生效**
   - 检查JSON格式是否正确
   - 确认 `selectedModel` 字段的模型ID拼写正确
   - 重启服务器

2. **模型调用失败**
   - 检查对应的API密钥是否配置
   - 验证API密钥是否有效
   - 查看服务器日志了解具体错误

3. **自动回退到其他模型**
   - 检查指定模型的API密钥状态
   - 确认模型ID是否正确
   - 查看控制台日志了解回退原因

### 调试命令

```bash
# 测试模型配置
node scripts/switch-model.js --current

# 查看模型状态
curl http://localhost:8080/api/models | jq .

# 检查API密钥
grep "API_KEY" .env
```

## 更新记录

- **v1.0.0**：实现基于配置文件的主动模型选择
- 支持通过 `selectedModel` 字段指定模型
- 提供命令行切换工具
- 增加模型状态查询API 