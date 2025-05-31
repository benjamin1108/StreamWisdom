const axios = require('axios');

class ModelManager {
    constructor() {
        this.models = {
            'grok3-mini': {
                name: 'Grok 3 Mini',
                apiUrl: 'https://api.x.ai/v1/chat/completions',
                model: 'grok-3',
                maxTokens: 9999,
                temperature: 0.7,
                timeout: 30000,
                headers: (apiKey) => ({
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                })
            },
            'groq-llama3': {
                name: 'Groq Llama3',
                apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
                model: 'llama3-70b-8192',
                maxTokens: 4000,
                temperature: 0.7,
                timeout: 30000,
                headers: (apiKey) => ({
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                })
            },
            'qwen-turbo': {
                name: '通义千问Turbo',
                apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                model: 'qwen-turbo',
                maxTokens: 4000,
                temperature: 0.7,
                timeout: 30000,
                headers: (apiKey) => ({
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }),
                formatRequest: (messages, params) => ({
                    model: params.model,
                    input: {
                        messages: messages
                    },
                    parameters: {
                        max_tokens: params.maxTokens,
                        temperature: params.temperature,
                        top_p: 0.8
                    }
                }),
                formatResponse: (response) => {
                    return response.data.output.choices[0].message.content;
                }
            },
            'qwen-max': {
                name: '通义千问Max',
                apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                model: 'qwen-max',
                maxTokens: 4000,
                temperature: 0.7,
                timeout: 30000,
                headers: (apiKey) => ({
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }),
                formatRequest: (messages, params) => ({
                    model: params.model,
                    input: {
                        messages: messages
                    },
                    parameters: {
                        max_tokens: params.maxTokens,
                        temperature: params.temperature,
                        top_p: 0.8
                    }
                }),
                formatResponse: (response) => {
                    return response.data.output.choices[0].message.content;
                }
            },
            'openai-gpt4': {
                name: 'OpenAI GPT-4',
                apiUrl: 'https://api.openai.com/v1/chat/completions',
                model: 'gpt-4o-mini',
                maxTokens: 4000,
                temperature: 0.7,
                timeout: 30000,
                headers: (apiKey) => ({
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                })
            }
        };
    }

    // 获取所有可用模型
    getAvailableModels() {
        return Object.keys(this.models).map(key => ({
            id: key,
            name: this.models[key].name,
            model: this.models[key].model
        }));
    }

    // 检查模型是否存在
    isValidModel(modelId) {
        return modelId in this.models;
    }

    // 获取模型配置
    getModelConfig(modelId) {
        if (!this.isValidModel(modelId)) {
            throw new Error(`不支持的模型: ${modelId}`);
        }
        return this.models[modelId];
    }

    // 调用模型API
    async callModel(modelId, messages, apiKey, customParams = {}) {
        const config = this.getModelConfig(modelId);
        
        if (!apiKey) {
            throw new Error(`${config.name} 需要API密钥`);
        }

        const params = {
            model: config.model,
            maxTokens: customParams.maxTokens || config.maxTokens,
            temperature: customParams.temperature || config.temperature,
            ...customParams
        };

        try {
            let requestData;
            
            // 如果有自定义请求格式器，使用它
            if (config.formatRequest) {
                requestData = config.formatRequest(messages, params);
            } else {
                // 使用标准OpenAI格式
                requestData = {
                    model: params.model,
                    messages: messages,
                    max_tokens: params.maxTokens,
                    temperature: params.temperature
                };
            }

            const response = await axios.post(config.apiUrl, requestData, {
                headers: config.headers(apiKey),
                timeout: config.timeout
            });

            // 如果有自定义响应格式器，使用它
            if (config.formatResponse) {
                const result = config.formatResponse(response);
                console.log(`${config.name} API响应长度: ${result.length} 字符`);
                return result;
            } else {
                // 使用标准OpenAI格式
                const result = response.data.choices[0].message.content.trim();
                console.log(`${config.name} API响应长度: ${result.length} 字符`);
                return result;
            }
        } catch (error) {
            console.error(`${config.name} API调用失败:`, error.response?.data || error.message);
            
            if (error.response?.status === 401) {
                throw new Error(`${config.name} API密钥无效`);
            } else if (error.response?.status === 429) {
                throw new Error(`${config.name} API调用频率限制，请稍后重试`);
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                throw new Error(`无法连接到${config.name}服务`);
            } else {
                throw new Error(`${config.name} 服务暂时不可用，请稍后重试`);
            }
        }
    }

    // 根据环境变量获取默认API密钥
    getDefaultApiKey(modelId) {
        const keyMappings = {
            'grok3-mini': process.env.XAI_API_KEY,
            'groq-llama3': process.env.GROQ_API_KEY,
            'qwen-turbo': process.env.QWEN_API_KEY,
            'qwen-max': process.env.QWEN_API_KEY,
            'openai-gpt4': process.env.OPENAI_API_KEY
        };
        
        return keyMappings[modelId] || process.env.OPENAI_API_KEY; // 兜底使用OPENAI_API_KEY
    }

    // 从配置文件加载模型优先级
    loadModelPriority() {
        try {
            const configPath = require('path').join(__dirname, '..', 'config', 'models.json');
            const config = require(configPath);
            return config.priority || ['grok3-mini', 'groq-llama3', 'qwen-turbo', 'openai-gpt4', 'qwen-max'];
        } catch (error) {
            console.log('使用默认模型优先级');
            return ['grok3-mini', 'groq-llama3', 'qwen-turbo', 'openai-gpt4', 'qwen-max'];
        }
    }

    // 智能选择最佳模型
    selectBestModel(apiKeys = {}) {
        const modelPriority = this.loadModelPriority();
        
        for (const modelId of modelPriority) {
            const apiKey = apiKeys[modelId] || this.getDefaultApiKey(modelId);
            if (apiKey && apiKey !== 'test_key') {
                console.log(`选择模型: ${this.models[modelId]?.name || modelId}`);
                return modelId;
            }
        }
        
        return modelPriority[0]; // 返回优先级最高的模型
    }
}

module.exports = ModelManager; 