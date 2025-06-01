const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const ModelManager = require('./lib/modelManager');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// 初始化模型管理器
const modelManager = new ModelManager();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 缓存对象
const urlCache = new Map();

// 读取提示词
async function loadPrompt() {
    try {
        const promptPath = path.join(__dirname, 'prompts', 'transform-prompt.txt');
        const prompt = await fs.readFile(promptPath, 'utf-8');
        return prompt.trim();
    } catch (error) {
        console.error('读取提示词文件失败:', error);
        return '你是一个知识转化助手，请将以下内容转化为简洁、生动的文本。';
    }
}

// 提取URL内容
async function extractUrlContent(url) {
    // 检查缓存
    if (urlCache.has(url)) {
        console.log('从缓存获取内容:', url);
        const cachedData = urlCache.get(url);
        // 兼容旧的缓存格式（纯字符串）
        if (typeof cachedData === 'string') {
            return {
                content: cachedData,
                images: [],
                imageCount: 0
            };
        }
        return cachedData;
    }

    // 带重试的HTTP请求函数
    async function fetchWithRetry(url, maxRetries = 3) {
        const delays = [1000, 2000, 3000]; // 重试延迟（毫秒）
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                console.log(`尝试获取内容 (第${attempt + 1}次): ${url}`);
                
                // 根据域名调整请求策略
                const domain = new URL(url).hostname;
                const requestConfig = getRequestConfig(domain, attempt);
                
                const response = await axios.get(url, requestConfig);
                
                if (response.status === 200 && response.data) {
                    console.log(`成功获取内容: ${url}`);
                    return response;
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                
            } catch (error) {
                console.log(`第${attempt + 1}次尝试失败:`, error.message);
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // 等待后重试
                if (delays[attempt]) {
                    console.log(`等待 ${delays[attempt]}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delays[attempt]));
                }
            }
        }
    }
    
    // 根据不同域名配置请求参数
    function getRequestConfig(domain, attempt) {
        const baseHeaders = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Connection': 'keep-alive'
        };

        // User-Agent轮换
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0'
        ];
        
        const config = {
            timeout: 15000 + (attempt * 5000), // 逐步增加超时时间
            headers: {
                ...baseHeaders,
                'User-Agent': userAgents[attempt % userAgents.length]
            },
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400
        };

        // AWS 特殊处理
        if (domain.includes('amazonaws.com') || domain.includes('aws.amazon.com')) {
            config.headers['Accept-Language'] = 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7';
            config.headers['DNT'] = '1';
            config.timeout = 20000;
        }
        
        // GitHub 特殊处理
        if (domain.includes('github.com')) {
            config.headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
        }
        
        // 中文网站特殊处理
        if (domain.includes('.cn') || domain.includes('baidu.com') || domain.includes('zhihu.com')) {
            config.headers['Accept-Language'] = 'zh-CN,zh;q=0.9';
        }

        return config;
    }

    try {
        const response = await fetchWithRetry(url);

        const $ = cheerio.load(response.data);
        
        // 移除不需要的元素
        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('header').remove();
        $('footer').remove();
        $('.advertisement').remove();
        $('.ads').remove();
        
        // 尝试提取主要内容和图片
        let content = '';
        let images = [];
        
        // 优先从常见的内容区域提取
        const contentSelectors = [
            // 通用文章选择器
            'article',
            '.content',
            '.post-content',
            '.entry-content', 
            '.article-content',
            'main',
            '.main-content',
            '.page-content',
            '.post',
            '.entry',
            
            // AWS文档特定选择器
            '.awsdocs-container',
            '.main-content-wrapper',
            '.awsdocs-content',
            '#main-content',
            
            // GitHub特定选择器
            '.markdown-body',
            '.readme',
            '.entry-content',
            
            // 博客平台选择器
            '.article-body',
            '.post-body',
            '.content-body',
            '.text-content',
            '.article-text',
            
            // 新闻网站选择器
            '.article-wrapper',
            '.story-content',
            '.news-content',
            '.article-container',
            
            // 中文网站选择器
            '.content-area',
            '.main-text',
            '.article-detail',
            '.content-wrap'
        ];
        
        let contentElement = null;
        let bestContent = '';
        let bestScore = 0;
        
        // 尝试所有选择器，选择内容最多的
        for (const selector of contentSelectors) {
            const element = $(selector);
            if (element.length > 0) {
                const text = element.text().trim();
                const score = text.length;
                
                if (score > bestScore && score > 100) { // 至少100字符
                    bestScore = score;
                    bestContent = text;
                    contentElement = element;
                }
            }
        }
        
        content = bestContent;
        
        // 如果没有找到特定区域，尝试从body提取
        if (!content || content.length < 100) {
            console.log('未找到主要内容区域，尝试从body提取');
            contentElement = $('body');
            content = $('body').text().trim();
            
            // 如果body内容太少，尝试其他方法
            if (content.length < 100) {
                // 尝试提取所有p标签内容
                const paragraphs = $('p').map((i, el) => $(el).text().trim()).get().join('\n\n');
                if (paragraphs.length > content.length) {
                    content = paragraphs;
                    console.log('使用段落内容提取');
                }
                
                // 尝试提取所有div内容
                if (content.length < 100) {
                    const divContent = $('div').filter((i, el) => {
                        const text = $(el).text().trim();
                        return text.length > 50 && text.length < 2000;
                    }).map((i, el) => $(el).text().trim()).get().join('\n\n');
                    
                    if (divContent.length > content.length) {
                        content = divContent;
                        console.log('使用div内容提取');
                    }
                }
            }
        }
        
        // 提取图片信息
        if (contentElement) {
            const imageElements = contentElement.find('img');
            imageElements.each((index, img) => {
                const $img = $(img);
                const src = $img.attr('src');
                const alt = $img.attr('alt') || '';
                const title = $img.attr('title') || '';
                const caption = $img.closest('figure').find('figcaption').text().trim() || '';
                
                if (src && !src.startsWith('data:')) { // 过滤掉base64图片
                    // 将相对路径转换为绝对路径
                    let absoluteSrc = src;
                    if (src.startsWith('/')) {
                        const urlObj = new URL(url);
                        absoluteSrc = `${urlObj.protocol}//${urlObj.host}${src}`;
                    } else if (src.startsWith('./') || !src.includes('://')) {
                        absoluteSrc = new URL(src, url).href;
                    }
                    
                    images.push({
                        src: absoluteSrc,
                        alt: alt,
                        title: title,
                        caption: caption,
                        context: $img.parent().text().trim().substring(0, 200) // 获取图片周围的文本上下文
                    });
                }
            });
        }
        
        // 清理文本
        content = content
            .replace(/\s+/g, ' ')  // 多个空白字符替换为单个空格
            .replace(/\n\s*\n/g, '\n\n')  // 多个换行符保留为双换行
            .trim();
            
        // 限制内容长度（避免token过多）
        if (content.length > 15000) {
            content = content.substring(0, 15000) + '...';
        }
        
        // 最终内容验证
        if (!content || content.length < 50) {
            console.error('内容提取失败详情:', {
                url,
                contentLength: content ? content.length : 0,
                htmlLength: response.data ? response.data.length : 0,
                title: $('title').text().trim(),
                hasBody: $('body').length > 0,
                bodyLength: $('body').text().trim().length
            });
            
            throw new Error(`无法提取有效内容。URL: ${url} 提取到的内容长度: ${content ? content.length : 0} 字符`);
        }
        
        // 记录成功提取的信息
        console.log(`成功提取内容: ${url}`, {
            contentLength: content.length,
            imageCount: images.length,
            title: $('title').text().trim().substring(0, 100),
            contentPreview: content.substring(0, 100) + '...'
        });
        
        // 准备返回的数据
        const extractedData = {
            content: content,
            images: images,
            imageCount: images.length,
            title: $('title').text().trim(),
            url: url,
            extractedAt: new Date().toISOString()
        };
        
        // 缓存内容（24小时过期）
        urlCache.set(url, extractedData);
        setTimeout(() => {
            urlCache.delete(url);
        }, 24 * 60 * 60 * 1000);
        
        return extractedData;
        
    } catch (error) {
        const errorMessage = `无法获取URL内容: ${url}`;
        const errorDetails = {
            url,
            error: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            timestamp: new Date().toISOString()
        };
        
        console.error('提取URL内容失败:', errorDetails);
        
        // 根据错误类型提供更具体的错误信息
        if (error.code === 'ENOTFOUND') {
            throw new Error(`${errorMessage} - 域名解析失败，请检查网址是否正确`);
        } else if (error.code === 'ECONNREFUSED') {
            throw new Error(`${errorMessage} - 连接被拒绝，服务器可能不可用`);
        } else if (error.code === 'ETIMEDOUT') {
            throw new Error(`${errorMessage} - 请求超时，网络或服务器响应较慢`);
        } else if (error.response?.status === 403) {
            throw new Error(`${errorMessage} - 访问被禁止，网站可能有反爬虫保护`);
        } else if (error.response?.status === 404) {
            throw new Error(`${errorMessage} - 页面不存在`);
        } else if (error.response?.status === 429) {
            throw new Error(`${errorMessage} - 请求过于频繁，请稍后再试`);
        } else if (error.response?.status >= 500) {
            throw new Error(`${errorMessage} - 服务器内部错误 (${error.response.status})`);
        } else {
            throw new Error(`${errorMessage} - ${error.message}`);
        }
    }
}

// 调用AI模型进行内容转化
async function transformContent(extractedData, style, complexity) {
    const { content, images, imageCount } = extractedData;
    const basePrompt = await loadPrompt();
    
    // 复杂程度说明（保留这个选项，因为确实影响读者理解层次）
    let complexityInstruction = '';
    switch (complexity) {
        case 'beginner':
            complexityInstruction = '内容应适合初学者理解，使用简单易懂的语言，多用基础概念解释。';
            break;
        case 'intermediate':
            complexityInstruction = '内容应适合有一定基础的读者，可以包含一些专业术语，但要确保解释清楚。';
            break;
        default:
            complexityInstruction = '内容应适合初学者理解，使用简单易懂的语言。';
    }
    
    // 构建图片信息
    let imageSection = '';
    if (images && images.length > 0) {
        imageSection = `\n\n= 文章中的图片信息 =\n本文包含 ${imageCount} 张图片，以下是图片的相关信息：\n\n`;
        images.forEach((img, index) => {
            imageSection += `图片 ${index + 1}:\n`;
            if (img.alt) imageSection += `- 描述：${img.alt}\n`;
            if (img.title) imageSection += `- 标题：${img.title}\n`;
            if (img.caption) imageSection += `- 说明：${img.caption}\n`;
            if (img.context) imageSection += `- 上下文：${img.context}\n`;
            imageSection += `- 链接：${img.src}\n\n`;
        });
        imageSection += '请在转化后的内容中：\n1. 对重要图片进行描述和总结\n2. 解释图片与文章内容的关系\n3. 如果图片有助于理解，请在适当位置提及\n4. 可以使用markdown的图片语法：![描述](链接)\n\n';
    }

    const finalPrompt = `${basePrompt}\n\n${complexityInstruction}${imageSection}\n\n请转化以下内容，确保输出完整、详细的内容（目标长度1000-2000字）：\n\n${content}`;
    
    // 服务端自动选择最佳模型
    const modelId = modelManager.selectBestModel();
    
    // 验证模型是否支持
    if (!modelManager.isValidModel(modelId)) {
        throw new Error(`不支持的模型: ${modelId}`);
    }

    const apiKey = modelManager.getDefaultApiKey(modelId);
    
    if (!apiKey || apiKey === 'test_key') {
        throw new Error(`未配置${modelManager.getModelConfig(modelId).name}的API密钥`);
    }

    console.log(`使用模型: ${modelManager.getModelConfig(modelId).name}`);
    
    try {
        const messages = [
            {
                role: 'user',
                content: finalPrompt
            }
        ];
        
        return await modelManager.callModel(modelId, messages, apiKey);
        
    } catch (error) {
        console.error('AI模型调用失败:', error.message);
        throw error;
    }
}

// API路由
app.post('/api/transform', async (req, res) => {
    try {
        const { url, complexity = 'beginner' } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: '请提供URL地址' });
        }
        
        // 验证URL格式
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ error: '无效的URL格式' });
        }
        
        console.log(`开始处理URL: ${url}`);
        
        // 提取内容和图片
        const extractedData = await extractUrlContent(url);
        console.log(`提取内容成功，长度: ${extractedData.content.length} 字符，图片: ${extractedData.imageCount} 张`);
        
        // 转化内容（AI自动选择风格，服务端自动选择模型）
        const result = await transformContent(extractedData, null, complexity);
        console.log(`内容转化成功，转化后长度: ${result.length} 字符`);
        
        // 检查是否可能被截断
        if (result.length < 500) {
            console.warn('警告: 转化结果长度较短，可能存在截断问题');
        }
        
        // 获取实际使用的模型信息
        const usedModel = modelManager.selectBestModel();
        
        res.json({ 
            success: true, 
            result: result,
            originalLength: extractedData.content.length,
            transformedLength: result.length,
            imageCount: extractedData.imageCount,
            images: extractedData.images.map(img => ({
                alt: img.alt,
                title: img.title,
                caption: img.caption
            })), // 只返回安全的图片信息，不包含完整URL
            model: usedModel
        });
        
    } catch (error) {
        console.error('转化处理错误:', error);
        res.status(500).json({ 
            error: error.message || '处理请求时发生错误'
        });
    }
});

// 新的流式API端点
app.post('/api/transform-stream', async (req, res) => {
    try {
        const { url, complexity = 'beginner' } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: '请提供URL地址' });
        }
        
        // 验证URL格式
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ error: '无效的URL格式' });
        }
        
        // 设置SSE响应头
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });
        
        // 发送初始化信息
        res.write(`data: ${JSON.stringify({ type: 'init', message: '开始处理请求...' })}\n\n`);
        
        console.log(`开始流式处理URL: ${url}`);
        
        try {
            // 第一步：提取内容
            res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'extracting', message: '正在提取网页内容...' })}\n\n`);
            
            const extractedData = await extractUrlContent(url);
            console.log(`提取内容成功，长度: ${extractedData.content.length} 字符，图片: ${extractedData.imageCount} 张`);
            
            res.write(`data: ${JSON.stringify({ 
                type: 'progress', 
                stage: 'extracted', 
                message: `内容提取完成，共 ${extractedData.content.length} 字符，${extractedData.imageCount} 张图片`,
                data: {
                    originalLength: extractedData.content.length,
                    imageCount: extractedData.imageCount
                }
            })}\n\n`);
            
            // 第二步：AI转化 - 使用流式输出
            res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'transforming', message: '正在进行AI智能转化...' })}\n\n`);
            
            const usedModel = modelManager.selectBestModel();
            res.write(`data: ${JSON.stringify({ 
                type: 'progress', 
                stage: 'model_selected', 
                message: `使用 ${modelManager.getModelConfig(usedModel).name} 进行转化`,
                data: { model: usedModel }
            })}\n\n`);
            
            // 调用流式转化
            const result = await transformContentStream(extractedData, null, complexity, (chunk) => {
                // 实时推送AI生成的内容块
                res.write(`data: ${JSON.stringify({ 
                    type: 'content_chunk', 
                    chunk: chunk,
                    message: '正在生成内容...'
                })}\n\n`);
            });
            
            console.log(`流式内容转化成功，转化后长度: ${result.length} 字符`);
            
            // 发送完成信息
            res.write(`data: ${JSON.stringify({ 
                type: 'complete', 
                message: '转化完成！',
                data: {
                    result: result,
                    originalLength: extractedData.content.length,
                    transformedLength: result.length,
                    imageCount: extractedData.imageCount,
                    images: extractedData.images.map(img => ({
                        alt: img.alt,
                        title: img.title,
                        caption: img.caption
                    })),
                    model: usedModel
                }
            })}\n\n`);
            
            res.write(`data: [DONE]\n\n`);
            res.end();
            
        } catch (error) {
            console.error('流式转化处理错误:', error);
            res.write(`data: ${JSON.stringify({ 
                type: 'error', 
                error: error.message || '处理请求时发生错误' 
            })}\n\n`);
            res.end();
        }
        
    } catch (error) {
        console.error('流式API初始化错误:', error);
        res.status(500).json({ 
            error: error.message || '处理请求时发生错误'
        });
    }
});

// 流式内容转化函数
async function transformContentStream(extractedData, style, complexity, onChunk) {
    const { content, images, imageCount } = extractedData;
    const basePrompt = await loadPrompt();
    
    // 复杂程度说明（保留这个选项，因为确实影响读者理解层次）
    let complexityInstruction = '';
    switch (complexity) {
        case 'beginner':
            complexityInstruction = '内容应适合初学者理解，使用简单易懂的语言，多用基础概念解释。';
            break;
        case 'intermediate':
            complexityInstruction = '内容应适合有一定基础的读者，可以包含一些专业术语，但要确保解释清楚。';
            break;
        default:
            complexityInstruction = '内容应适合初学者理解，使用简单易懂的语言。';
    }
    
    // 构建图片信息
    let imageSection = '';
    if (images && images.length > 0) {
        imageSection = `\n\n= 文章中的图片信息 =\n本文包含 ${imageCount} 张图片，以下是图片的相关信息：\n\n`;
        images.forEach((img, index) => {
            imageSection += `图片 ${index + 1}:\n`;
            if (img.alt) imageSection += `- 描述：${img.alt}\n`;
            if (img.title) imageSection += `- 标题：${img.title}\n`;
            if (img.caption) imageSection += `- 说明：${img.caption}\n`;
            if (img.context) imageSection += `- 上下文：${img.context}\n`;
            imageSection += `- 链接：${img.src}\n\n`;
        });
        imageSection += '请在转化后的内容中：\n1. 对重要图片进行描述和总结\n2. 解释图片与文章内容的关系\n3. 如果图片有助于理解，请在适当位置提及\n4. 可以使用markdown的图片语法：![描述](链接)\n\n';
    }
    
    const finalPrompt = `${basePrompt}\n\n${complexityInstruction}${imageSection}\n\n请转化以下内容，确保输出完整、详细的内容（目标长度1000-2000字）：\n\n${content}`;
    
    // 服务端自动选择最佳模型
    const modelId = modelManager.selectBestModel();
    
    // 验证模型是否支持
    if (!modelManager.isValidModel(modelId)) {
        throw new Error(`不支持的模型: ${modelId}`);
    }

    const apiKey = modelManager.getDefaultApiKey(modelId);
    
    if (!apiKey || apiKey === 'test_key') {
        throw new Error(`未配置${modelManager.getModelConfig(modelId).name}的API密钥`);
    }

    console.log(`使用模型进行流式转化: ${modelManager.getModelConfig(modelId).name}`);
    
    try {
        const messages = [
            {
                role: 'user',
                content: finalPrompt
            }
        ];
        
        // 使用流式调用，并在回调中推送内容块
        return await callModelWithStreamCallback(modelManager, modelId, messages, apiKey, onChunk);
        
    } catch (error) {
        console.error('AI模型流式调用失败:', error.message);
        throw error;
    }
}

// 带回调的流式模型调用
async function callModelWithStreamCallback(modelManager, modelId, messages, apiKey, onChunk) {
    const config = modelManager.getModelConfig(modelId);
    
    if (!apiKey) {
        throw new Error(`${config.name} 需要API密钥`);
    }

    const params = {
        model: config.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature
    };

    console.log(`\n🌊 开始流式调用 ${config.name} API (带前端回调)`);

    const startTime = Date.now();

    try {
        let requestData;
        
        // 如果有自定义请求格式器，使用它
        if (config.formatRequest) {
            requestData = config.formatRequest(messages, params);
        } else {
            // 使用标准OpenAI格式
            requestData = {
                model: params.model,
                messages: messages,
                max_tokens: params.maxTokens,
                temperature: params.temperature
            };
        }

        // 添加流式参数
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
                
                console.log(`\n🌊 开始接收流式数据 (前端回调模式):`);

                res.on('data', (chunk) => {
                    const chunkStr = chunk.toString();
                    
                    buffer += chunkStr;
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // 保留最后一个可能不完整的行

                    for (const line of lines) {
                        if (line.trim() === '') continue;
                        
                        // 通义千问的特殊SSE格式处理
                        if (line.startsWith('data:')) {
                            const data = line.slice(5).trim();
                            
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
                                    
                                    // 推送新增内容到前端
                                    if (newText && newText.length > 0) {
                                        onChunk(newText); // 调用回调函数推送到前端
                                        fullResponse += newText;
                                    }
                                }
                                // 处理其他格式的流式响应 (OpenAI格式)
                                else if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                                    const newPart = parsed.choices[0].delta.content;
                                    onChunk(newPart); // 调用回调函数推送到前端
                                    fullResponse += newPart;
                                }
                            } catch (parseError) {
                                console.error(`\n⚠️  解析流式数据失败: ${data.substring(0, 100)}, 错误: ${parseError.message}`);
                            }
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
        
    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.error(`\n❌ ${config.name} 流式API调用失败! 耗时: ${duration}ms`);
        console.error(`🔍 错误类型: ${error.name || 'Unknown'}`);
        console.error(`💬 错误消息: ${error.message}`);
        
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

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        cacheSize: urlCache.size
    });
});

// 获取模型配置信息
app.get('/api/models', (req, res) => {
    try {
        const availableModels = modelManager.getAvailableModels();
        const selectedModel = modelManager.loadSelectedModel();
        const modelPriority = modelManager.loadModelPriority();
        const currentModel = modelManager.selectBestModel();
        
        // 检查各模型的API密钥状态
        const modelStatus = availableModels.map(model => {
            const apiKey = modelManager.getDefaultApiKey(model.id);
            const hasValidKey = apiKey && apiKey !== 'test_key';
            return {
                ...model,
                hasValidKey,
                isSelected: model.id === selectedModel,
                isCurrent: model.id === currentModel
            };
        });

        res.json({
            selectedModel,
            currentModel,
            priority: modelPriority,
            models: modelStatus
        });
    } catch (error) {
        console.error('获取模型配置失败:', error);
        res.status(500).json({ error: '获取模型配置失败' });
    }
});

// 根路径重定向到主页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, HOST, () => {
    console.log(`悟流服务器运行在 http://${HOST}:${PORT}`);
    console.log('按 Ctrl+C 停止服务器');
});