/**
 * 配置管理器
 * 统一管理环境变量和配置文件中的设置
 */

const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
    constructor() {
        this.config = null;
        this.modelsConfig = null;
        this.configPath = path.join(__dirname, '../../../config/models.json');
    }

    /**
     * 加载配置文件
     */
    async loadConfig() {
        if (this.config && this.modelsConfig) {
            return this.config;
        }

        try {
            // 读取模型配置文件
            const modelsConfigData = await fs.readFile(this.configPath, 'utf-8');
            this.modelsConfig = JSON.parse(modelsConfigData);

            // 合并环境变量和配置文件
            this.config = {
                // AI校验配置
                aiValidation: {
                    enabled: this.getAiValidationEnabled(),
                    description: this.modelsConfig.aiValidation?.description || '是否启用AI校验功能'
                },
                // 其他配置
                server: {
                    port: process.env.PORT || 8080,
                    cacheTtl: parseInt(process.env.CACHE_TTL) || 86400
                },
                models: this.modelsConfig
            };

            return this.config;
        } catch (error) {
            console.error('加载配置失败:', error);
            // 返回默认配置
            this.config = {
                aiValidation: {
                    enabled: true,
                    description: '默认启用AI校验功能'
                },
                server: {
                    port: process.env.PORT || 8080,
                    cacheTtl: 86400
                },
                models: null
            };
            return this.config;
        }
    }

    /**
     * 获取AI校验是否启用
     * 优先级：环境变量 > 配置文件 > 默认值
     */
    getAiValidationEnabled() {
        // 首先检查环境变量
        if (process.env.ENABLE_AI_VALIDATION !== undefined) {
            return process.env.ENABLE_AI_VALIDATION.toLowerCase() === 'true';
        }

        // 然后检查配置文件
        if (this.modelsConfig?.aiValidation?.enabled !== undefined) {
            return this.modelsConfig.aiValidation.enabled;
        }

        // 默认启用
        return true;
    }

    /**
     * 是否启用AI校验
     */
    async isAiValidationEnabled() {
        await this.loadConfig();
        return this.config.aiValidation.enabled;
    }

    /**
     * 获取服务器配置
     */
    async getServerConfig() {
        await this.loadConfig();
        return this.config.server;
    }

    /**
     * 获取模型配置
     */
    async getModelsConfig() {
        await this.loadConfig();
        return this.config.models;
    }

    /**
     * 重新加载配置
     */
    async reloadConfig() {
        this.config = null;
        this.modelsConfig = null;
        return await this.loadConfig();
    }

    /**
     * 更新AI校验配置（写入配置文件）
     */
    async updateAiValidationConfig(enabled) {
        try {
            await this.loadConfig();
            
            if (this.modelsConfig) {
                this.modelsConfig.aiValidation = {
                    ...this.modelsConfig.aiValidation,
                    enabled: enabled
                };

                await fs.writeFile(this.configPath, JSON.stringify(this.modelsConfig, null, 2), 'utf-8');
                
                // 重新加载配置
                await this.reloadConfig();
                
                console.log(`AI校验配置已更新: ${enabled ? '启用' : '禁用'}`);
                return true;
            }
        } catch (error) {
            console.error('更新AI校验配置失败:', error);
            return false;
        }
    }
}

// 导出单例实例
const configManager = new ConfigManager();
module.exports = configManager; 