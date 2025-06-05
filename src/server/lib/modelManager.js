const axios = require('axios');

class ModelManager {
    constructor() {
        this.models = {
            'grok3-mini': {
                name: 'Grok 3 Mini',
                apiUrl: 'https://api.x.ai/v1/chat/completions',
                model: 'grok-3-mini',
                maxTokens: 9999,
                temperature: 0.7,
                timeout: 30000,
                headers: (apiKey) => ({
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }),
                supportStream: true
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
                }),
                supportStream: true
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
                        top_p: 0.8,
                        incremental_output: true
                    }
                }),
                formatResponse: (response) => {
                    return response.data.output.text;
                },
                supportStream: true
            },
            'qwen-max': {
                name: '通义千问Max',
                apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                model: 'qwen-max-latest',
                maxTokens: 8192,
                temperature: 0.7,
                timeout: 30000000,
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
                        top_p: 0.8,
                        incremental_output: true
                    }
                }),
                formatResponse: (response) => {
                    return response.data.output.text;
                },
                supportStream: true
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
                }),
                supportStream: true
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

        console.log(`\n🔄 开始调用 ${config.name} API`);
        console.log(`📍 模型ID: ${modelId}`);
        console.log(`🔑 API密钥: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);

        const startTime = Date.now();

        try {
            let requestData;
            
            // 如果有自定义请求格式器，使用它
            if (config.formatRequest) {
                requestData = config.formatRequest(messages, params);
                console.log(`📤 使用自定义请求格式 (${modelId})`);
            } else {
                // 使用标准OpenAI格式
                requestData = {
                    model: params.model,
                    messages: messages,
                    max_tokens: params.maxTokens,
                    temperature: params.temperature
                };
                console.log(`📤 使用标准OpenAI格式`);
            }

            // 检查是否支持流式输出
            const useStream = config.supportStream && !customParams.disableStream;
            if (useStream) {
                console.log(`🌊 启用流式输出模式`);
                // 为支持流式输出的模型添加stream参数
                if (config.formatRequest) {
                    // 对于自定义格式（如qwen），添加stream参数
                    requestData.parameters = {
                        ...requestData.parameters,
                        stream: true
                    };
                } else {
                    // 对于标准格式，添加stream参数
                    requestData.stream = true;
                }
                
                return await this.callModelWithStream(config, requestData, apiKey, startTime);
            } else {
                return await this.callModelWithoutStream(config, requestData, apiKey, startTime);
            }
        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.error(`\n❌ ${config.name} API调用失败! 耗时: ${duration}ms`);
            console.error(`🔍 错误类型: ${error.name || 'Unknown'}`);
            console.error(`💬 错误消息: ${error.message}`);
            console.error(`📍 错误代码: ${error.code || 'N/A'}`);
            
            if (error.response) {
                console.error(`📊 HTTP状态码: ${error.response.status} ${error.response.statusText}`);
                console.error(`📋 错误响应Headers:`, JSON.stringify(error.response.headers, null, 2));
                console.error(`📥 错误响应体:`, JSON.stringify(error.response.data, null, 2));
            } else if (error.request) {
                console.error(`📡 请求已发送但无响应`);
                console.error(`🔗 请求详情:`, {
                    url: config.apiUrl,
                    method: 'POST',
                    timeout: config.timeout
                });
            } else {
                console.error(`⚙️  请求配置错误:`, error.message);
            }
            
            if (error.response?.status === 401) {
                throw new Error(`${config.name} API密钥无效`);
            } else if (error.response?.status === 429) {
                throw new Error(`${config.name} API调用频率限制，请稍后重试`);
            } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                throw new Error(`无法连接到${config.name}服务`);
            } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error(`${config.name} 请求超时 (${config.timeout}ms)，请检查网络连接或稍后重试`);
            } else {
                throw new Error(`${config.name} 服务暂时不可用: ${error.message}`);
            }
        }
    }

    // 流式调用方法
    async callModelWithStream(config, requestData, apiKey, startTime) {
        // 打印请求详情
        console.log(`🌐 请求URL: ${config.apiUrl}`);
        console.log(`📋 请求Headers:`, JSON.stringify(config.headers(apiKey), null, 2));
        console.log(`📝 请求体:`, JSON.stringify(requestData, null, 2));
        console.log(`⏱️  超时设置: ${config.timeout}ms`);
        console.log(`🚀 发送流式请求... (${new Date().toISOString()})`);

        return new Promise((resolve, reject) => {
            const https = require('https');
            const url = require('url');
            
            const parsedUrl = url.parse(config.apiUrl);
            const postData = JSON.stringify(requestData);
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.path,
                method: 'POST',
                headers: {
                    ...config.headers(apiKey),
                    'Content-Length': Buffer.byteLength(postData),
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache'
                },
                timeout: config.timeout
            };

            const req = https.request(options, (res) => {
                console.log(`\n📊 流式响应状态码: ${res.statusCode} ${res.statusMessage}`);
                
                if (res.statusCode !== 200) {
                    let errorData = '';
                    res.on('data', chunk => errorData += chunk);
                    res.on('end', () => {
                        console.error(`📥 错误响应: ${errorData}`);
                        reject(new Error(`HTTP ${res.statusCode}: ${errorData}`));
                    });
                    return;
                }

                let fullResponse = '';
                let buffer = '';
                
                console.log(`\n🌊 开始接收流式数据:`);
                console.log(`📖 实时输出: `);

                res.on('data', (chunk) => {
                    const chunkStr = chunk.toString();
                    // console.log(`\n🔍 接收到原始数据块: "${chunkStr.substring(0, 100)}..."`);
                    
                    buffer += chunkStr;
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // 保留最后一个可能不完整的行

                    for (const line of lines) {
                        if (line.trim() === '') continue;
                        
                        // 通义千问的特殊SSE格式处理
                        if (line.startsWith('data:')) {
                            const data = line.slice(5).trim(); // 去掉 "data:" 前缀
                            
                            if (data === '[DONE]') {
                                const endTime = Date.now();
                                const duration = endTime - startTime;
                                console.log(`\n\n✅ 流式响应完成! 耗时: ${duration}ms`);
                                console.log(`✨ 完整响应长度: ${fullResponse.length} 字符`);
                                resolve(fullResponse);
                                return;
                            }
                            
                            try {
                                const parsed = JSON.parse(data);
                                
                                // 处理通义千问的响应格式
                                if (parsed.output && parsed.output.text !== undefined) {
                                    const newText = parsed.output.text;
                                    
                                    // 检查是否结束
                                    if (parsed.output.finish_reason === 'stop') {
                                        const endTime = Date.now();
                                        const duration = endTime - startTime;
                                        console.log(`\n\n✅ 流式响应完成! 耗时: ${duration}ms`);
                                        console.log(`✨ 完整响应长度: ${fullResponse.length} 字符`);
                                        resolve(fullResponse);
                                        return;
                                    }
                                    
                                    // 实时输出新增内容
                                    if (newText && newText.length > 0) {
                                        process.stdout.write(newText); // 直接输出当前文本片段
                                        fullResponse += newText;
                                    }
                                }
                                // 处理其他格式的流式响应 (OpenAI格式)
                                else if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                                    const newPart = parsed.choices[0].delta.content;
                                    process.stdout.write(newPart);
                                    fullResponse += newPart;
                                }
                            } catch (parseError) {
                                console.error(`\n⚠️  解析流式数据失败: ${data.substring(0, 100)}, 错误: ${parseError.message}`);
                            }
                        }
                        // 处理其他SSE字段 (id, event等)
                        else if (line.startsWith('id:') || line.startsWith('event:') || line.startsWith(':')) {
                            // 这些是SSE元数据，可以忽略或记录
                            continue;
                        }
                    }
                });

                res.on('end', () => {
                    if (fullResponse) {
                        const endTime = Date.now();
                        const duration = endTime - startTime;
                        console.log(`\n\n✅ 流式响应完成! 耗时: ${duration}ms`);
                        console.log(`✨ 完整响应长度: ${fullResponse.length} 字符`);
                        resolve(fullResponse);
                    } else {
                        reject(new Error('流式响应未收到有效数据'));
                    }
                });

                res.on('error', (error) => {
                    console.error(`\n❌ 流式响应错误: ${error.message}`);
                    reject(error);
                });
            });

            req.on('error', (error) => {
                console.error(`\n❌ 请求错误: ${error.message}`);
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`请求超时 (${config.timeout}ms)`));
            });

            req.write(postData);
            req.end();
        });
    }

    // 非流式调用方法（保持原有逻辑）
    async callModelWithoutStream(config, requestData, apiKey, startTime) {
        // 打印请求详情
        console.log(`🌐 请求URL: ${config.apiUrl}`);
        console.log(`📋 请求Headers:`, JSON.stringify(config.headers(apiKey), null, 2));
        console.log(`📝 请求体:`, JSON.stringify(requestData, null, 2));
        console.log(`⏱️  超时设置: ${config.timeout}ms`);
        console.log(`🚀 发送请求... (${new Date().toISOString()})`);

        const response = await axios.post(config.apiUrl, requestData, {
            headers: config.headers(apiKey),
            timeout: config.timeout
        });

        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`\n✅ API调用成功! 耗时: ${duration}ms`);
        console.log(`�� 响应状态码: ${response.status} ${response.statusText}`);
        console.log(`📋 响应Headers:`, JSON.stringify(response.headers, null, 2));
        
        // 打印原始响应（限制长度以避免日志过长）
        const rawResponse = JSON.stringify(response.data, null, 2);
        console.log(`📥 原始响应:`, rawResponse);

        // 如果有自定义响应格式器，使用它
        if (config.formatResponse) {
            console.log(`📤 使用自定义响应格式器`);
            const result = config.formatResponse(response);
            console.log(`✨ 解析后的结果长度: ${result.length} 字符`);
            console.log(`📖 结果预览: "${result.substring(0, 200)}${result.length > 200 ? '...' : ''}"`);
            return result;
        } else {
            console.log(`📤 使用标准OpenAI响应格式`);
            // 使用标准OpenAI格式
            const result = response.data.choices[0].message.content.trim();
            console.log(`✨ 解析后的结果长度: ${result.length} 字符`);
            console.log(`📖 结果预览: "${result.substring(0, 200)}${result.length > 200 ? '...' : ''}"`);
            return result;
        }
    }

    // 根据环境变量获取默认API密钥
    getDefaultApiKey(modelId) {
        const keyMappings = {
            'grok3-mini': process.env.XAI_API_KEY,
            'groq-llama3': process.env.GROQ_API_KEY,
            'qwen-turbo': process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY,
            'qwen-max': process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY,
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

    // 加载配置文件中指定的选择模型
    loadSelectedModel() {
        try {
            const configPath = require('path').join(__dirname, '..', 'config', 'models.json');
            const config = require(configPath);
            return config.selectedModel || null;
        } catch (error) {
            console.log('未找到指定的选择模型，将使用优先级选择');
            return null;
        }
    }

    // 智能选择最佳模型
    selectBestModel(apiKeys = {}) {
        // 首先尝试使用配置文件中明确指定的模型
        const selectedModel = this.loadSelectedModel();
        if (selectedModel) {
            const apiKey = apiKeys[selectedModel] || this.getDefaultApiKey(selectedModel);
            const isEnabled = this.isModelEnabled(selectedModel);
            if (apiKey && apiKey !== 'test_key' && this.isValidModel(selectedModel) && isEnabled) {
                console.log(`使用配置指定的模型: ${this.models[selectedModel]?.name || selectedModel}`);
                return selectedModel;
            } else {
                let reason = '';
                if (!apiKey || apiKey === 'test_key') reason = '无可用API密钥';
                else if (!this.isValidModel(selectedModel)) reason = '模型无效';
                else if (!isEnabled) reason = '模型未启用';
                console.log(`配置指定的模型 ${selectedModel} ${reason}，回退到优先级选择`);
            }
        }

        // 回退到原有的优先级选择机制
        const modelPriority = this.loadModelPriority();
        
        for (const modelId of modelPriority) {
            const apiKey = apiKeys[modelId] || this.getDefaultApiKey(modelId);
            const isEnabled = this.isModelEnabled(modelId);
            if (apiKey && apiKey !== 'test_key' && isEnabled) {
                console.log(`按优先级选择模型: ${this.models[modelId]?.name || modelId}`);
                return modelId;
            }
        }
        
        return modelPriority[0]; // 返回优先级最高的模型
    }

    // 检查模型是否启用
    isModelEnabled(modelId) {
        try {
            const configPath = require('path').join(__dirname, '..', 'config', 'models.json');
            const config = require(configPath);
            return config.settings?.[modelId]?.enabled !== false; // 默认为启用，除非明确设置为false
        } catch (error) {
            console.log('检查模型启用状态失败，默认为启用');
            return true;
        }
    }
}

module.exports = ModelManager; 