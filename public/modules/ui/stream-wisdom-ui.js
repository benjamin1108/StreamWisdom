import { getModelDisplayName, renderMarkdown, styleMarkdownImages, getStatsText } from '../utils/stream-utils.js';

export function displayTemporaryMessage(message, type = 'success', duration) {
    const containerId = 'temporary-message-container';
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'fixed top-6 right-6 z-[100] flex flex-col gap-3';
        document.body.appendChild(container);
    }

    const messageDiv = document.createElement('div');
    const bgColors = {
        'success': 'bg-gradient-to-r from-green-500 to-emerald-600',
        'error': 'bg-gradient-to-r from-red-500 to-pink-600',
        'warning': 'bg-gradient-to-r from-yellow-500 to-orange-600',
        'info': 'bg-gradient-to-r from-blue-500 to-purple-600'
    };
    
    messageDiv.className = `px-6 py-4 rounded-xl font-medium text-white transform transition-all duration-300 ease-out opacity-0 translate-x-12 ${bgColors[type] || bgColors.info} shadow-2xl border border-white border-opacity-20 backdrop-blur-sm`;
    
    const icons = {
        'success': 'fas fa-check-circle',
        'error': 'fas fa-exclamation-triangle',
        'warning': 'fas fa-exclamation-circle',
        'info': 'fas fa-info-circle'
    };
    
    messageDiv.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-6 h-6 flex items-center justify-center">
                <i class="${icons[type] || icons.info} text-lg"></i>
            </div>
            <span class="text-sm font-medium flex-grow">${message}</span>
            <button class="ml-2 text-white text-opacity-70 hover:text-opacity-100 transition-colors flex-shrink-0">
                <i class="fas fa-times text-sm"></i>
            </button>
        </div>
    `;
    
    const closeBtn = messageDiv.querySelector('button');
    const hideMessage = () => {
        messageDiv.classList.add('opacity-0', 'translate-x-12');
        messageDiv.classList.remove('opacity-100', 'translate-x-0');
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
            if (container.children.length === 0 && container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }, 300);
    };
    
    closeBtn.addEventListener('click', hideMessage);
    container.appendChild(messageDiv);
    
    requestAnimationFrame(() => {
        messageDiv.classList.remove('opacity-0', 'translate-x-12');
        messageDiv.classList.add('opacity-100', 'translate-x-0');
    });
    
    const autoHideDelay = duration || (type === 'error' ? 6000 : type === 'warning' ? 5000 : 3500);
    setTimeout(hideMessage, autoHideDelay);
}

export function updateModelStatusDisplay(modelId) {
    const currentModelElement = document.getElementById('currentModel');
    if (currentModelElement) {
        if (modelId) {
            const modelName = getModelDisplayName(modelId); // Util function
            currentModelElement.textContent = `AI模型: ${modelName}`;
        } else {
            currentModelElement.textContent = `AI模型: 自动选择`; 
        }
    }
}

// New function to manage visibility of the main views
export function setViewVisibility(showInitial, showLoading, showDynamic) {
    const initialView = document.getElementById('initialViewContainer');
    const loadingContainer = document.getElementById('loadingContainer');
    const dynamicContainer = document.getElementById('dynamicContainer');

    if (initialView) initialView.classList.toggle('hidden', !showInitial);
    if (loadingContainer) loadingContainer.classList.toggle('hidden', !showLoading);
    if (dynamicContainer) dynamicContainer.classList.toggle('hidden', !showDynamic);
}

export function showInitialView() {
    setViewVisibility(true, false, false);
    // Potentially clear dynamicContainer content if needed
    const dynamicContainer = document.getElementById('dynamicContainer');
    if (dynamicContainer) dynamicContainer.innerHTML = ''; 
}

export function switchToCompactLayout() {
    // 在新的布局中，我们只需要隐藏初始视图容器
    setViewVisibility(false, false, false);
}

export function hideInputCard_UI() {
    // 在新的布局中，这个函数不需要做任何事情，因为初始视图已经被隐藏
    // 保留函数避免破坏现有的调用
}

export function switchToInitialLayout() {
    showInitialView(); // Let's consolidate to the new function
}

let regularLoadingAnimationInterval = null;

function clearRegularLoadingAnimation() {
    if (regularLoadingAnimationInterval) {
        clearInterval(regularLoadingAnimationInterval);
        regularLoadingAnimationInterval = null;
    }
}

export function displayRegularLoading(messagesArray) {
    setViewVisibility(false, true, false); // Hide initial, show loading
    clearRegularLoadingAnimation();
    const loadingContainer = document.getElementById('loadingContainer');
    if (!loadingContainer) return;

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
                <p id="loadingMessage" class="text-slate-300 text-lg mb-2">${messagesArray[0] || '处理中...'}</p>
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
    
    loadingContainer.innerHTML = `
        <div class="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl p-6 sm:p-8 max-w-md w-full mx-auto">
            ${loadingHtml}
        </div>
    `;
    
    let currentIndex = 0;
    const progressBar = document.getElementById('progressBar');
    const loadingMessageElement = document.getElementById('loadingMessage');

    const updateProgress = () => {
        if (currentIndex < messagesArray.length) {
            if (loadingMessageElement) {
                loadingMessageElement.style.opacity = '0';
                setTimeout(() => {
                    if (loadingMessageElement) {
                        loadingMessageElement.textContent = messagesArray[currentIndex];
                        loadingMessageElement.style.opacity = '1';
                    }
                }, 200);
            }
            if (progressBar) {
                const progress = ((currentIndex + 1) / messagesArray.length) * 85; 
                progressBar.style.width = `${progress}%`;
            }
            currentIndex++;
        } else {
            clearRegularLoadingAnimation();
        }
    };
    
    updateProgress();
    regularLoadingAnimationInterval = setInterval(updateProgress, Math.random() * 1500 + 1000);
}

export function displayStreamLoading(initialMessage = '初始化中...') {
    setViewVisibility(false, true, false); // Hide initial, show loading
    clearRegularLoadingAnimation(); // Clear any interval from regular loading
    const loadingContainer = document.getElementById('loadingContainer');
    if (!loadingContainer) return;

    const loadingHtml = `
        <div class="loading-container">
            <div class="loading-circle"></div>
            <div class="loading-pulse">
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
            </div>
            <h3 class="text-2xl font-semibold text-white mb-4 fade-in">🌊 流式转化中</h3>
            <div class="text-center">
                <p id="streamLoadingMessage" class="text-slate-300 text-lg mb-4">${initialMessage}</p>
                <div class="stream-progress-container w-full">
                    <div class="w-full bg-slate-700 rounded-full h-2 mx-auto mb-4 max-w-xs">
                        <div id="streamProgressBar" class="bg-gradient-to-r from-blue-400 to-purple-500 h-2 rounded-full transition-all duration-300 ease-out" style="width: 0%"></div>
                    </div>
                </div>
                <div class="mt-4 text-slate-400 text-sm">
                    <i class="fas fa-stream text-blue-400 mr-2"></i>
                    实时内容生成中，请稍候...
                </div>
            </div>
        </div>
    `;
    loadingContainer.innerHTML = `
        <div class="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl p-6 sm:p-8 max-w-md w-full mx-auto">
            ${loadingHtml}
        </div>
    `;
    // The incorrect progress logic previously here has been removed.
    // Stream progress is handled by updateStreamLoadingState.
}

export function updateStreamLoadingState(messageText, progressPercent) {
    const streamMessageElement = document.getElementById('streamLoadingMessage');
    const streamProgressBarElement = document.getElementById('streamProgressBar');

    if (streamMessageElement && messageText) {
        // 简化加载消息文案
        const simplifiedMessage = messageText.includes('正在识别') ? '正在处理内容...' : 
                                messageText.includes('模型') ? '正在生成内容...' : 
                                messageText;
        streamMessageElement.textContent = simplifiedMessage;
    }
    if (streamProgressBarElement && typeof progressPercent === 'number') {
        streamProgressBarElement.style.width = `${Math.max(0, Math.min(100, progressPercent))}%`;
    }
}

export function hideMainLoadingIndicator() {
    setViewVisibility(false, false, true); // Typically called when dynamic content is ready
                                         // or showInitialView() if going back to input.
    const loadingContainer = document.getElementById('loadingContainer');
    const progressBar = document.getElementById('progressBar');
    const streamProgressBar = document.getElementById('streamProgressBar');
 
    if (progressBar && progressBar.offsetParent !== null) {
        progressBar.style.width = '100%';
    }
    if (streamProgressBar && streamProgressBar.offsetParent !== null) {
        // For stream, completion is typically handled by other UI updates,
        // but ensure it's 100% if called after a successful stream completion.
        // streamProgressBar.style.width = '100%'; 
    }
    
    setTimeout(() => {
        if (loadingContainer) {
            loadingContainer.classList.add('transition-opacity', 'duration-500', 'ease-out', 'opacity-0');
            setTimeout(() => {
                loadingContainer.classList.add('hidden');
                loadingContainer.classList.remove('transition-opacity', 'duration-500', 'ease-out', 'opacity-0'); 
                const glassCard = loadingContainer.querySelector('.glass-card');
                if (glassCard) glassCard.innerHTML = '';
            }, 500);
        }
    }, 800);
}

export function displayErrorView(message, onRetry, onBackHome, onReport) {
    setViewVisibility(false, false, true); // Hide initial & loading, show dynamic for error
    const dynamicContainer = document.getElementById('dynamicContainer');
    if (!dynamicContainer) return;

    const errorHtml = `
        <div class="container mx-auto px-6 py-8 max-w-5xl relative">
            <div class="glass-card rounded-2xl p-8 border-l-4 border-red-500 fade-in">
                <button id="closeErrorBtn" aria-label="关闭错误提示" class="absolute top-4 right-5 text-slate-500 hover:text-slate-200 transition-colors duration-150">
                    <i class="fas fa-times text-2xl"></i>
                </button>
                <div class="flex items-start mb-6">
                    <i class="fas fa-exclamation-triangle text-red-400 mr-4 text-3xl flex-shrink-0"></i>
                    <div>
                        <h3 class="text-white font-semibold text-xl mb-2">出现问题</h3>
                        <p class="text-slate-300 leading-relaxed">${message}</p>
                    </div>
                </div>
                
                <div class="flex flex-wrap gap-3 justify-center border-t border-slate-600 pt-6">
                    <button id="errorRetryBtn" class="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2">
                        <i class="fas fa-redo"></i>
                        重试上次操作
                    </button>
                    <button id="errorBackHomeBtn" class="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2">
                        <i class="fas fa-home"></i>
                        返回首页
                    </button>
                    <button id="errorReportBtn" class="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2">
                        <i class="fas fa-bug"></i>
                        反馈问题
                    </button>
                </div>
            </div>
        </div>
    `;
    
    dynamicContainer.innerHTML = errorHtml;
    dynamicContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const closeErrorBtn = document.getElementById('closeErrorBtn');
    const retryBtn = document.getElementById('errorRetryBtn');
    const backHomeBtn = document.getElementById('errorBackHomeBtn');
    const reportErrorBtn = document.getElementById('errorReportBtn');

    if (closeErrorBtn && onBackHome) { 
        closeErrorBtn.addEventListener('click', () => {
            dynamicContainer.innerHTML = ''; 
            onBackHome(); 
        });
    }
    if (retryBtn && onRetry) {
        retryBtn.addEventListener('click', () => {
            dynamicContainer.innerHTML = '';
            onRetry();
        });
    }
    if (backHomeBtn && onBackHome) {
        backHomeBtn.addEventListener('click', () => {
            dynamicContainer.innerHTML = '';
            onBackHome();
        });
    }
    if (reportErrorBtn && onReport) {
        reportErrorBtn.addEventListener('click', () => {
            onReport(message); 
        });
    }
}

function generateStatsBadgesHtml(modelUsed, imageCount, transformedLength, originalLength) {
    const badges = [];
    if (modelUsed) {
        badges.push(`<span class="stats-badge px-2 py-1 rounded-full text-xs flex items-center gap-1">
            <i class="fas fa-robot"></i>
            ${getModelDisplayName(modelUsed)} 
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
            <i class="fas fa-file-alt"></i> 
            ${transformedLength.toLocaleString()}字符
        </span>`);
    }
    if (originalLength > 0 && transformedLength > 0) { 
        const compressionRatio = ((originalLength - transformedLength) / originalLength * 100);
        if (compressionRatio > 1) { 
            badges.push(`<span class="stats-badge px-2 py-1 rounded-full text-xs flex items-center gap-1">
                <i class="fas fa-compress-arrows-alt"></i> 
                精简${compressionRatio.toFixed(1)}%
            </span>`);
        }
    }
    return badges.join('');
}

function setupBackToTopButton_Internal(contentAreaSelector, backToTopBtnSelector) { 
    const backToTopBtn = document.querySelector(backToTopBtnSelector);
    if (!backToTopBtn) return;
    
    if (backToTopBtn.dataset.listenerAttached === 'true') return;

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
    toggleButton(); 
    
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    backToTopBtn.dataset.listenerAttached = 'true';
}

export function displayRegularResultView(data, callbacks) {
    setViewVisibility(false, false, true); // Hide initial & loading, show dynamic for results
    const dynamicContainer = document.getElementById('dynamicContainer');
    if (!dynamicContainer) return;

    // 与流式布局保持一致的现代科技风格
    dynamicContainer.className = 'w-full max-w-6xl mx-auto my-6 px-0 sm:px-4 fade-in';

    const rawMarkdown = data.summary || '发生错误，未能获取转化内容。';
    const htmlContent = renderMarkdown(rawMarkdown);
    
    const chineseChars = (rawMarkdown.match(/[\u4e00-\u9fa5]/g) || []).length;
    const words = (rawMarkdown.match(/[a-zA-Z]+/g) || []).length;
    const totalCount = chineseChars + words;

    const summaryTextForEvent = rawMarkdown;
    const resultIdPrefix = `regular-result-${Date.now()}`;

    dynamicContainer.innerHTML = `
        <div class="bg-gradient-to-b from-slate-800/30 to-slate-900/20 backdrop-blur-xl border border-slate-600/50 rounded-2xl shadow-2xl overflow-hidden">
            <!-- 顶部工具栏 -->
            <div class="toolbar sticky top-0 z-10 flex items-center justify-between p-4 bg-slate-900/80 backdrop-blur-xl border-b border-slate-600/50">
                <div class="flex items-center gap-4">
                    <button title="返回输入" id="${resultIdPrefix}-back-to-input-btn" class="group flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/70 border border-slate-500/30 transition-all duration-200">
                        <i class="fas fa-arrow-left text-slate-300 group-hover:text-white transition-colors"></i>
                        <span class="text-sm text-slate-300 group-hover:text-white hidden sm:inline">返回</span>
                    </button>
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 bg-emerald-400 rounded-full"></div>
                        <span class="text-sm text-slate-300 font-medium">转化完成 · ${totalCount.toLocaleString()} 字</span>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button title="复制内容" id="${resultIdPrefix}-copy-btn" class="p-2.5 rounded-lg bg-slate-700/50 hover:bg-emerald-600/70 border border-slate-500/30 transition-all duration-200">
                        <i class="fas fa-copy text-slate-300 hover:text-white"></i>
                    </button>
                    <button title="分享" id="${resultIdPrefix}-share-btn" class="p-2.5 rounded-lg bg-slate-700/50 hover:bg-blue-600/70 border border-slate-500/30 transition-all duration-200">
                        <i class="fas fa-share-alt text-slate-300 hover:text-white"></i>
                    </button>
                    <button title="反馈" id="${resultIdPrefix}-report-error-btn" class="p-2.5 rounded-lg bg-slate-700/50 hover:bg-orange-600/70 border border-slate-500/30 transition-all duration-200">
                        <i class="fas fa-bug text-slate-300 hover:text-white"></i>
                    </button>
                </div>
            </div>
            
            <!-- 内容区域 - 无滚动条，自然展开 -->
            <div class="result-content-area">
                <div class="p-8">
                    <div class="markdown-content text-slate-100 prose prose-lg prose-invert max-w-none leading-relaxed">
                        ${htmlContent}
                    </div>
                </div>
            </div>
            
            <!-- 底部状态栏 -->
            <div class="result-footer px-6 py-3 bg-slate-900/60 backdrop-blur-md border-t border-slate-600/50">
                <span class="text-sm text-slate-400">${getStatsText(data.stats?.transformedLength, data.stats?.originalLength, data.stats?.imageCount)} ${data.model ? '· ' + getModelDisplayName(data.model) : ''}</span>
            </div>
        </div>
    `;

    styleMarkdownImages(`#${dynamicContainer.id} .markdown-content`);

    // 绑定事件处理器
    const backToInputBtn = document.getElementById(`${resultIdPrefix}-back-to-input-btn`);
    const copyBtn = document.getElementById(`${resultIdPrefix}-copy-btn`);
    const shareBtn = document.getElementById(`${resultIdPrefix}-share-btn`);
    const reportBtn = document.getElementById(`${resultIdPrefix}-report-error-btn`);

    if (backToInputBtn && callbacks.onNewTransform) {
        backToInputBtn.addEventListener('click', callbacks.onNewTransform);
    }
    if (copyBtn && callbacks.onCopy) {
        copyBtn.addEventListener('click', () => callbacks.onCopy(rawMarkdown));
    }
    if (shareBtn && callbacks.onShare) {
        shareBtn.addEventListener('click', () => callbacks.onShare(rawMarkdown, data.url));
    }
    if (reportBtn && callbacks.onReportError) {
        reportBtn.addEventListener('click', () => callbacks.onReportError(rawMarkdown, data.url));
    }

    if (callbacks.dispatchArticleLoadedEvent) {
        callbacks.dispatchArticleLoadedEvent(summaryTextForEvent, totalCount, data.url);
    }
}

let userHasScrolledManually = false;
let scrollEventHandlerAttached = false; // Flag to ensure listener is added only once

function handleUserScroll() {
    userHasScrolledManually = true;
    console.log("用户手动滚动，自动滚动已禁用"); // For debugging
}

// Function to re-enable auto-scroll if needed, e.g., by a button
// export function enableAutoScroll() {
//     userHasScrolledManually = false;
//     // console.log("Auto-scroll re-enabled."); // For debugging
// }

// Utility function to check if the user is near the bottom of the page
// function isScrolledToBottom() {
//     // Consider a small threshold for "near bottom"
//     const threshold = 50; // pixels
//     return (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - threshold);
// }

export function displayStreamResultLayout(callbacks) {
    setViewVisibility(false, false, true); // Hide initial & loading, show dynamic for stream layout
    const dynamicContainer = document.getElementById('dynamicContainer');
    if (!dynamicContainer) return null;

    userHasScrolledManually = false; // Reset for new stream

    if (!scrollEventHandlerAttached) {
        // 监听多种滚动事件
        window.addEventListener('wheel', handleUserScroll, { passive: true });
        window.addEventListener('scroll', handleUserScroll, { passive: true });
        window.addEventListener('touchmove', handleUserScroll, { passive: true });
        // 监听键盘滚动
        window.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown' || e.key === 'Home' || e.key === 'End') {
                handleUserScroll();
            }
        }, { passive: true });
        scrollEventHandlerAttached = true;
        console.log("滚动事件监听器已附加"); // For debugging
    }

    // 简约科技风布局 - 内容自然展开
    dynamicContainer.className = 'w-full max-w-6xl mx-auto my-6 px-0 sm:px-4 fade-in';
    
    const streamIdPrefix = `stream-result-${Date.now()}`;

    dynamicContainer.innerHTML = `
        <div class="bg-gradient-to-b from-slate-800/30 to-slate-900/20 backdrop-blur-xl border border-slate-600/50 rounded-2xl shadow-2xl overflow-hidden">
            <!-- 顶部工具栏 - 简约设计 -->
            <div class="toolbar sticky top-0 z-10 flex items-center justify-between p-4 bg-slate-900/80 backdrop-blur-xl border-b border-slate-600/50">
                <div class="flex items-center gap-4">
                    <button title="返回输入" id="${streamIdPrefix}-back-to-input-btn" class="group flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/70 border border-slate-500/30 transition-all duration-200">
                        <i class="fas fa-arrow-left text-slate-300 group-hover:text-white transition-colors"></i>
                        <span class="text-sm text-slate-300 group-hover:text-white hidden sm:inline">返回</span>
                    </button>
                    <div class="flex items-center gap-3">
                        <div id="${streamIdPrefix}-status-dot" class="w-2 h-2 bg-sky-400 rounded-full animate-pulse"></div>
                        <span id="${streamIdPrefix}-status-text" class="text-sm text-slate-300 font-medium">正在生成内容...</span>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button title="复制内容" id="${streamIdPrefix}-copy-btn" class="p-2.5 rounded-lg bg-slate-700/50 hover:bg-emerald-600/70 border border-slate-500/30 transition-all duration-200 hidden">
                        <i class="fas fa-copy text-slate-300 hover:text-white"></i>
                    </button>
                    <button title="分享" id="${streamIdPrefix}-share-btn" class="p-2.5 rounded-lg bg-slate-700/50 hover:bg-blue-600/70 border border-slate-500/30 transition-all duration-200 hidden">
                        <i class="fas fa-share-alt text-slate-300 hover:text-white"></i>
                    </button>
                    <button title="反馈" id="${streamIdPrefix}-report-error-btn" class="p-2.5 rounded-lg bg-slate-700/50 hover:bg-orange-600/70 border border-slate-500/30 transition-all duration-200 hidden">
                        <i class="fas fa-bug text-slate-300 hover:text-white"></i>
                    </button>
                </div>
            </div>
            
            <!-- 内容区域 - 无滚动条，自然展开 -->
            <div id="${streamIdPrefix}-content-area" class="result-content-area">
                <div class="p-8">
                    <div id="${streamIdPrefix}-typing-text" class="markdown-content text-slate-100 prose prose-lg prose-invert max-w-none leading-relaxed"></div>
                    <span id="${streamIdPrefix}-typing-cursor" class="ml-1 text-emerald-400 animate-pulse font-mono text-lg">▍</span>
                </div>
            </div>
            
            <!-- 底部状态栏 - 极简设计 -->
            <div class="result-footer px-6 py-3 bg-slate-900/60 backdrop-blur-md border-t border-slate-600/50">
                <span id="${streamIdPrefix}-stats-display" class="text-sm text-slate-400">准备中...</span>
            </div>
        </div>
    `;

    styleMarkdownImages(`#${streamIdPrefix}-typing-text`); 

    // 绑定返回按钮事件
    const backToInputBtn = document.getElementById(`${streamIdPrefix}-back-to-input-btn`);
    if (backToInputBtn && callbacks.onNewTransform) {
        backToInputBtn.addEventListener('click', callbacks.onNewTransform);
    }

    // Return elements based on new prefixed IDs
    return {
        streamContainerElement: dynamicContainer,
        typingTextElement: document.getElementById(`${streamIdPrefix}-typing-text`),
        typingCursorElement: document.getElementById(`${streamIdPrefix}-typing-cursor`),
        statusDot: document.getElementById(`${streamIdPrefix}-status-dot`),
        statusText: document.getElementById(`${streamIdPrefix}-status-text`),
        streamStatsDisplay: document.getElementById(`${streamIdPrefix}-stats-display`),
        copyBtnStream: document.getElementById(`${streamIdPrefix}-copy-btn`),
        shareBtnStream: document.getElementById(`${streamIdPrefix}-share-btn`),
        reportErrorBtnStream: document.getElementById(`${streamIdPrefix}-report-error-btn`),
        backToInputBtnStream: backToInputBtn
    };
}

export function appendContentToStreamView(typingTextElement, typingCursorElement, newChunk, currentFullContent) {
    if (typingTextElement) {
        // Instead of replacing innerHTML, append to avoid losing previous state if renderMarkdown is complex
        // However, for markdown, re-rendering the whole thing is usually safer for complex structures.
        // If performance becomes an issue with large streams, consider more granular DOM appends.
        typingTextElement.innerHTML = renderMarkdown(currentFullContent + newChunk);
        
        // Auto-scroll to latest content ONLY if the user hasn't scrolled manually
        if (!userHasScrolledManually) {
            console.log("执行自动滚动"); // For debugging
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        } else {
            console.log("用户已手动滚动，跳过自动滚动"); // For debugging
        }
    }
    if (typingCursorElement) {
        typingCursorElement.classList.remove('hidden');
    }
    // Re-style images if new ones were added
    if (newChunk.includes('<img')) { // Basic check
        styleMarkdownImages(typingTextElement); 
    }
}

export function finalizeStreamResultView(elements, finalData, callbacks) {
    // setViewVisibility is already handled by displayStreamResultLayout
    // This function finalizes content within the already visible dynamicContainer
    const loadingContainer = document.getElementById('loadingContainer');
    if (loadingContainer) loadingContainer.classList.add('hidden');

    if (elements.typingTextElement && finalData.result !== undefined) {
        // Final content might differ slightly from sum of chunks if server does final processing
        elements.typingTextElement.innerHTML = renderMarkdown(finalData.result); 
        styleMarkdownImages(elements.typingTextElement); // Re-style after final content set
    }

    if (elements.typingCursorElement) {
        elements.typingCursorElement.classList.add('hidden'); // Hide cursor
    }

    // 更新状态显示 - 显示完成状态和字数统计
    if (elements.statusDot) {
        elements.statusDot.classList.remove('bg-sky-400', 'animate-pulse');
        elements.statusDot.classList.add('bg-emerald-400');
    }
    
    if (elements.statusText) {
        const wordCount = finalData.result ? finalData.result.length : 0;
        const chineseChars = (finalData.result?.match(/[\u4e00-\u9fa5]/g) || []).length;
        const words = (finalData.result?.match(/[a-zA-Z]+/g) || []).length;
        const totalCount = chineseChars + words;
        
        elements.statusText.textContent = `转化完成 · ${totalCount.toLocaleString()} 字`;
    }

    // 更新底部统计显示
    if (elements.streamStatsDisplay && finalData.stats) {
        const stats = [];
        if (finalData.stats.transformedLength) {
            stats.push(`${finalData.stats.transformedLength.toLocaleString()} 字符`);
        }
        if (finalData.stats.imageCount > 0) {
            stats.push(`${finalData.stats.imageCount} 张图片`);
        }
        if (finalData.model) {
            stats.push(`${getModelDisplayName(finalData.model)}`);
        }
        elements.streamStatsDisplay.textContent = stats.join(' · ') || '转化完成';
    } else if (elements.streamStatsDisplay) {
        elements.streamStatsDisplay.textContent = '转化完成';
    }

    // Show and bind action buttons that were previously hidden
    if (elements.copyBtnStream && callbacks.onCopy) {
        elements.copyBtnStream.classList.remove('hidden');
        elements.copyBtnStream.addEventListener('click', () => callbacks.onCopy(finalData.result));
    }
    if (elements.shareBtnStream && callbacks.onShare) {
        elements.shareBtnStream.classList.remove('hidden');
        elements.shareBtnStream.addEventListener('click', () => callbacks.onShare(finalData.result, finalData.url));
    }
    if (elements.reportErrorBtnStream && callbacks.onReportError) {
        elements.reportErrorBtnStream.classList.remove('hidden');
        elements.reportErrorBtnStream.addEventListener('click', () => callbacks.onReportError(finalData.result, finalData.url));
    }
    
    // Dispatch article loaded event if applicable
    if (callbacks.dispatchArticleLoadedEvent) {
        callbacks.dispatchArticleLoadedEvent(finalData.result, (finalData.stats?.transformedLength || 0), finalData.url);
    }
    
    console.log("Stream UI finalized.");
}

export function updateStreamViewForError(elements, errorMessage) {
    // setViewVisibility is already handled by displayStreamResultLayout
    // This function updates content within the already visible dynamicContainer
    const loadingContainer = document.getElementById('loadingContainer');
    if (loadingContainer) loadingContainer.classList.add('hidden');

    if (elements.streamResultContentElement) {
        const typingIndicator = elements.streamResultContentElement.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.innerHTML = '<p class="text-red-400">流式传输中断。</p>';
        } else {
            elements.streamResultContentElement.innerHTML = '<p class="text-red-400">流式传输中断。</p>';
        }
    }
    if (elements.streamToolbarStatusElement) {
        elements.streamToolbarStatusElement.innerHTML = `
            <i class="fas fa-exclamation-triangle text-red-400 mr-2"></i>
            流式传输错误
        `;
    }
} 