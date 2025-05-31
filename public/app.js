class StreamWisdom {
    constructor() {
        this.isTransformed = false;
        this.currentUrl = '';
        this.init();
    }

    init() {
        this.bindEvents();
        this.initMarkdown();
    }

    initMarkdown() {
        // 配置marked.js
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false
            });
        }
    }

    bindEvents() {
        const transformBtn = document.getElementById('transformBtn');
        const urlInput = document.getElementById('urlInput');

        // 转化按钮事件
        if (transformBtn) {
            transformBtn.addEventListener('click', () => this.handleTransform());
        }
        
        // 回车键提交
        if (urlInput) {
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleTransform();
                }
            });
        }
    }

    async handleTransform() {
        const urlInput = document.getElementById('urlInput');
        const styleSelect = document.getElementById('styleSelect');
        const complexitySelect = document.getElementById('complexitySelect');
        
        if (!urlInput || !styleSelect || !complexitySelect) {
            this.showError('页面组件加载不完整，请刷新页面重试');
            return;
        }
        
        const url = urlInput.value.trim();
        const style = styleSelect.value;
        const complexity = complexitySelect.value;

        if (!url) {
            this.showError('请输入有效的URL地址');
            urlInput.focus();
            return;
        }

        if (!this.isValidUrl(url)) {
            this.showError('请输入正确的URL格式');
            urlInput.focus();
            return;
        }

        this.currentUrl = url;

        this.transformToCompactLayout();
        this.hideInputCard();
        this.showLoading();

        try {
            const response = await fetch('/api/transform', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: this.currentUrl,
                    style: style,
                    complexity: complexity
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.hideLoading();
                this.renderResultWindow(data.result, data.model, data.imageCount, data.originalLength, data.transformedLength);
                this.updateModelStatus(data.model);
                console.log(`转化完成 - 原文: ${data.originalLength} 字符, 转化后: ${data.transformedLength} 字符`);
                if (data.imageCount > 0) {
                    console.log(`文章包含 ${data.imageCount} 张图片，已处理图片信息`);
                }
            } else {
                this.hideLoading();
                this.showError(data.error || '转化失败，请稍后重试');
            }
        } catch (error) {
            console.error('Transform error:', error);
            this.hideLoading();
            this.showError('网络错误，请检查连接后重试');
        }
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    transformToCompactLayout() {
        if (this.isTransformed) return;
        
        const mainContainer = document.getElementById('mainContainer');
        const compactHeader = document.getElementById('compactHeader');
        const mainFooter = document.getElementById('mainFooter');

        if (!mainContainer || !compactHeader) return;

        // 显示紧凑型页头
        if (compactHeader) {
            compactHeader.classList.remove('hidden');
            compactHeader.classList.add('flex', 'fade-in');
        }

        // 隐藏底部（带动画）
        if (mainFooter) {
            mainFooter.classList.add('transition-opacity', 'duration-500', 'ease-out', 'opacity-0');
            setTimeout(() => {
                if (mainFooter) mainFooter.style.display = 'none';
            }, 500); 
        }
        
        // 调整主容器布局，但保持输入框可见（用于显示加载动画）
        mainContainer.className = 'compact-layout transition-all duration-500 ease-out pt-20 sm:pt-24'; 

        this.isTransformed = true;
    }

    hideInputCard() {
        const inputCard = document.getElementById('inputCard');
        if (inputCard) {
            // 立即隐藏输入框，不需要动画
            inputCard.style.display = 'none';
        }
    }

    showLoading() {
        const loadingContainer = document.getElementById('loadingContainer');
        
        if (loadingContainer) {
            const loadingMessages = [
                '正在获取网页内容...',
                '分析文档结构...',
                '提取核心信息...',
                '生成转化内容...',
                '优化输出格式...'
            ];
            
            const loadingHtml = `
                <div class="loading-container">
                    <div class="loading-circle"></div>
                    <div class="loading-pulse">
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                    </div>
                    <h3 class="text-2xl font-semibold text-white mb-4 fade-in">智能转化中</h3>
                    <div class="text-center">
                        <p id="loadingMessage" class="text-slate-300 text-lg mb-2">${loadingMessages[0]}</p>
                        <div class="w-48 bg-slate-700 rounded-full h-1 mx-auto">
                            <div id="progressBar" class="bg-gradient-to-r from-blue-400 to-purple-500 h-1 rounded-full transition-all duration-1000 ease-out" style="width: 0%"></div>
                        </div>
                        <div class="mt-4 text-slate-400 text-sm">
                            <i class="fas fa-brain text-blue-400 mr-2"></i>
                            悟流正在为您精心转化内容
                        </div>
                    </div>
                </div>
            `;
            
            loadingContainer.querySelector('.glass-card').innerHTML = loadingHtml;
            loadingContainer.classList.remove('hidden');
            loadingContainer.classList.add('fade-in');
            
            // 模拟进度和消息更新
            this.startLoadingAnimation(loadingMessages);
        } else {
            console.error('Loading container not found.');
        }
    }
    
    startLoadingAnimation(messages) {
        let currentIndex = 0;
        const progressBar = document.getElementById('progressBar');
        const loadingMessage = document.getElementById('loadingMessage');
        
        const updateProgress = () => {
            if (currentIndex < messages.length) {
                if (loadingMessage) {
                    loadingMessage.style.opacity = '0';
                    setTimeout(() => {
                        if (loadingMessage) {
                            loadingMessage.textContent = messages[currentIndex];
                            loadingMessage.style.opacity = '1';
                        }
                    }, 200);
                }
                
                if (progressBar) {
                    const progress = ((currentIndex + 1) / messages.length) * 85; // 不到100%，留给实际完成
                    progressBar.style.width = `${progress}%`;
                }
                
                currentIndex++;
                
                if (currentIndex < messages.length) {
                    setTimeout(updateProgress, Math.random() * 1500 + 1000); // 1-2.5秒随机间隔
                }
            }
        };
        
        setTimeout(updateProgress, 500);
    }

    hideLoading() {
        const loadingContainer = document.getElementById('loadingContainer');
        const progressBar = document.getElementById('progressBar');

        // 完成进度条动画
        if (progressBar) {
            progressBar.style.width = '100%';
        }
        
        // 延迟隐藏，让用户看到完成状态
        setTimeout(() => {
            if (loadingContainer) {
                loadingContainer.classList.add('transition-opacity', 'duration-500', 'ease-out', 'opacity-0');
                setTimeout(() => {
                    loadingContainer.classList.add('hidden');
                    loadingContainer.classList.remove('fade-in', 'transition-opacity', 'duration-500', 'ease-out', 'opacity-0');
                    loadingContainer.querySelector('.glass-card').innerHTML = ''; // 清空加载内容
                }, 500);
            }
        }, 800);  // 让用户看到进度完成
    }

    renderResultWindow(content, modelUsed = null, imageCount = 0, originalLength = 0, transformedLength = 0) {
        const dynamicContainer = document.getElementById('dynamicContainer');
        if (!dynamicContainer) return;
        
        // 创建结果窗口HTML - 更美观的设计
        const resultHtml = `
            <div class="container mx-auto px-4 py-8 max-w-6xl">
                <div class="result-card rounded-3xl overflow-hidden float-up">
                    <!-- 工具栏 -->
                    <div class="toolbar p-4 flex flex-wrap justify-between items-center gap-4">
                        <div class="flex items-center gap-4">
                            <h2 class="text-xl font-bold text-white flex items-center gap-2">
                                <div class="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center">
                                    <i class="fas fa-sparkles text-sm"></i>
                                </div>
                                转化完成
                            </h2>
                            <div class="hidden sm:flex gap-2">
                                ${this.renderStatsBadges(modelUsed, imageCount, transformedLength, originalLength)}
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <button id="editBtn" class="toolbar-button px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                                <i class="fas fa-edit"></i>
                                <span class="hidden sm:inline">编辑</span>
                            </button>
                            <button id="shareBtn" class="toolbar-button px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                                <i class="fas fa-share"></i>
                                <span class="hidden sm:inline">分享</span>
                            </button>
                            <button id="copyBtn" class="toolbar-button px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                                <i class="fas fa-copy"></i>
                                <span class="hidden sm:inline">复制</span>
                            </button>
                            <button id="newTransformBtn" class="toolbar-button px-3 py-2 rounded-lg text-sm flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600">
                                <i class="fas fa-plus"></i>
                                <span class="hidden sm:inline">新转化</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- 移动端统计信息 -->
                    <div class="sm:hidden px-4 pb-4">
                        <div class="flex flex-wrap gap-2">
                            ${this.renderStatsBadges(modelUsed, imageCount, transformedLength, originalLength)}
                        </div>
                    </div>
                    
                    <!-- 结果内容区域 -->
                    <div class="content-area mx-4 mb-4">
                        <div id="resultContent" class="markdown-content">
                            ${this.renderMarkdown(content)}
                        </div>
                    </div>
                    
                    <!-- 底部操作区 -->
                    <div class="border-t border-slate-700 p-4 bg-slate-800 bg-opacity-50">
                        <div class="flex justify-between items-center text-sm text-slate-400">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-clock"></i>
                                <span>转化于 ${new Date().toLocaleString('zh-CN')}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span>悟流 AI</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 返回顶部按钮 -->
                <button id="backToTopBtn" class="fixed bottom-8 right-8 w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 opacity-0">
                    <i class="fas fa-arrow-up"></i>
                </button>
            </div>
        `;
        
        dynamicContainer.innerHTML = resultHtml;
        
        // 绑定操作按钮事件
        this.bindResultEvents();
        
        // 处理markdown中的图片
        this.styleMarkdownImages();
        
        // 显示返回顶部按钮
        this.initBackToTop();
        
        // 检查是否可能被截断
        if (transformedLength < 500) {
            this.showTemporaryMessage('注意：转化结果较短，可能存在截断问题', 'warning');
        } else {
            this.showTemporaryMessage('内容转化完成！', 'success');
        }
        
        // 添加进入动画
        setTimeout(() => {
            const resultCard = dynamicContainer.querySelector('.result-card');
            if (resultCard) {
                resultCard.classList.add('slide-up');
            }
        }, 100);
        
        // 平滑滚动到结果
        setTimeout(() => {
            dynamicContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }
    
    renderStatsBadges(modelUsed, imageCount, transformedLength, originalLength) {
        const badges = [];
        
        if (modelUsed) {
            badges.push(`<span class="stats-badge px-2 py-1 rounded-full text-xs flex items-center gap-1">
                <i class="fas fa-robot"></i>
                ${this.getModelDisplayName(modelUsed)}
            </span>`);
        }
        
        if (imageCount > 0) {
            badges.push(`<span class="stats-badge px-2 py-1 rounded-full text-xs flex items-center gap-1">
                <i class="fas fa-images"></i>
                ${imageCount}张图片
            </span>`);
        }
        
        if (transformedLength > 0) {
            badges.push(`<span class="stats-badge px-2 py-1 rounded-full text-xs flex items-center gap-1">
                <i class="fas fa-file-text"></i>
                ${transformedLength.toLocaleString()}字符
            </span>`);
        }
        
        if (originalLength > 0) {
            const compressionRatio = ((originalLength - transformedLength) / originalLength * 100).toFixed(1);
            if (compressionRatio > 0) {
                badges.push(`<span class="stats-badge px-2 py-1 rounded-full text-xs flex items-center gap-1">
                    <i class="fas fa-compress"></i>
                    精简${compressionRatio}%
                </span>`);
            }
        }
        
        return badges.join('');
    }
    
    initBackToTop() {
        const backToTopBtn = document.getElementById('backToTopBtn');
        if (!backToTopBtn) return;
        
        // 滚动显示/隐藏按钮
        const toggleButton = () => {
            if (window.scrollY > 300) {
                backToTopBtn.style.opacity = '1';
                backToTopBtn.style.pointerEvents = 'auto';
            } else {
                backToTopBtn.style.opacity = '0';
                backToTopBtn.style.pointerEvents = 'none';
            }
        };
        
        window.addEventListener('scroll', toggleButton);
        
        // 点击返回顶部
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    bindResultEvents() {
        const editBtn = document.getElementById('editBtn');
        const shareBtn = document.getElementById('shareBtn');
        const copyBtn = document.getElementById('copyBtn');
        const newTransformBtn = document.getElementById('newTransformBtn');

        if (editBtn) editBtn.addEventListener('click', () => this.toggleEdit());
        if (shareBtn) shareBtn.addEventListener('click', () => this.handleShare());
        if (copyBtn) copyBtn.addEventListener('click', () => this.handleCopy());
        if (newTransformBtn) newTransformBtn.addEventListener('click', () => this.startNewTransform());
    }
    
    startNewTransform() {
        // 清空动态容器
        const dynamicContainer = document.getElementById('dynamicContainer');
        if (dynamicContainer) {
            dynamicContainer.innerHTML = '';
        }
        
        // 重置状态
        this.isTransformed = false;
        this.currentUrl = '';
        
        // 恢复原始布局
        this.restoreOriginalLayout();
        
        // 清空URL输入框
        const urlInput = document.getElementById('urlInput');
        if (urlInput) {
            urlInput.value = '';
            urlInput.focus();
        }
        
        // 平滑滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    restoreOriginalLayout() {
        const mainContainer = document.getElementById('mainContainer');
        const compactHeader = document.getElementById('compactHeader');
        const mainFooter = document.getElementById('mainFooter');
        const inputCard = document.getElementById('inputCard');

        // 隐藏紧凑型页头
        if (compactHeader) {
            compactHeader.classList.add('hidden');
            compactHeader.classList.remove('flex', 'fade-in');
        }

        // 显示底部
        if (mainFooter) {
            mainFooter.style.display = 'block';
            mainFooter.classList.remove('transition-opacity', 'duration-500', 'ease-out', 'opacity-0');
            mainFooter.classList.add('fade-in');
        }
        
        // 恢复主容器布局
        mainContainer.className = 'center-layout transition-all duration-500 ease-out';
        
        // 恢复输入卡片显示
        if (inputCard) {
            inputCard.style.display = 'block';
            inputCard.className = 'glass-card rounded-3xl p-8 sm:p-12 max-w-2xl w-full mx-4 relative';
            // 添加进入动画
            inputCard.classList.add('scale-in');
        }
    }

    getStatsText(modelUsed, imageCount, transformedLength) {
        let stats = [];
        if (modelUsed) stats.push(`${this.getModelDisplayName(modelUsed)}`);
        if (imageCount > 0) stats.push(`${imageCount}张图片`);
        if (transformedLength > 0) stats.push(`${transformedLength}字符`);
        return stats.join(' · ');
    }

    renderMarkdown(content) {
        if (typeof marked !== 'undefined') {
            return marked.parse(content);
        } else {
            // 降级处理：简单的文本格式化
            return this.formatContent(content);
        }
    }

    formatContent(content) {
        // 简单的文本格式化
        return content
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    styleMarkdownImages() {
        const images = document.querySelectorAll('#resultContent img');
        images.forEach(img => {
            img.className = 'max-w-full h-auto rounded-xl shadow-xl my-6 border border-slate-600';
            img.style.display = 'block';
            img.style.margin = '2rem auto';
            
            // 添加加载错误处理
            img.onerror = function() {
                this.style.display = 'none';
                const placeholder = document.createElement('div');
                placeholder.className = 'bg-slate-700 text-slate-400 p-6 rounded-xl text-center my-6 border border-slate-600';
                placeholder.innerHTML = `<i class="fas fa-image mr-2 text-2xl"></i><br><span class="text-sm mt-2 block">图片加载失败: ${this.alt || '无描述'}</span>`;
                this.parentNode.insertBefore(placeholder, this.nextSibling);
            };
        });
    }

    getModelDisplayName(modelId) {
        const modelNames = {
            'grok3-mini': 'Grok 3 Mini',
            'groq-llama3': 'Groq Llama3',
            'qwen-turbo': '通义千问Turbo',
            'qwen-max': '通义千问Max',
            'openai-gpt4': 'OpenAI GPT-4'
        };
        return modelNames[modelId] || modelId;
    }

    updateModelStatus(modelId) {
        const currentModelElement = document.getElementById('currentModel');
        if (currentModelElement && modelId) {
            const modelName = this.getModelDisplayName(modelId);
            currentModelElement.textContent = `当前模型: ${modelName}`;
        }
    }

    toggleEdit() {
        const resultContent = document.getElementById('resultContent');
        const editBtn = document.getElementById('editBtn');
        
        if (!resultContent || !editBtn) return;

        if (resultContent.contentEditable === 'true') {
            // 退出编辑模式
            resultContent.contentEditable = 'false';
            resultContent.classList.remove('border-2', 'border-blue-400', 'outline-none', 'p-4', 'bg-slate-800'); // 移除编辑时的额外样式
            resultContent.classList.add('p-6', 'sm:p-12'); // 恢复原来的padding
            editBtn.innerHTML = '<i class="fas fa-edit"></i>编辑';
            editBtn.classList.remove('bg-green-500', 'border-green-500', 'hover:bg-green-600'); // 移除"完成"状态的样式
            editBtn.classList.add('cyber-input', 'text-slate-200', 'hover:text-white', 'hover:border-[var(--accent-color)]'); // 恢复原始按钮样式
        } else {
            // 进入编辑模式
            resultContent.contentEditable = 'true';
            resultContent.classList.remove('p-6', 'sm:p-12'); // 移除原来的padding
            resultContent.classList.add('border-2', 'border-blue-400', 'outline-none', 'p-4', 'bg-slate-800', 'rounded-lg'); // 添加编辑时的样式，如内边距和背景
            resultContent.focus();
            editBtn.innerHTML = '<i class="fas fa-check-circle"></i>完成编辑';
            // 更新按钮样式为"完成"状态，例如更醒目的颜色
            editBtn.classList.remove('cyber-input', 'text-slate-200', 'hover:text-white', 'hover:border-[var(--accent-color)]');
            editBtn.classList.add('bg-green-500', 'border-green-500', 'text-white', 'hover:bg-green-600');
        }
    }

    async handleShare() {
        const resultContent = document.getElementById('resultContent');
        const content = resultContent.textContent || resultContent.innerText;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: '悟流 - 知识转化结果',
                    text: content,
                    url: window.location.href
                });
            } catch (error) {
                console.log('分享取消或失败:', error);
            }
        } else {
            // 备用分享方式：复制到剪贴板
            this.copyToClipboard(content);
            this.showTemporaryMessage('内容已复制到剪贴板，可以分享给他人');
        }
    }

    async handleCopy() {
        const resultContent = document.getElementById('resultContent');
        const content = resultContent.textContent || resultContent.innerText;
        
        if (await this.copyToClipboard(content)) {
            this.showTemporaryMessage('内容已复制到剪贴板');
        } else {
            this.showError('复制失败，请手动选择内容复制');
        }
    }

    async copyToClipboard(text) {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // 备用方案
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            }
        } catch (error) {
            console.error('复制失败:', error);
            return false;
        }
    }

    showError(message) {
        // 如果还没有转化过，显示临时提示消息
        if (!this.isTransformed) {
            this.showTemporaryMessage(`错误：${message}`, 'error');
            return;
        }
        
        // 在动态容器中显示错误
        const dynamicContainer = document.getElementById('dynamicContainer');
        if (!dynamicContainer) return;

        const errorHtml = `
            <div class="container mx-auto px-6 py-8 max-w-4xl relative">
                <div class="glass-card rounded-2xl p-8 border-l-4 border-red-500 fade-in">
                    <button id="closeErrorBtn" aria-label="关闭错误提示" class="absolute top-4 right-5 text-slate-500 hover:text-slate-200 transition-colors duration-150">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                    <div class="flex items-start mb-6">
                        <i class="fas fa-exclamation-triangle text-red-400 mr-4 text-3xl flex-shrink-0"></i>
                        <div>
                            <h3 class="text-white font-semibold text-xl mb-2">转化失败</h3>
                            <p class="text-slate-300 leading-relaxed">${message}</p>
                        </div>
                    </div>
                    
                    <!-- CTA 按钮区域 -->
                    <div class="flex flex-wrap gap-3 justify-center border-t border-slate-600 pt-6">
                        <button id="retryBtn" class="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2">
                            <i class="fas fa-redo"></i>
                            重新转化
                        </button>
                        <button id="backHomeBtn" class="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2">
                            <i class="fas fa-home"></i>
                            返回首页
                        </button>
                        <button id="reportErrorBtn" class="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2">
                            <i class="fas fa-bug"></i>
                            反馈问题
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        dynamicContainer.innerHTML = errorHtml;

        // 绑定CTA按钮事件
        const closeErrorBtn = document.getElementById('closeErrorBtn');
        const retryBtn = document.getElementById('retryBtn');
        const backHomeBtn = document.getElementById('backHomeBtn');
        const reportErrorBtn = document.getElementById('reportErrorBtn');

        if (closeErrorBtn) {
            closeErrorBtn.addEventListener('click', () => {
                dynamicContainer.innerHTML = ''; // 清除错误
            });
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                dynamicContainer.innerHTML = ''; // 清除错误
                this.handleTransform(); // 重新执行转化
            });
        }

        if (backHomeBtn) {
            backHomeBtn.addEventListener('click', () => {
                this.startNewTransform(); // 返回首页
            });
        }

        if (reportErrorBtn) {
            reportErrorBtn.addEventListener('click', () => {
                this.reportError(message); // 反馈问题
            });
        }
        
        // 移除原来的自动清除逻辑，或按需保留并调整时长
        // setTimeout(() => {
        //     if (dynamicContainer.innerHTML.includes('text-red-400')) { // 更可靠地检查是否还是那个错误
        //          dynamicContainer.innerHTML = '';
        //     }
        // }, 8000); 
    }

    showTemporaryMessage(message, type = 'success') {
        const messageDiv = document.createElement('div');
        const bgColors = {
            'success': 'bg-gradient-to-r from-green-500 to-emerald-600',
            'error': 'bg-gradient-to-r from-red-500 to-pink-600',
            'warning': 'bg-gradient-to-r from-yellow-500 to-orange-600',
            'info': 'bg-gradient-to-r from-blue-500 to-purple-600'
        };
        
        messageDiv.className = `fixed top-6 right-6 z-50 px-6 py-4 rounded-xl font-medium text-white transform transition-all duration-500 translate-x-full ${bgColors[type] || bgColors.info} shadow-2xl border border-white border-opacity-20 backdrop-blur-sm`;
        
        const icons = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-triangle',
            'warning': 'fas fa-exclamation-circle',
            'info': 'fas fa-info-circle'
        };
        
        messageDiv.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-6 h-6 flex items-center justify-center">
                    <i class="${icons[type] || icons.info}"></i>
                </div>
                <span class="text-sm font-medium">${message}</span>
                <button class="ml-2 text-white text-opacity-70 hover:text-opacity-100 transition-colors">
                    <i class="fas fa-times text-sm"></i>
                </button>
            </div>
        `;
        
        // 添加关闭按钮事件
        const closeBtn = messageDiv.querySelector('button');
        const hideMessage = () => {
            messageDiv.classList.add('translate-x-full');
            messageDiv.classList.remove('translate-x-0');
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 500);
        };
        
        closeBtn.addEventListener('click', hideMessage);
        
        document.body.appendChild(messageDiv);
        
        // 显示动画
        requestAnimationFrame(() => {
            messageDiv.classList.remove('translate-x-full');
            messageDiv.classList.add('translate-x-0', 'slide-in-right');
        });
        
        // 自动隐藏（错误消息显示更久）
        const autoHideDelay = type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000;
        setTimeout(hideMessage, autoHideDelay);
    }

    reportError(errorMessage) {
        // 创建错误报告邮件链接
        const subject = encodeURIComponent('悟流转化错误反馈');
        const body = encodeURIComponent(`
错误信息：${errorMessage}
URL：${this.currentUrl}
时间：${new Date().toLocaleString('zh-CN')}
浏览器：${navigator.userAgent}

请描述您遇到的具体问题：


        `);
        
        // 尝试使用不同的反馈方式
        if (navigator.clipboard) {
            // 复制错误信息到剪贴板
            const errorReport = `错误信息：${errorMessage}\nURL：${this.currentUrl}\n时间：${new Date().toLocaleString('zh-CN')}`;
            navigator.clipboard.writeText(errorReport).then(() => {
                this.showTemporaryMessage('错误信息已复制到剪贴板，您可以发送给我们', 'info');
            });
        } else {
            // 备用方案：显示错误信息
            this.showTemporaryMessage('请将以下错误信息发送给我们：' + errorMessage, 'info');
        }
        
        // 如果有GitHub仓库，可以打开Issues页面
        // window.open(`https://github.com/username/StreamOfWisdom/issues/new?title=${subject}&body=${body}`, '_blank');
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new StreamWisdom();
}); 