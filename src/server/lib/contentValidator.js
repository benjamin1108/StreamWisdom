/**
 * 内容校验工具
 * 使用AI模型判断提取的内容是否有意义，避免无意义内容进入转化流程
 */

const fs = require('fs').promises;
const path = require('path');
const configManager = require('./configManager');

class ContentValidator {
    constructor() {
        this.validationPrompt = null;
    }

    // 读取校验提示词
    async loadValidationPrompt() {
        if (this.validationPrompt) {
            return this.validationPrompt;
        }

        try {
            const promptPath = path.join(__dirname, '../../../prompts', 'content-validation-prompt.txt');
            this.validationPrompt = await fs.readFile(promptPath, 'utf-8');
            return this.validationPrompt.trim();
        } catch (error) {
            console.error('读取内容校验提示词文件失败:', error);
            // 使用简化的备用提示词
            this.validationPrompt = `你是内容质量检测专家。判断以下内容是否有价值且适合知识转化。

如果有价值，回答：有效
如果无价值，回答：无效：[原因]

待检测内容：
`;
            return this.validationPrompt;
        }
    }

    /**
     * 校验内容是否有意义
     * @param {Object} extractedData - 提取的内容数据
     * @param {Object} modelManager - 模型管理器实例
     * @returns {Promise<Object>} 校验结果 {isValid: boolean, reason?: string}
     */
    async validateContent(extractedData, modelManager = null) {
        try {
            // 基础校验
            const basicValidation = this.basicValidation(extractedData);
            if (!basicValidation.isValid) {
                return basicValidation;
            }

            // 检查是否启用AI校验
            const aiValidationEnabled = await configManager.isAiValidationEnabled();
            if (!aiValidationEnabled) {
                console.log('AI校验已禁用，跳过AI校验步骤');
                return {
                    isValid: true,
                    reason: 'AI校验已禁用，仅通过基础校验'
                };
            }

            // AI校验
            const aiValidation = await this.aiValidation(extractedData, modelManager);
            return aiValidation;

        } catch (error) {
            console.error('内容校验失败:', error);
            // 校验失败时默认通过，避免阻塞正常流程
            return {
                isValid: true,
                reason: '校验失败，默认通过',
                warning: error.message
            };
        }
    }

    /**
     * 基础校验（规则校验）
     * @param {Object} extractedData 
     * @returns {Object} 校验结果
     */
    basicValidation(extractedData) {
        const { content, title } = extractedData;

        // 检查内容长度
        if (!content || content.length < 50) {
            return {
                isValid: false,
                reason: '内容过短，不足50字符'
            };
        }

        // 检查是否是常见错误页面
        const errorPatterns = [
            /404.*not found/i,
            /403.*forbidden/i,
            /500.*internal server error/i,
            /502.*bad gateway/i,
            /503.*service unavailable/i,
            /504.*gateway timeout/i,
            /access denied/i,
            /page not found/i,
            /error.*occurred/i,
            /something went wrong/i,
            /网页不存在/i,
            /页面不存在/i,
            /访问被拒绝/i,
            /服务器错误/i,
            /系统错误/i,
            /出错了/i,
            /网络错误/i,
            /连接超时/i
        ];

        for (const pattern of errorPatterns) {
            if (pattern.test(content) || pattern.test(title || '')) {
                return {
                    isValid: false,
                    reason: '内容疑似错误页面'
                };
            }
        }

        // 检查是否是技术配置信息
        const techPatterns = [
            /nginx.*configuration/i,
            /apache.*configuration/i,
            /server.*configuration/i,
            /database.*error/i,
            /connection.*refused/i,
            /timeout.*error/i,
            /ssl.*certificate/i,
            /^<!DOCTYPE html>/,
            /<html[^>]*>/,
            /<head[^>]*>/,
            /<body[^>]*>/,
            /^{[\s\S]*}$/, // 纯JSON
            /^<\?xml/,     // XML文档
        ];

        for (const pattern of techPatterns) {
            if (pattern.test(content.substring(0, 1000))) {
                return {
                    isValid: false,
                    reason: '内容疑似技术配置或原始HTML'
                };
            }
        }

        // 检查内容是否主要由重复字符组成
        const uniqueChars = new Set(content.replace(/\s/g, ''));
        if (uniqueChars.size < 20 && content.length > 200) {
            return {
                isValid: false,
                reason: '内容字符单一，疑似无意义内容'
            };
        }

        return { isValid: true };
    }

    /**
     * AI校验
     * @param {Object} extractedData 
     * @param {Object} modelManager - 模型管理器实例
     * @returns {Promise<Object>} 校验结果
     */
    async aiValidation(extractedData, modelManager) {
        try {
            const { content } = extractedData;
            
            // 智能截取内容进行校验（从多个位置采样，避免只看开头）
            let contentSample = '';
            
            if (content.length <= 800) {
                // 内容较短，使用全部内容
                contentSample = content;
            } else if (content.length <= 2000) {
                // 中等长度，使用前800字符
                contentSample = content.substring(0, 800);
            } else {
                // 长内容，采用多段采样策略：开头 + 中段 + 结尾，自然连接
                const start = content.substring(0, 400);
                const middle = content.substring(Math.floor(content.length * 0.4), Math.floor(content.length * 0.4) + 400);
                const end = content.substring(Math.max(0, content.length - 200));
                
                // 自然连接，不添加明显的截断标记
                contentSample = start + '\n\n' + middle + '\n\n' + end;
            }

            // 加载校验提示词
            const basePrompt = await this.loadValidationPrompt();
            const fullPrompt = basePrompt + '\n\n' + contentSample;

            // 检查是否提供了modelManager实例
            if (!modelManager) {
                console.log('未提供modelManager实例，跳过AI校验');
                return { isValid: true, reason: '跳过AI校验' };
            }
            
            // 选择最佳模型进行校验
            const modelId = modelManager.selectBestModel();
            const apiKey = modelManager.getDefaultApiKey(modelId);

            if (!apiKey || apiKey === 'test_key') {
                console.log('无可用的API密钥，跳过AI校验');
                return { isValid: true, reason: '跳过AI校验' };
            }

            console.log(`使用模型 ${modelManager.getModelConfig(modelId).name} 进行内容校验`);

            const messages = [
                {
                    role: 'user',
                    content: fullPrompt
                }
            ];

            const response = await modelManager.callModel(modelId, messages, apiKey);
            
            // 解析AI响应
            const aiResponse = response.trim();
            console.log('AI校验响应:', aiResponse);

            if (aiResponse.includes('有效')) {
                return { isValid: true, reason: 'AI校验通过' };
            } else if (aiResponse.includes('无效')) {
                // 提取原因
                const reasonMatch = aiResponse.match(/无效[：:]\s*(.+)/);
                const reason = reasonMatch ? reasonMatch[1].trim() : 'AI判断内容无效';
                return { isValid: false, reason: `AI校验失败: ${reason}` };
            } else {
                // AI响应不明确，默认通过
                console.warn('AI校验响应不明确:', aiResponse);
                return { isValid: true, reason: 'AI校验响应不明确，默认通过' };
            }

        } catch (error) {
            console.error('AI校验失败:', error);
            // AI校验失败时默认通过
            return { isValid: true, reason: 'AI校验失败，默认通过', warning: error.message };
        }
    }

    /**
     * 快速校验（仅基础校验，不使用AI）
     * @param {Object} extractedData 
     * @returns {Object} 校验结果
     */
    quickValidate(extractedData) {
        return this.basicValidation(extractedData);
    }
}

module.exports = new ContentValidator(); 