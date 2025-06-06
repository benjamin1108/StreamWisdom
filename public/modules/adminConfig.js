// 管理员配置管理器
class AdminConfigManager {
    constructor() {
        this.originalConfig = null;
        this.currentConfig = null;
        this.init();
    }

    init() {
        this.bindEvents();
    }

    // 绑定事件
    bindEvents() {
        const closeBtn = document.getElementById('closeConfigPanel');
        const saveBtn = document.getElementById('saveConfigBtn');
        const cancelBtn = document.getElementById('cancelConfigBtn');
        const panel = document.getElementById('adminConfigPanel');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePanel());
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveConfig());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closePanel());
        }

        // 点击外部关闭面板
        if (panel) {
            panel.addEventListener('click', (e) => {
                if (e.target === panel) {
                    this.closePanel();
                }
            });
        }
    }

    // 显示配置面板
    async showConfigPanel() {
        try {
            // 加载当前配置
            await this.loadCurrentConfig();
            
            // 更新UI
            this.updateUI();
            
            // 显示面板
            const panel = document.getElementById('adminConfigPanel');
            if (panel) {
                panel.classList.remove('hidden');
            }
        } catch (error) {
            console.error('显示配置面板失败:', error);
            this.showStatus('加载配置失败: ' + error.message, 'error');
        }
    }

    // 关闭配置面板
    closePanel() {
        const panel = document.getElementById('adminConfigPanel');
        if (panel) {
            panel.classList.add('hidden');
        }
        // 清除状态
        this.hideStatus();
    }

    // 加载当前配置
    async loadCurrentConfig() {
        try {
            const response = await fetch('/api/config/ai-validation');
            if (!response.ok) {
                throw new Error('获取配置失败');
            }

            const config = await response.json();
            this.originalConfig = { ...config };
            this.currentConfig = { ...config };

            return config;
        } catch (error) {
            console.error('加载配置失败:', error);
            throw error;
        }
    }

    // 更新UI显示
    updateUI() {
        if (!this.currentConfig) return;

        // 更新AI校验开关
        const toggle = document.getElementById('aiValidationToggle');
        const description = document.getElementById('aiValidationDescription');

        if (toggle) {
            toggle.checked = this.currentConfig.enabled;
        }

        if (description) {
            description.textContent = this.currentConfig.description || 
                '使用AI模型判断提取的内容是否有意义，避免无意义内容进入转化流程';
        }
    }

    // 保存配置
    async saveConfig() {
        try {
            // 获取当前UI状态
            const toggle = document.getElementById('aiValidationToggle');
            const enabled = toggle ? toggle.checked : false;

            // 检查是否有变化
            if (enabled === this.originalConfig.enabled) {
                this.showStatus('配置未发生变化', 'info');
                return;
            }

            // 禁用保存按钮
            const saveBtn = document.getElementById('saveConfigBtn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = '保存中...';
            }

            // 发送更新请求
            const response = await fetch('/api/config/ai-validation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ enabled })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '保存失败');
            }

            // 更新本地配置
            this.originalConfig.enabled = enabled;
            this.currentConfig.enabled = enabled;

            this.showStatus(result.message || '配置保存成功', 'success');

            // 延迟关闭面板
            setTimeout(() => {
                this.closePanel();
            }, 1500);

        } catch (error) {
            console.error('保存配置失败:', error);
            this.showStatus('保存失败: ' + error.message, 'error');
        } finally {
            // 恢复保存按钮
            const saveBtn = document.getElementById('saveConfigBtn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '保存配置';
            }
        }
    }

    // 显示状态消息
    showStatus(message, type) {
        const statusDiv = document.getElementById('configStatus');
        if (!statusDiv) return;

        // 设置样式
        statusDiv.className = 'p-3 rounded-lg text-sm';
        
        switch (type) {
            case 'success':
                statusDiv.className += ' bg-green-600/20 text-green-400 border border-green-600/30';
                break;
            case 'error':
                statusDiv.className += ' bg-red-600/20 text-red-400 border border-red-600/30';
                break;
            case 'info':
                statusDiv.className += ' bg-blue-600/20 text-blue-400 border border-blue-600/30';
                break;
            default:
                statusDiv.className += ' bg-gray-600/20 text-gray-400 border border-gray-600/30';
        }

        statusDiv.textContent = message;
        statusDiv.classList.remove('hidden');

        // 3秒后自动隐藏（除非是错误信息）
        if (type !== 'error') {
            setTimeout(() => {
                this.hideStatus();
            }, 3000);
        }
    }

    // 隐藏状态消息
    hideStatus() {
        const statusDiv = document.getElementById('configStatus');
        if (statusDiv) {
            statusDiv.classList.add('hidden');
        }
    }

    // 获取当前AI校验配置状态
    async getAiValidationStatus() {
        try {
            const response = await fetch('/api/config/ai-validation');
            if (response.ok) {
                const config = await response.json();
                return config.enabled;
            }
        } catch (error) {
            console.error('获取AI校验状态失败:', error);
        }
        return null;
    }
}

// 全局实例
const adminConfigManager = new AdminConfigManager();

// 暴露给全局作用域
window.adminConfigManager = adminConfigManager; 