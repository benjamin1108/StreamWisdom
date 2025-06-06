import {
    isValidUrl,
    renderMarkdown,
    styleMarkdownImages,
    getStatsText,
    copyToClipboard,
    generateErrorReportText
} from './utils/stream-utils.js';
import {
    fetchRegularTransform,
    fetchStreamTransform
} from './services/api-service.js';
import {
    displayTemporaryMessage,
    updateModelStatusDisplay,
    setViewVisibility,
    switchToCompactLayout,
    hideInputCard_UI,
    showInitialView,
    displayRegularLoading,
    hideMainLoadingIndicator,
    displayStreamLoading,
    updateStreamLoadingState,
    displayErrorView,
    displayRegularResultView,
    displayStreamResultLayout,
    appendContentToStreamView,
    finalizeStreamResultView,
    updateStreamViewForError
} from './ui/stream-wisdom-ui.js';

export default class StreamWisdom {
    constructor() {
        this.isTransformed = false;
        this.currentUrl = '';
        this.streamResultInitialized = false;
        this.streamContent = '';
        this.abortController = null;
        this.shareUrl = null; // 保存分享URL
        this.isAdmin = false; // 管理员状态

        this.streamUIElements = {};
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.initMarkdown();
        this.checkAdminStatus();
        this.addAdminLoginUI();
        this.initRouting();
    }

    initMarkdown() {
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

        if (transformBtn) {
            transformBtn.addEventListener('click', () => {
                console.log('转化按钮被点击');
                this.handleTransform();
            });
            console.log('转化按钮事件绑定成功');
        } else {
            console.error('未找到转化按钮 (transformBtn)');
        }
        
        if (urlInput) {
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    console.log('输入框回车键被按下');
                    this.handleTransform();
                }
            });
            console.log('URL输入框事件绑定成功');
        } else {
            console.error('未找到URL输入框 (urlInput)');
        }
    }

    async handleTransform() {
        console.log('handleTransform 方法被调用');
        
        const urlInput = document.getElementById('urlInput');
        const complexitySelect = document.getElementById('complexitySelect');
        const streamToggle = document.getElementById('streamToggle');
        
        console.log('DOM元素检查:', {
            urlInput: !!urlInput,
            complexitySelect: !!complexitySelect,
            streamToggle: !!streamToggle
        });
        
        if (!urlInput || !complexitySelect || !streamToggle) {
            console.error('页面组件加载不完整');
            this.showError('页面组件加载不完整，请刷新页面重试');
            return;
        }
        
        const url = urlInput.value.trim();
        const complexity = complexitySelect.value;
        const useStream = streamToggle.checked;
        
        console.log('转化参数:', { url, complexity, useStream });

        if (!url) {
            console.log('URL为空，显示错误消息');
            displayTemporaryMessage('请输入有效的URL地址', 'error');
            urlInput.focus();
            return;
        }

        if (!isValidUrl(url)) {
            console.log('URL格式无效，显示错误消息');
            displayTemporaryMessage('请输入正确的URL格式', 'error');
            urlInput.focus();
            return;
        }

        // 检查是否已存在相同URL的转化
        try {
            console.log('检查URL是否已存在转化...');
            const checkResult = await this.checkUrlExists(url);
            if (checkResult.exists) {
                console.log('发现已存在的转化，显示确认对话框');
                // 更新本地管理员状态
                this.isAdmin = checkResult.isAdmin;
                const confirmed = await this.showDuplicateConfirmation(checkResult.transformation, checkResult.isAdmin);
                if (!confirmed) {
                    console.log('用户选择不继续转化');
                    return; // 用户选择不继续
                }
                console.log('用户确认继续转化');
            }
        } catch (error) {
            console.warn('URL检查失败，继续执行转化:', error);
        }

        this.currentUrl = url;
        this.abortController = new AbortController();

        // 隐藏初始界面
        console.log('隐藏初始界面');
        setViewVisibility(false, false, false);

        if (useStream) {
            console.log('启动流式转化');
            this.handleStreamTransform(url, complexity, this.abortController.signal);
        } else {
            console.log('启动常规转化');
            this.handleRegularTransform(url, complexity, this.abortController.signal);
        }
    }

    async handleRegularTransform(url, complexity, signal) {
        const loadingMessages = [
            '正在获取网页内容...',
            '分析文档结构...',
            '提取核心信息...',
            '生成转化内容...',
            '优化输出格式...'
        ];
        displayRegularLoading(loadingMessages);

        try {
            const data = await fetchRegularTransform(url, complexity, signal);
            hideMainLoadingIndicator();
            
            // 保存分享URL和UUID
            if (data.shareUrl) {
                this.shareUrl = data.shareUrl;
            }
            if (data.uuid) {
                // 更新URL到结果页面，但不刷新页面
                this.updateUrlToResult(data.uuid);
            }
            
            const regularResultCallbacks = {
                onNewTransform: () => this.startNewTransform(),
                onEdit: () => this.toggleEdit(),
                onShare: () => this.handleShare(data.result, url),
                onCopy: () => this.handleCopy(data.result),
                onReportError: (content, errorUrl) => this.reportError(generateErrorReportText(content, errorUrl, 'regular_transform_report')),
                onBackToTop: () => {
                    const outputCardContent = document.querySelector('.result-content-area');
                    if (outputCardContent) outputCardContent.scrollTo({ top: 0, behavior: 'smooth' });
                }
            };
            
            displayRegularResultView(
                {
                    summary: data.result,
                    model: data.model,
                    stats: {
                        imageCount: data.imageCount,
                        originalLength: data.originalLength,
                        transformedLength: data.transformedLength
                    },
                    url: this.currentUrl
                },
                regularResultCallbacks
            );

            updateModelStatusDisplay(data.model);
            console.log(`转化完成 - 原文: ${data.originalLength} 字符, 转化后: ${data.transformedLength} 字符`);
            if (data.imageCount > 0) {
                console.log(`文章包含 ${data.imageCount} 张图片，已处理图片信息`);
            }
            
            // 刷新转化历史列表
            if (window.transformationsHistory) {
                setTimeout(() => {
                    transformationsHistory.loadTransformations('', true);
                }, 500);
            }
        } catch (error) {
            hideMainLoadingIndicator();
            this.showError(error.message || '转化失败，请稍后重试');
        }
    }

    handleStreamTransform(url, complexity, signal) {
        this.streamResultInitialized = false;
        this.streamContent = '';

        displayStreamLoading('初始化中...');

        fetchStreamTransform(
            url,
            complexity,
            (data) => {
                this.handleStreamMessage(data);
            },
            (errorMessage) => {
                this.handleStreamError(errorMessage);
            },
            () => {
                console.log('Stream transform processing completed by api-service.');
                if (this.streamResultInitialized && 
                    this.streamUIElements.streamResultContentElement && 
                    !this.streamUIElements.streamResultContentElement.querySelector('.error-message')) {
                    
                    const summarizeButton = document.getElementById('summarize-again-button-stream');
                    if (summarizeButton && summarizeButton.classList.contains('hidden')) {
                         console.warn('Stream ended without a final \'complete\' message. Finalizing UI with accumulated content.');
                    }
                }
            },
            signal
        ).catch(error => {
            if (error.name === 'AbortError') {
                console.log('Stream fetch aborted');
                if (!this.streamResultInitialized) {
                    hideMainLoadingIndicator();
                }
                this.handleStreamError('用户手动停止');
                return;
            }
            this.handleStreamError(error.message || '流式转化启动失败');
        });
    }

    handleStreamMessage(message) {
        switch (message.type) {
            case 'init':
                updateStreamLoadingState(message.message, 5);
                if (this.streamUIElements?.statusText) {
                    this.streamUIElements.statusText.textContent = message.message || '初始化...';
                }
                break;
                
            case 'progress':
                let progressTarget = 0;
                switch (message.stage) {
                    case 'fetching': progressTarget = 10; break;
                    case 'extracting': progressTarget = 25; break;
                    case 'extracted': progressTarget = 40; break;
                    case 'transforming': progressTarget = 60; break;
                    case 'model_selected': progressTarget = 75; break;
                    default: progressTarget = message.progress || 0;
                }
                updateStreamLoadingState(message.message, progressTarget);
                
                if (this.streamUIElements?.statusText) {
                    this.streamUIElements.statusText.textContent = message.message || '处理中...';
                }
                
                if (message.stage === 'model_selected' && message.data?.model) {
                    updateModelStatusDisplay(message.data.model);
                }
                break;
                
            case 'content_chunk':
                if (!this.streamResultInitialized) {
                    this.initStreamResultWindowInternal();
                }
                this.streamContent += message.chunk;
                
                if (this.streamUIElements.typingTextElement && this.streamUIElements.typingCursorElement) {
                    appendContentToStreamView(
                        this.streamUIElements.typingTextElement,
                        this.streamUIElements.typingCursorElement,
                        message.chunk, 
                        this.streamContent 
                    );
                    
                    if (this.streamUIElements.statusText) {
                        this.streamUIElements.statusText.textContent = '正在生成内容...';
                    }
                    if (this.streamUIElements.streamStatsDisplay) {
                        const charCount = this.streamContent.length;
                        this.streamUIElements.streamStatsDisplay.textContent = `已生成 ${charCount.toLocaleString()} 字符`;
                    }
                } else {
                    console.error("Stream UI elements (typingTextElement or typingCursorElement) not found in this.streamUIElements for content_chunk");
                }
                
                break;
                
            case 'complete':
                if (message.data && message.data.result && message.data.result !== this.streamContent) {
                     const finalChunk = message.data.result.substring(this.streamContent.length);
                     if (finalChunk && this.streamUIElements.typingTextElement && this.streamUIElements.typingCursorElement) {
                         this.streamContent = message.data.result;
                         appendContentToStreamView(
                             this.streamUIElements.typingTextElement,
                             this.streamUIElements.typingCursorElement,
                             finalChunk,
                             this.streamContent
                         );
                     } else {
                        this.streamContent = message.data.result;
                     }
                }
                this.completeStreamTransformInternal(message.data);
                break;
                
            case 'error':
                this.handleStreamError(message.error);
                break;
            default:
                console.warn('Unknown stream message type:', message.type);
        }
    }

    initStreamResultWindowInternal() {
        const streamViewCallbacks = {
            onNewTransform: () => this.startNewTransform(),
            onCopy: (content) => this.handleCopy(content || this.streamContent),
            onShare: (content, url) => this.handleShare(content || this.streamContent, url || this.currentUrl),
            onReportError: (content, url) => this.reportError(generateErrorReportText('流式转化问题', url || this.currentUrl, 'stream_transform_report'))
        };

        const uiElements = displayStreamResultLayout(streamViewCallbacks); 
        
        if (uiElements) {
            this.streamUIElements = uiElements;
        } else {
            console.error("displayStreamResultLayout did not return UI elements.");
            this.streamUIElements = {};
            return false;
        }

        if (!this.streamUIElements.typingTextElement || !this.streamUIElements.typingCursorElement) {
            console.error('Stream UI elements (typingTextElement or typingCursorElement) not found after displayStreamResultLayout. Check stream-wisdom-ui.js.');
        }

        this.streamResultInitialized = true;
        this.streamContent = '';
        return true;
    }

    completeStreamTransformInternal(data) {
        if (!this.streamResultInitialized) {
            if (!this.initStreamResultWindowInternal()) {
                console.error("Failed to initialize stream window for completeStreamTransformInternal");
                this.showError("无法完成流式结果显示：UI初始化失败。");
                return;
            }
        }

        if (data && data.result) {
            this.streamContent = data.result;
        }
        if (data && data.model) {
            updateModelStatusDisplay(data.model);
        }
        // 保存分享URL和UUID，更新URL
        if (data && data.shareUrl) {
            this.shareUrl = data.shareUrl;
        }
        if (data && data.uuid) {
            // 更新URL到结果页面，但不刷新页面
            this.updateUrlToResult(data.uuid);
        }

        const streamFinalizeCallbacks = {
            onNewTransform: () => this.startNewTransform(),
            onCopy: (content) => this.handleCopy(content || this.streamContent),
            onShare: (content, url) => this.handleShare(content || this.streamContent, url || this.currentUrl),
            onReportError: (content, url) => this.reportError(generateErrorReportText('流式转化问题', url || this.currentUrl, 'stream_transform_report')),
            dispatchArticleLoadedEvent: (content, wordCount, url) => {
                const event = new CustomEvent('articleLoaded', {
                    detail: {
                        content: content,
                        wordCount: wordCount,
                        url: url,
                        isStream: true
                    }
                });
                document.dispatchEvent(event);
            }
        };

        finalizeStreamResultView(this.streamUIElements, data, streamFinalizeCallbacks);
        
        console.log(`Stream transform complete. Final length: ${this.streamContent.length}`);
        
        // 刷新转化历史列表
        if (window.transformationsHistory) {
            setTimeout(() => {
                transformationsHistory.loadTransformations('', true);
            }, 500);
        }
    }

    handleStreamError(errorMessage) {
        console.error('Stream Error:', errorMessage);
        if (this.streamResultInitialized && this.streamUIElements.streamResultContentElement) {
            updateStreamViewForError(this.streamUIElements, errorMessage);
        } else {
            hideMainLoadingIndicator();
            this.showError(errorMessage);
        }
        this.streamResultInitialized = false;
    }

    showError(message) {
        const errorCallbacks = {
            onRetry: () => {
                if (this.currentUrl) {
                    const streamToggle = document.getElementById('streamToggle');
                    if (streamToggle && streamToggle.checked) {
                        this.handleStreamTransform(this.currentUrl, document.getElementById('complexitySelect').value, this.abortController.signal);
                    } else {
                        this.handleRegularTransform(this.currentUrl, document.getElementById('complexitySelect').value, this.abortController.signal);
                    }
                } else {
                    showInitialView();
                }
            },
            onBackHome: () => {
                this.startNewTransform(true);
            },
            onReport: () => this.reportError(generateErrorReportText(message, this.currentUrl, 'general_error_report'))
        };
        displayErrorView(message, errorCallbacks.onRetry, errorCallbacks.onBackHome, errorCallbacks.onReport);
    }

    startNewTransform(forceFullReset = false) {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.currentUrl = '';
        this.isTransformed = false;
        this.streamResultInitialized = false;
        this.streamContent = '';
        this.streamUIElements = {};
        this.shareUrl = null; // 重置分享URL

        const urlInput = document.getElementById('urlInput');
        if (urlInput) {
            urlInput.value = '';
        }
        
        // 如果当前不在主页，更新URL到主页
        if (window.location.pathname !== '/') {
            this.updateUrlToHome();
        }
        
        showInitialView();

        updateModelStatusDisplay(null);

        if (urlInput) {
            urlInput.focus();
        }
        console.log("Ready for new transformation.");
    }

    handleCopy(contentToCopy) {
        if (copyToClipboard(contentToCopy)) {
            displayTemporaryMessage('内容已复制到剪贴板', 'success');
        } else {
            displayTemporaryMessage('复制失败，请手动复制', 'error');
        }
    }

    async handleShare(content, url) {
        // 优先使用分享URL，如果没有则使用当前页面URL
        const shareUrl = this.shareUrl || window.location.href;
        
        const shareData = {
            title: 'StreamWisdom 转化分享',
            text: `通过悟流转化的内容:\n${content.substring(0, 200)}...\n原文来源: ${url}`,
            url: shareUrl
        };
        
        try {
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData);
                displayTemporaryMessage('分享链接已发送', 'success');
            } else {
                // 复制分享URL到剪贴板
                if (copyToClipboard(shareUrl)) {
                    displayTemporaryMessage('分享链接已复制到剪贴板', 'success');
                } else {
                    displayTemporaryMessage('复制失败，请手动复制链接', 'error');
                }
            }
        } catch (err) {
            console.error('Share error:', err);
            displayTemporaryMessage('分享失败', 'error');
            // 降级到复制链接
            if (copyToClipboard(shareUrl)) {
                displayTemporaryMessage('分享链接已复制到剪贴板', 'success');
            }
        }
    }
    
    reportError(errorReportText) {
        if(copyToClipboard(errorReportText)) {
            displayTemporaryMessage('错误报告已复制到剪贴板，请粘贴到反馈渠道。', 'info', 5000);
        } else {
            displayTemporaryMessage('复制错误报告失败，请手动复制。', 'error');
        }
    }

    toggleEdit() {
        displayTemporaryMessage('编辑功能暂未实现', 'info');
    }

    // 检查URL是否已存在转化
    async checkUrlExists(url) {
        try {
            const response = await fetch('/api/check-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('URL检查请求失败:', error);
            throw error;
        }
    }

    // 显示重复URL确认对话框
    async showDuplicateConfirmation(transformation, isAdmin = false) {
        return new Promise((resolve) => {
            // 创建对话框HTML
            const dialogHtml = `
                <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="duplicateDialog">
                    <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                        <div class="flex items-center mb-4">
                            <div class="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center mr-3">
                                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.598 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z">
                                    </path>
                                </svg>
                            </div>
                            <h3 class="text-lg font-semibold text-white">检测到重复转化</h3>
                        </div>
                        
                        <div class="mb-6 text-gray-300">
                            <p class="mb-3">此URL已经转化过了：</p>
                            <p class="mb-3 text-orange-400 text-sm">⚠️ 管理员重新转化将覆盖原有内容，原记录将被永久替换</p>
                            <div class="bg-slate-700 rounded p-3 text-sm">
                                <div class="font-medium text-white mb-1">${transformation.title}</div>
                                <div class="text-gray-400 text-xs">
                                    转化时间：${new Date(transformation.created_at).toLocaleString('zh-CN')}
                                </div>
                                <div class="text-gray-400 text-xs">
                                    复杂度：${transformation.complexity === 'beginner' ? '初学者' : 
                                              transformation.complexity === 'intermediate' ? '中级' : 
                                              transformation.complexity === 'advanced' ? '高级' : transformation.complexity}
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex flex-col gap-3">
                            <button id="viewExistingBtn" 
                                    class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                                查看已有转化结果
                            </button>
                            ${isAdmin ? `
                            <button id="continueTransformBtn" 
                                    class="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors">
                                覆盖重新转化（管理员）
                            </button>
                            ` : `
                            <div class="w-full px-4 py-2 bg-gray-500 text-gray-300 rounded-lg text-center text-sm">
                                需要管理员权限才能覆盖转化
                            </div>
                            `}
                            <button id="cancelBtn" 
                                    class="w-full px-4 py-2 bg-transparent border border-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // 添加对话框到页面
            document.body.insertAdjacentHTML('beforeend', dialogHtml);
            const dialog = document.getElementById('duplicateDialog');

            // 绑定按钮事件
            const viewExistingBtn = dialog.querySelector('#viewExistingBtn');
            const continueTransformBtn = dialog.querySelector('#continueTransformBtn');
            const cancelBtn = dialog.querySelector('#cancelBtn');

            viewExistingBtn.addEventListener('click', () => {
                // 打开已有转化结果
                window.open(transformation.shareUrl, '_blank');
                dialog.remove();
                resolve(false);
            });

            // 只有管理员才会有继续转化按钮
            if (continueTransformBtn && isAdmin) {
                continueTransformBtn.addEventListener('click', () => {
                    dialog.remove();
                    resolve(true);
                });
            }

            cancelBtn.addEventListener('click', () => {
                dialog.remove();
                resolve(false);
            });

            // 点击外部关闭对话框
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    dialog.remove();
                    resolve(false);
                }
            });

            // ESC键关闭对话框
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

    // 检查管理员状态
    async checkAdminStatus() {
        try {
            const response = await fetch('/api/admin/status');
            const data = await response.json();
            this.isAdmin = data.isAdmin;
            this.updateAdminUI();
        } catch (error) {
            console.warn('检查管理员状态失败:', error);
            this.isAdmin = false;
        }
    }

    // 添加管理员登录UI到右上角
    addAdminLoginUI() {
        const adminUI = document.createElement('div');
        adminUI.id = 'adminUI';
        adminUI.className = 'fixed top-4 right-4 z-40 bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-lg px-4 py-2 shadow-lg';
        adminUI.innerHTML = `
            <div class="flex items-center space-x-3 text-sm">
                <span class="text-slate-400" id="adminStatus">访客模式</span>
                <button id="adminConfigBtn" class="text-green-400 hover:text-green-300 transition-colors text-sm hidden flex items-center space-x-1" title="系统配置">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z">
                        </path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <span>配置</span>
                </button>
                <button id="adminLoginBtn" class="text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
                        </path>
                    </svg>
                    <span>登录</span>
                </button>
                <button id="adminLogoutBtn" class="text-red-400 hover:text-red-300 transition-colors text-sm hidden flex items-center space-x-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1">
                        </path>
                    </svg>
                    <span>登出</span>
                </button>
            </div>
        `;

        document.body.appendChild(adminUI);

        // 绑定事件
        document.getElementById('adminLoginBtn').addEventListener('click', () => {
            this.showAdminLoginDialog();
        });

        document.getElementById('adminLogoutBtn').addEventListener('click', () => {
            this.adminLogout();
        });

        document.getElementById('adminConfigBtn').addEventListener('click', () => {
            if (window.adminConfigManager) {
                window.adminConfigManager.showConfigPanel();
            }
        });
    }

    // 更新管理员UI
    updateAdminUI() {
        const statusElement = document.getElementById('adminStatus');
        const loginBtn = document.getElementById('adminLoginBtn');
        const logoutBtn = document.getElementById('adminLogoutBtn');
        const configBtn = document.getElementById('adminConfigBtn');

        if (!statusElement || !loginBtn || !logoutBtn || !configBtn) return;

        if (this.isAdmin) {
            statusElement.textContent = '管理员模式';
            statusElement.className = 'text-green-400';
            loginBtn.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
            configBtn.classList.remove('hidden');
        } else {
            statusElement.textContent = '访客模式';
            statusElement.className = 'text-slate-400';
            loginBtn.classList.remove('hidden');
            logoutBtn.classList.add('hidden');
            configBtn.classList.add('hidden');
        }

        // 刷新历史记录以显示/隐藏删除按钮
        if (window.transformationsHistory) {
            setTimeout(() => {
                transformationsHistory.loadTransformations('', true);
            }, 100);
        }
    }

    // 显示管理员登录对话框
    showAdminLoginDialog() {
        const dialogHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="adminLoginDialog">
                <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
                                </path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-semibold text-white">管理员登录</h3>
                    </div>
                    
                    <form id="adminLoginForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">用户名</label>
                            <input type="text" id="adminUsername" required
                                   class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">密码</label>
                            <input type="password" id="adminPassword" required
                                   class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div class="flex space-x-3 pt-2">
                            <button type="submit" 
                                    class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                                登录
                            </button>
                            <button type="button" id="adminLoginCancelBtn"
                                    class="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors">
                                取消
                            </button>
                        </div>
                    </form>
                    <div id="adminLoginError" class="mt-3 text-red-400 text-sm hidden"></div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dialogHtml);
        const dialog = document.getElementById('adminLoginDialog');
        const form = document.getElementById('adminLoginForm');
        const cancelBtn = document.getElementById('adminLoginCancelBtn');
        const errorDiv = document.getElementById('adminLoginError');

        // 绑定事件
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('adminUsername').value;
            const password = document.getElementById('adminPassword').value;

            try {
                const response = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    this.isAdmin = true;
                    this.updateAdminUI();
                    dialog.remove();
                    this.showToast('管理员登录成功', 'success');
                } else {
                    errorDiv.textContent = data.error || '登录失败';
                    errorDiv.classList.remove('hidden');
                }
            } catch (error) {
                errorDiv.textContent = '网络错误，请重试';
                errorDiv.classList.remove('hidden');
            }
        });

        cancelBtn.addEventListener('click', () => {
            dialog.remove();
        });

        // 点击外部关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });

        // 聚焦到用户名输入框
        document.getElementById('adminUsername').focus();
    }

    // 管理员登出
    async adminLogout() {
        try {
            const response = await fetch('/api/admin/logout', {
                method: 'POST'
            });

                            if (response.ok) {
                    this.isAdmin = false;
                    this.updateAdminUI();
                    this.showToast('已登出', 'info');
                }
        } catch (error) {
            console.error('登出失败:', error);
        }
    }

    // 显示Toast消息
    showToast(message, type = 'info') {
        const toastId = 'toast-' + Date.now();
        let bgColor, borderColor;
        
        switch (type) {
            case 'success':
                bgColor = 'bg-slate-800/90';
                borderColor = 'border-green-500/50';
                break;
            case 'error':
                bgColor = 'bg-slate-800/90';
                borderColor = 'border-red-500/50';
                break;
            default:
                bgColor = 'bg-slate-800/90';
                borderColor = 'border-blue-500/50';
        }
        
        const toastHtml = `
            <div id="${toastId}" class="fixed top-4 left-1/2 transform -translate-x-1/2 ${bgColor} ${borderColor} border backdrop-blur-sm text-slate-200 px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
                ${message}
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', toastHtml);
        
        setTimeout(() => {
            const toast = document.getElementById(toastId);
            if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translate(-50%, -100%)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 2000);
    }

    // 初始化路由功能
    initRouting() {
        // 监听浏览器前进后退事件
        window.addEventListener('popstate', (event) => {
            this.handleRouteChange(event.state);
        });

        // 检查初始页面是否有转化数据
        if (window.INITIAL_TRANSFORMATION_DATA && window.INITIAL_TRANSFORMATION_UUID) {
            this.loadTransformationFromData(
                window.INITIAL_TRANSFORMATION_DATA, 
                window.INITIAL_TRANSFORMATION_UUID
            );
        }
    }

    // 更新URL到结果页面
    updateUrlToResult(uuid) {
        const newUrl = `/result/${uuid}`;
        const state = { uuid: uuid, page: 'result' };
        
        // 只有当前URL不是结果页面时才更新
        if (window.location.pathname !== newUrl) {
            window.history.pushState(state, '', newUrl);
        }
    }

    // 更新URL到主页
    updateUrlToHome() {
        const state = { page: 'home' };
        window.history.pushState(state, '', '/');
    }

    // 处理路由变化
    handleRouteChange(state) {
        if (state && state.page === 'result' && state.uuid) {
            // 从数据库重新加载转化结果
            this.loadTransformationFromUuid(state.uuid);
        } else {
            // 返回主页
            this.startNewTransform(true);
        }
    }

    // 从UUID加载转化结果
    async loadTransformationFromUuid(uuid) {
        try {
            console.log('从UUID加载转化结果:', uuid);
            const response = await fetch(`/api/transformations/${uuid}`);
            const result = await response.json();
            
            if (result.success && result.data) {
                this.loadTransformationFromData(result.data, uuid);
            } else {
                console.error('加载转化结果失败:', result.error);
                this.updateUrlToHome();
                this.startNewTransform(true);
            }
        } catch (error) {
            console.error('加载转化结果出错:', error);
            this.updateUrlToHome();
            this.startNewTransform(true);
        }
    }

    // 从转化数据加载结果页面
    loadTransformationFromData(transformationData, uuid) {
        console.log('加载转化数据到页面:', transformationData.title);
        
        // 设置当前状态
        this.isTransformed = true;
        this.currentUrl = transformationData.original_url;
        this.shareUrl = `${window.location.origin}/share/${uuid}`;

        // 隐藏初始界面
        setViewVisibility(false, false, false);

        // 显示转化结果
        const regularResultCallbacks = {
            onNewTransform: () => {
                this.updateUrlToHome();
                this.startNewTransform();
            },
            onEdit: () => this.toggleEdit(),
            onShare: () => this.handleShare(transformationData.transformed_content, transformationData.original_url),
            onCopy: () => this.handleCopy(transformationData.transformed_content),
            onReportError: (content, errorUrl) => this.reportError(generateErrorReportText(content, errorUrl, 'regular_transform_report')),
            onBackToTop: () => {
                const outputCardContent = document.querySelector('.result-content-area');
                if (outputCardContent) outputCardContent.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        displayRegularResultView(
            {
                summary: transformationData.transformed_content,
                model: null, // 历史数据可能没有模型信息
                stats: {
                    imageCount: transformationData.image_count || 0,
                    originalLength: transformationData.transformed_content.length, // 估算
                    transformedLength: transformationData.transformed_content.length
                },
                url: transformationData.original_url
            },
            regularResultCallbacks
        );

        console.log('转化结果页面加载完成');
    }
} 