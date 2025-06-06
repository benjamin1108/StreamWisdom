export function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}

function formatContent(content) { // Not exported, helper for renderMarkdown
    let html = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/\n{3,}/g, '\n\n'); // 多个连续换行符压缩为两个
    html = html.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>\s*<\/p>/g, '');
    return `<p>${html}</p>`;
}

export function renderMarkdown(content) {
    if (typeof marked !== 'undefined') {
        return marked.parse(content);
    } else {
        console.warn("Marked.js not loaded. Using basic formatting.");
        return formatContent(content);
    }
}

export function styleMarkdownImages() {
    const contentArea = document.getElementById('resultContent') || document.getElementById('streamResultContent');
    if (!contentArea) return;

    const images = contentArea.querySelectorAll('img');
    images.forEach(img => {
        if(img.classList.contains('styled-markdown-image')) return;

        img.classList.add('styled-markdown-image', 'max-w-full', 'h-auto', 'rounded-xl', 'shadow-xl', 'my-6', 'border', 'border-slate-600');
        img.style.display = 'block'; 
        img.style.margin = '2rem auto';
        
        img.onerror = function() {
            if(this.classList.contains('image-error-handled')) return;
            this.classList.add('image-error-handled');

            this.style.display = 'none';
            const placeholder = document.createElement('div');
            placeholder.className = 'bg-slate-700 text-slate-400 p-6 rounded-xl text-center my-6 border border-slate-600';
            placeholder.innerHTML = `<i class="fas fa-image mr-2 text-2xl"></i><br><span class="text-sm mt-2 block">图片加载失败: ${this.alt || '无描述'}</span>`;
            
            if (this.parentNode) {
                this.parentNode.insertBefore(placeholder, this.nextSibling);
            }
        };
    });
}

export function getModelDisplayName(modelId) {
    const modelNames = {
        'grok3-mini': 'Grok 3 Mini',
        'groq-llama3': 'Llama 3 (Groq)',
        'qwen-turbo': '通义千问 Turbo',
        'qwen-max': '通义千问 Max',
        'openai-gpt4': 'GPT-4 (OpenAI)',
        'default': '默认模型'
    };
    return modelNames[modelId] || modelId || '未知模型';
}

export function getStatsText(transformedLength, originalLength, imageCount) {
    let stats = [];
    
    // 显示转化后字符数
    if (transformedLength > 0) {
        stats.push(`${transformedLength.toLocaleString()} 字符`);
    }
    
    // 显示压缩率
    if (originalLength > 0 && transformedLength > 0) {
        const compressionRatio = transformedLength / originalLength;
        
        if (compressionRatio < 1) {
            // 压缩了内容
            const compressionPercent = ((1 - compressionRatio) * 100).toFixed(1);
            stats.push(`压缩${compressionPercent}%`);
        } else if (compressionRatio > 1) {
            // 扩展了内容
            const expansionPercent = ((compressionRatio - 1) * 100).toFixed(1);
            stats.push(`扩展${expansionPercent}%`);
        } else {
            stats.push(`无变化`);
        }
    }
    
    // 显示图片数量
    if (imageCount > 0) {
        stats.push(`${imageCount} 张图片`);
    }
    
    return stats.join(' · ') || '暂无统计信息'; 
}

export async function copyToClipboard(text) {
    try {
        // 检查Clipboard API是否可用（包括安全上下文检查）
        if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // 降级到传统的document.execCommand方法
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed'; 
            textArea.style.left = '-999px';
            textArea.style.top = '-999px';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            } catch (err) {
                document.body.removeChild(textArea);
                console.error('Fallback copy failed:', err);
                return false;
            }
        }
    } catch (error) {
        console.error('复制失败:', error);
        return false;
    }
}

export function generateErrorReportText(errorMessage, currentUrl, userAgent) {
    return `您好，我在使用悟流时遇到了问题：\n\n错误信息: ${errorMessage}\n转化URL: ${currentUrl || '未提供'}\n发生时间: ${new Date().toLocaleString('zh-CN')}\n浏览器信息: ${userAgent}\n\n复现步骤或补充说明:\n[请在此处填写]\n\n感谢您的反馈！`;
} 