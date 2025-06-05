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

        this.streamUIElements = {};
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.initMarkdown();
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

        const urlInput = document.getElementById('urlInput');
        if (urlInput) {
            urlInput.value = '';
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
        const shareData = {
            title: 'StreamWisdom 转化结果',
            text: `通过StreamWisdom转化的内容:\n${content.substring(0, 200)}...\n来源: ${url}`,
            url: window.location.href
        };
        try {
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData);
                displayTemporaryMessage('内容已分享', 'success');
            } else {
                displayTemporaryMessage('您的浏览器不支持分享功能，请手动复制内容。', 'info');
                this.handleCopy(`${shareData.text}\n查看详情: ${shareData.url}`);
            }
        } catch (err) {
            console.error('Share error:', err);
            displayTemporaryMessage('分享失败', 'error');
            this.handleCopy(`${shareData.text}\n查看详情: ${shareData.url}`);
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
} 