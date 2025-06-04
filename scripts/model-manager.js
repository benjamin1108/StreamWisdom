#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const ModelManager = require('../lib/modelManager');
const axios = require('axios');

class ModelManagerCLI {
    constructor() {
        this.modelManager = new ModelManager();
        this.configPath = path.join(__dirname, '..', 'config', 'models.json');
    }

    // 显示帮助信息
    showHelp() {
        console.log(`
🔧 StreamWisdom 模型管理工具

用法:
  node scripts/model-manager.js [命令] [选项]

命令:
  status, st          显示当前模型状态
  list, ls           列出所有可用模型
  switch <model-id>   切换到指定模型
  current, cur       显示当前使用的模型
  test <model-id>    测试指定模型的连接
  help, -h, --help   显示帮助信息

示例:
  node scripts/model-manager.js status
  node scripts/model-manager.js list
  node scripts/model-manager.js switch qwen-turbo
  node scripts/model-manager.js test grok3-mini

可用的模型ID:
  grok3-mini      xAI Grok 3 Mini
  groq-llama3     Groq Llama3
  qwen-turbo      通义千问Turbo
  qwen-max        通义千问Max
  openai-gpt4     OpenAI GPT-4
`);
    }

    // 加载配置文件
    loadConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        } catch (error) {
            console.error('❌ 无法读取配置文件:', error.message);
            process.exit(1);
        }
    }

    // 保存配置文件
    saveConfig(config) {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
            console.log('✅ 配置已保存');
        } catch (error) {
            console.error('❌ 无法保存配置文件:', error.message);
            process.exit(1);
        }
    }

    // 显示模型状态
    async showStatus() {
        console.log('\n🔍 模型状态概览\n');
        
        const config = this.loadConfig();
        const selectedModel = config.selectedModel;
        const currentModel = this.modelManager.selectBestModel();
        
        console.log(`📌 选择的模型: ${selectedModel || '未指定'}`);
        console.log(`⚡ 当前使用: ${currentModel}`);
        
        if (selectedModel !== currentModel) {
            console.log(`⚠️  注意: 选择的模型不可用，已自动切换\n`);
        } else if (selectedModel === currentModel) {
            console.log(`✅ 正在使用您选择的模型\n`);
        } else {
            console.log(`🤖 使用自动选择的模型\n`);
        }

        // 检查服务器状态
        try {
            const response = await axios.get('http://localhost:8080/api/models', { timeout: 3000 });
            const data = response.data;
            
            console.log('🌐 服务器状态: ✅ 运行中');
            console.log(`📊 实时状态: ${data.selectionInfo?.message || '正常'}`);
            
            if (data.selectionInfo?.type === 'fallback') {
                console.log(`💡 建议: 配置 ${data.selectionInfo.reason === '缺少API密钥' ? 'API密钥' : '相关设置'}`);
            }
        } catch (error) {
            console.log('🌐 服务器状态: ❌ 未运行');
        }
        
        console.log('');
    }

    // 列出所有模型
    listModels() {
        console.log('\n📋 可用模型列表\n');
        
        const models = this.modelManager.getAvailableModels();
        const selectedModel = this.modelManager.loadSelectedModel();
        const currentModel = this.modelManager.selectBestModel();
        
        models.forEach(model => {
            const apiKey = this.modelManager.getDefaultApiKey(model.id);
            const hasKey = !!(apiKey && apiKey !== 'test_key');
            const isEnabled = this.modelManager.isModelEnabled(model.id);
            
            let status = '';
            let icon = '';
            
            if (model.id === currentModel) {
                icon = '🟢';
                status = '当前使用';
            } else if (model.id === selectedModel) {
                icon = '🔵';
                status = '已选择';
            } else if (hasKey && isEnabled) {
                icon = '⚪';
                status = '可用';
            } else {
                icon = '⚫';
                status = !hasKey ? '缺少密钥' : '已禁用';
            }
            
            console.log(`  ${icon} ${model.id.padEnd(12)} ${model.name.padEnd(20)} ${status}`);
        });
        
        console.log('\n图例: 🟢=当前使用 🔵=已选择 ⚪=可用 ⚫=不可用\n');
    }

    // 切换模型
    switchModel(modelId) {
        if (!modelId) {
            console.error('❌ 请指定模型ID');
            console.log('💡 使用 "node scripts/model-manager.js list" 查看可用模型');
            return;
        }

        if (!this.modelManager.isValidModel(modelId)) {
            console.error(`❌ 无效的模型ID: ${modelId}`);
            this.listModels();
            return;
        }

        const config = this.loadConfig();
        const oldModel = config.selectedModel;
        
        config.selectedModel = modelId;
        this.saveConfig(config);
        
        const modelName = this.modelManager.getModelConfig(modelId).name;
        console.log(`\n✅ 已切换到模型: ${modelName} (${modelId})`);
        
        if (oldModel && oldModel !== modelId) {
            const oldModelName = this.modelManager.getModelConfig(oldModel).name;
            console.log(`📝 之前使用: ${oldModelName} (${oldModel})`);
        }

        // 检查API密钥
        const apiKey = this.modelManager.getDefaultApiKey(modelId);
        if (!apiKey || apiKey === 'test_key') {
            console.log(`⚠️  注意: ${modelName} 缺少API密钥`);
            
            const keyName = {
                'grok3-mini': 'XAI_API_KEY',
                'groq-llama3': 'GROQ_API_KEY',
                'qwen-turbo': 'DASHSCOPE_API_KEY',
                'qwen-max': 'DASHSCOPE_API_KEY',
                'openai-gpt4': 'OPENAI_API_KEY'
            }[modelId];
            
            console.log(`💡 请在 .env 文件中配置: ${keyName}=your-api-key-here`);
        } else {
            console.log(`✅ API密钥: 已配置`);
        }
        
        console.log('🔄 重启服务器以使配置生效\n');
    }

    // 显示当前模型
    showCurrent() {
        const selectedModel = this.modelManager.loadSelectedModel();
        const currentModel = this.modelManager.selectBestModel();
        
        console.log('\n📍 当前模型信息\n');
        
        if (selectedModel) {
            const selectedConfig = this.modelManager.getModelConfig(selectedModel);
            console.log(`📌 配置选择: ${selectedConfig.name} (${selectedModel})`);
        } else {
            console.log('📌 配置选择: 未指定 (自动选择)');
        }
        
        const currentConfig = this.modelManager.getModelConfig(currentModel);
        console.log(`⚡ 实际使用: ${currentConfig.name} (${currentModel})`);
        
        if (selectedModel && selectedModel !== currentModel) {
            const apiKey = this.modelManager.getDefaultApiKey(selectedModel);
            const reason = (!apiKey || apiKey === 'test_key') ? '缺少API密钥' : '其他原因';
            console.log(`⚠️  状态: 选择的模型不可用 (${reason})，已自动回退`);
        } else if (selectedModel === currentModel) {
            console.log('✅ 状态: 正在使用选择的模型');
        } else {
            console.log('🤖 状态: 使用优先级自动选择');
        }
        
        console.log('');
    }

    // 测试模型连接
    async testModel(modelId) {
        if (!modelId) {
            console.error('❌ 请指定要测试的模型ID');
            return;
        }

        if (!this.modelManager.isValidModel(modelId)) {
            console.error(`❌ 无效的模型ID: ${modelId}`);
            return;
        }

        const config = this.modelManager.getModelConfig(modelId);
        const apiKey = this.modelManager.getDefaultApiKey(modelId);
        
        console.log(`\n🧪 测试模型: ${config.name} (${modelId})\n`);
        
        if (!apiKey || apiKey === 'test_key') {
            console.log('❌ 测试失败: 缺少API密钥');
            return;
        }
        
        console.log('🔗 正在测试连接...');
        
        try {
            const testMessages = [{ role: 'user', content: '你好，这是一个连接测试。请简单回复"测试成功"。' }];
            const result = await this.modelManager.callModel(modelId, testMessages, apiKey, { disableStream: true });
            
            console.log('✅ 测试成功!');
            console.log(`📝 回复: ${result.substring(0, 100)}${result.length > 100 ? '...' : ''}`);
        } catch (error) {
            console.log('❌ 测试失败:', error.message);
        }
        
        console.log('');
    }

    // 主入口
    async run() {
        const args = process.argv.slice(2);
        
        if (args.length === 0 || args[0] === 'help' || args[0] === '-h' || args[0] === '--help') {
            this.showHelp();
            return;
        }

        const command = args[0];
        const param = args[1];

        switch (command) {
            case 'status':
            case 'st':
                await this.showStatus();
                break;
                
            case 'list':
            case 'ls':
                this.listModels();
                break;
                
            case 'switch':
                this.switchModel(param);
                break;
                
            case 'current':
            case 'cur':
                this.showCurrent();
                break;
                
            case 'test':
                await this.testModel(param);
                break;
                
            default:
                console.error(`❌ 未知命令: ${command}`);
                this.showHelp();
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const cli = new ModelManagerCLI();
    cli.run().catch(console.error);
}

module.exports = ModelManagerCLI; 