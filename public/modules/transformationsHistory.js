// 转化历史管理器
class TransformationsHistory {
    constructor() {
        this.offset = 0;
        this.limit = 20;
        this.searchQuery = '';
        this.transformations = [];
        this.isLoading = false;
        this.hasMore = true;
        this.isAdmin = false; // 管理员状态
        this.scrollContainer = null;
    }

    // 获取转化历史列表
    async loadTransformations(search = '', reset = false) {
        if (this.isLoading || (!this.hasMore && !reset)) return;
        
        this.isLoading = true;
        
        // 如果是重置（搜索或刷新），清空数据
        if (reset || search !== this.searchQuery) {
            this.transformations = [];
            this.offset = 0;
            this.hasMore = true;
            this.searchQuery = search;
        }
        
        try {
            const params = new URLSearchParams({
                offset: this.offset,
                limit: this.limit
            });
            
            if (this.searchQuery) {
                params.append('search', this.searchQuery);
            }
            
            const response = await fetch(`/api/transformations?${params}`);
            const result = await response.json();
            
            if (result.success) {
                const newTransformations = result.data;
                
                // 追加新数据
                this.transformations = [...this.transformations, ...newTransformations];
                
                // 更新分页状态
                this.offset += newTransformations.length;
                this.hasMore = newTransformations.length === this.limit;
                this.isAdmin = result.isAdmin || false;
                
                // 渲染列表
                this.renderTransformationsList(result.pagination, reset);
            } else {
                throw new Error(result.error || '获取转化历史失败');
            }
        } catch (error) {
            console.error('加载转化历史失败:', error);
            this.showError('加载转化历史失败: ' + error.message);
        } finally {
            this.isLoading = false;
        }
    }

    // 渲染转化历史列表
    renderTransformationsList(pagination, reset = false) {
        const container = document.getElementById('transformationsHistory');
        if (!container) return;

        if (reset || !this.scrollContainer) {
            // 初始化或重置时，重新创建整个列表
            const listHtml = `
                <div class="h-full flex flex-col">
                    <div class="flex items-center justify-between mb-2 gap-2">
                        <h3 class="text-lg font-semibold text-slate-200 flex items-center flex-shrink-0">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            转化历史 (${pagination?.total || this.transformations.length})
                        </h3>
                        <!-- 搜索框 -->
                        <div class="relative flex-1 mx-3">
                            <input type="text" 
                                   id="historySearchInput"
                                   placeholder="搜索..." 
                                   value="${this.searchQuery}"
                                   class="w-full px-2 py-1 pl-5 bg-slate-700 border border-slate-600 rounded text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-xs">
                            <svg class="absolute left-1.5 top-1.5 w-2.5 h-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                        <button onclick="transformationsHistory.loadTransformations('', true)" 
                                class="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors flex-shrink-0">
                            刷新
                        </button>
                    </div>
                    
                    <!-- 转化列表 - 无限滚动 -->
                    <div id="transformationsScrollContainer" class="space-y-1 overflow-y-auto scrollbar-thin flex-1">
                        <div id="transformationsList">
                            ${this.transformations.map(item => this.renderTransformationItem(item)).join('')}
                            ${this.transformations.length === 0 ? this.renderEmptyState() : ''}
                        </div>
                        ${this.hasMore ? this.renderLoadingIndicator() : this.renderEndIndicator()}
                    </div>
                </div>
            `;
            
            container.innerHTML = listHtml;
            this.scrollContainer = document.getElementById('transformationsScrollContainer');
            this.setupScrollListener();
            this.setupSearchListener();
        } else {
            // 追加模式，只更新列表内容
            const listContainer = document.getElementById('transformationsList');
            if (listContainer && this.transformations.length > 0) {
                // 移除旧的加载指示器和结束指示器
                const oldIndicators = this.scrollContainer.querySelectorAll('.loading-indicator, .end-indicator');
                oldIndicators.forEach(indicator => indicator.remove());
                
                // 更新列表内容
                listContainer.innerHTML = this.transformations.map(item => this.renderTransformationItem(item)).join('');
                
                // 添加新的指示器
                const indicatorHtml = this.hasMore ? this.renderLoadingIndicator() : this.renderEndIndicator();
                this.scrollContainer.insertAdjacentHTML('beforeend', indicatorHtml);
            }
        }
    }

    // 设置滚动监听器
    setupScrollListener() {
        if (!this.scrollContainer) return;
        
        this.scrollContainer.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = this.scrollContainer;
            const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
            
            // 当滚动到85%时触发加载
            if (scrollPercentage > 0.85 && this.hasMore && !this.isLoading) {
                this.loadTransformations();
            }
        });
    }

    // 设置搜索监听器
    setupSearchListener() {
        const searchInput = document.getElementById('historySearchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.loadTransformations(e.target.value, true);
                }, 500);
            });
        }
    }

    // 渲染单个转化项目
    renderTransformationItem(item) {
        const createTime = new Date(item.created_at).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // 处理complexity显示，翻译为中文
        const complexityMap = {
            'default': '自动识别',
            'concise': '简化提炼',
            'detailed': '结构优先',
            'key_points': '核心要点',
            'beginner': '初学者',
            'intermediate': '中级',
            'advanced': '高级'
        };
        const complexityText = complexityMap[item.complexity] || item.complexity;
        
        return `
            <div class="bg-slate-700/50 rounded p-2 hover:bg-slate-700/70 transition-colors border border-slate-600/50 cursor-pointer" 
                 onclick="window.open('/share/${item.uuid}', '_blank')" 
                 title="点击查看详情">
                <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0 mr-2">
                        <div class="flex items-center justify-between mb-1">
                            <h4 class="text-slate-200 font-medium text-xs flex-1 truncate pr-2" title="${item.title}">${item.title}</h4>
                            <div class="flex items-center space-x-1 text-xs text-slate-400 flex-shrink-0">
                                <svg class="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span>${createTime}</span>
                            </div>
                        </div>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-1">
                                <span class="px-1 py-0.5 bg-blue-600/20 text-blue-400 rounded text-xs">${complexityText}</span>
                                ${item.image_count > 0 ? `<span class="px-1 py-0.5 bg-green-600/20 text-green-400 rounded text-xs">${item.image_count}图</span>` : ''}
                            </div>
                            <div class="flex items-center space-x-1">
                                <button onclick="event.stopPropagation(); transformationsHistory.shareTransformation('${item.uuid}')" 
                                        class="p-1 text-green-400 hover:text-green-300 hover:bg-green-600/20 rounded transition-colors flex-shrink-0" 
                                        title="分享链接">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                                    </svg>
                                </button>
                                ${this.isAdmin ? `
                                <button onclick="event.stopPropagation(); transformationsHistory.deleteTransformation('${item.uuid}')" 
                                        class="p-1 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded transition-colors flex-shrink-0" 
                                        title="删除记录（管理员）">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 渲染空状态
    renderEmptyState() {
        return `
            <div class="text-center py-4 text-slate-400">
                <svg class="w-8 h-8 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                </svg>
                <p class="text-base mb-2">没有转化记录</p>
                <p class="text-base mb-2">开始转化知识吧！</p>
            </div>
        `;
    }

    // 渲染加载指示器
    renderLoadingIndicator() {
        return `
            <div class="loading-indicator flex justify-center items-center py-4 text-slate-400">
                <svg class="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-xs">加载中...</span>
            </div>
        `;
    }

    // 渲染结束指示器
    renderEndIndicator() {
        if (this.transformations.length === 0) return '';
        
        return `
            <div class="end-indicator flex justify-center items-center py-4 text-slate-500">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-xs">已加载全部内容</span>
            </div>
        `;
    }

    // 查看转化内容
    async viewTransformation(uuid) {
        try {
            const response = await fetch(`/api/transformations/${uuid}`);
            const result = await response.json();
            
            if (result.success) {
                this.showTransformationModal(result.data);
            } else {
                throw new Error(result.error || '获取转化内容失败');
            }
        } catch (error) {
            console.error('查看转化内容失败:', error);
            this.showError('查看转化内容失败: ' + error.message);
        }
    }

    // 分享转化内容 - 直接复制到剪贴板
    async shareTransformation(uuid) {
        const shareUrl = `${window.location.origin}/share/${uuid}`;
        
        // 检查Clipboard API是否可用
        if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(shareUrl);
                this.showSuccess('分享链接已复制到剪贴板');
                return;
            } catch (error) {
                console.error('Clipboard API复制失败:', error);
                // 继续尝试降级方法
            }
        }
        
        // 降级处理：使用传统方式复制
        try {
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999px';
            textArea.style.top = '-999px';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                this.showSuccess('分享链接已复制到剪贴板');
            } else {
                throw new Error('execCommand复制失败');
            }
        } catch (fallbackError) {
            console.error('降级复制也失败:', fallbackError);
            // 最后的降级方案：显示可选择的文本
            this.showCopyFallbackDialog(shareUrl);
        }
    }

    // 显示复制降级对话框
    showCopyFallbackDialog(shareUrl) {
        const dialogHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="copyFallbackDialog">
                <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white">手动复制链接</h3>
                    </div>
                    
                    <div class="mb-4 text-gray-300">
                        <p class="mb-3">自动复制失败，请手动选择并复制下面的链接：</p>
                        <div class="bg-slate-700 border border-slate-600 rounded p-3">
                            <input type="text" value="${shareUrl}" readonly 
                                   class="w-full bg-transparent text-blue-300 text-sm focus:outline-none select-all" 
                                   id="fallbackUrlInput" onclick="this.select()">
                        </div>
                        <p class="text-xs text-slate-400 mt-2">点击上方文本框即可全选链接</p>
                    </div>
                    
                    <div class="flex space-x-3">
                        <button onclick="document.getElementById('fallbackUrlInput').select(); document.getElementById('copyFallbackDialog').remove();" 
                                class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                            选择并关闭
                        </button>
                        <button onclick="document.getElementById('copyFallbackDialog').remove();" 
                                class="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors">
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dialogHtml);
        
        // 自动选中输入框中的文本
        setTimeout(() => {
            const input = document.getElementById('fallbackUrlInput');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }

    // 删除转化内容（仅管理员）
    async deleteTransformation(uuid) {
        if (!this.isAdmin) {
            this.showError('需要管理员权限');
            return;
        }

        // 显示确认对话框
        const confirmed = await this.showDeleteConfirmation();
        if (!confirmed) {
            return;
        }
        
        try {
            const response = await fetch(`/api/transformations/${uuid}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (result.success) {
                this.showSuccess('删除成功');
                // 重新加载当前搜索结果
                this.loadTransformations(this.searchQuery, true);
            } else {
                throw new Error(result.error || '删除失败');
            }
        } catch (error) {
            console.error('删除转化内容失败:', error);
            this.showError('删除失败: ' + error.message);
        }
    }

    // 显示删除确认对话框
    showDeleteConfirmation() {
        return new Promise((resolve) => {
            const dialogHtml = `
                <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="deleteConfirmDialog">
                    <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center mr-3">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.598 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z">
                                    </path>
                                </svg>
                            </div>
                            <h3 class="text-lg font-semibold text-white">确认删除</h3>
                        </div>
                        
                        <div class="mb-6 text-gray-300">
                            <p>确定要删除这个转化记录吗？</p>
                            <p class="text-sm text-red-400 mt-2">此操作不可撤销！</p>
                        </div>
                        
                        <div class="flex space-x-3">
                            <button id="confirmDeleteBtn" 
                                    class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                                确认删除
                            </button>
                            <button id="cancelDeleteBtn" 
                                    class="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors">
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', dialogHtml);
            const dialog = document.getElementById('deleteConfirmDialog');
            const confirmBtn = document.getElementById('confirmDeleteBtn');
            const cancelBtn = document.getElementById('cancelDeleteBtn');

            confirmBtn.addEventListener('click', () => {
                dialog.remove();
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                dialog.remove();
                resolve(false);
            });

            // 点击外部关闭
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    dialog.remove();
                    resolve(false);
                }
            });

            // ESC键关闭
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    dialog.remove();
                    document.removeEventListener('keydown', handleEscape);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    }

    // 显示转化内容模态框
    showTransformationModal(transformation) {
        const modalHtml = `
            <div id="transformationModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                    <div class="flex items-center justify-between p-6 border-b border-slate-700">
                        <h3 class="text-xl font-semibold text-slate-200">${transformation.title}</h3>
                        <button onclick="this.closest('#transformationModal').remove()" 
                                class="text-slate-400 hover:text-slate-200 transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                        <div class="mb-4 text-sm text-slate-400 space-y-1">
                            <div>来源: <a href="${transformation.original_url}" target="_blank" class="text-blue-400 hover:underline">${transformation.original_url}</a></div>
                            <div>转化时间: ${new Date(transformation.created_at).toLocaleString('zh-CN')}</div>
                            <div>复杂度: ${transformation.complexity} | 风格: ${transformation.style}</div>
                        </div>
                        <div class="prose prose-invert max-w-none markdown-content">
                            ${transformation.transformed_content.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    <div class="flex justify-end space-x-3 p-6 border-t border-slate-700">
                        <button onclick="transformationsHistory.shareTransformation('${transformation.uuid}')" 
                                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            分享
                        </button>
                        <button onclick="this.closest('#transformationModal').remove()" 
                                class="px-4 py-2 bg-slate-600 text-slate-200 rounded-lg hover:bg-slate-500 transition-colors">
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }



    // 显示成功消息
    showSuccess(message) {
        this.showToast(message, 'success');
    }

    // 显示错误消息
    showError(message) {
        this.showToast(message, 'error');
    }

    // 显示Toast消息
    showToast(message, type = 'info') {
        const toastId = 'toast-' + Date.now();
        const bgColor = type === 'success' ? 'bg-green-600' : 
                       type === 'error' ? 'bg-red-600' : 'bg-blue-600';
        
        const toastHtml = `
            <div id="${toastId}" class="fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
                ${message}
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', toastHtml);
        
        setTimeout(() => {
            const toast = document.getElementById(toastId);
            if (toast) {
                toast.remove();
            }
        }, 3000);
    }
}

// 创建全局实例
window.transformationsHistory = new TransformationsHistory(); 