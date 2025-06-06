const express = require('express');
const session = require('express-session');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const ModelManager = require('./lib/modelManager');
const PDFExtractor = require('./lib/pdfExtractor');
const DatabaseManager = require('./lib/database');
const FileCleanupManager = require('./lib/fileCleanup');
const UrlUtils = require('./lib/urlUtils');
const contentValidator = require('./lib/contentValidator');
const configManager = require('./lib/configManager');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// 管理员配置
const ADMIN_CONFIG = {
    username: process.env.admin || 'admin',
    password: process.env.password || 'password'
};

// 初始化管理器
const modelManager = new ModelManager();
const pdfExtractor = new PDFExtractor();
const databaseManager = new DatabaseManager();
const fileCleanupManager = new FileCleanupManager(databaseManager);
const urlUtils = new UrlUtils();

// 中间件
app.use(cors());
app.use(express.json());

// 会话配置
app.use(session({
    secret: process.env.SESSION_SECRET || 'stream-wisdom-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // 开发环境设为false，生产环境应该为true（需要HTTPS）
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24小时
    }
}));

app.use(express.static('public'));

// 缓存对象
const urlCache = new Map();

// 读取提示词
async function loadPrompt() {
    try {
        const promptPath = path.join(__dirname, '../../prompts', 'transform-prompt.txt');
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

    // 检查是否是PDF，如果是则使用PDF提取器
    try {
        // 优化学术PDF URL
        const optimizedUrl = pdfExtractor.optimizeAcademicPdfUrl(url);
        
        if (pdfExtractor.isPdfUrl(optimizedUrl) || pdfExtractor.isPdfUrl(url)) {
            console.log('🔍 检测到PDF文件，使用专门的PDF提取器');
            const pdfData = await pdfExtractor.extractPdfFromUrl(optimizedUrl);
            
            // 缓存PDF内容
            urlCache.set(url, pdfData);
            setTimeout(() => {
                urlCache.delete(url);
            }, 24 * 60 * 60 * 1000);
            
            return pdfData;
        }
    } catch (pdfError) {
        // 检查是否是明确的PDF URL
        const isPdfUrl = pdfExtractor.isPdfUrl(url) || url.toLowerCase().includes('.pdf') || 
                        url.includes('/doi/pdf/') || url.includes('/content/pdf/') || 
                        url.includes('/stamp/stamp.jsp') || url.includes('arxiv.org/pdf/');
        
        if (isPdfUrl) {
            console.error('PDF提取失败，且URL明确指向PDF文件，停止处理:', pdfError.message);
            // 对于明确的PDF URL，不要尝试HTML提取，直接抛出错误
            throw new Error(`PDF文件处理失败：${pdfError.message}`);
        } else {
            console.log('PDF提取失败，但URL可能不是PDF，尝试常规HTML提取:', pdfError.message);
            // 如果URL不明确是PDF，则继续尝试HTML提取
        }
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
            
        // 保留完整内容，不进行截断
        // 如果内容过长，交给后续处理环节根据需要进行智能截取
        // 这样可以确保AI校验看到的是完整的原始内容
        
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

    // 智能处理超长内容：如果内容过长，进行智能截取
    let processedContent = content;
    if (content.length > 60000) {
        // 对于特别长的内容，保留开头、多个中段和结尾，确保内容均衡
        const start = content.substring(0, 18000);                    // 开头18k字符
        const quarter = content.substring(Math.floor(content.length * 0.25), Math.floor(content.length * 0.25) + 12000);  // 1/4位置12k字符
        const middle = content.substring(Math.floor(content.length * 0.5), Math.floor(content.length * 0.5) + 12000);      // 中间12k字符  
        const threequarter = content.substring(Math.floor(content.length * 0.75), Math.floor(content.length * 0.75) + 8000); // 3/4位置8k字符
        const end = content.substring(Math.max(0, content.length - 10000));  // 结尾10k字符
        
        processedContent = start + '\n\n' + quarter + '\n\n' + middle + '\n\n' + threequarter + '\n\n' + end;
        
        console.log(`内容过长(${content.length}字符)，已智能截取到${processedContent.length}字符，保持结构完整性`);
    }

    const finalPrompt = `${basePrompt}\n\n${complexityInstruction}${imageSection}\n\n请转化以下内容，确保输出完整、详细的内容（目标长度1000-2000字）：\n\n${processedContent}`;
    
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
        
        const result = await modelManager.callModel(modelId, messages, apiKey);
        
        // 计算和记录压缩率统计
        const originalLength = content.length;
        const transformedLength = result.length;
        const compressionRatio = (transformedLength / originalLength).toFixed(3);
        
        console.log(`📊 内容转化统计:`);
        console.log(`   原始长度: ${originalLength.toLocaleString()} 字符`);
        console.log(`   转化后长度: ${transformedLength.toLocaleString()} 字符`);
        console.log(`   压缩率: ${compressionRatio} (${(compressionRatio * 100).toFixed(1)}%)`);
        
        if (compressionRatio > 1) {
            console.log(`   📈 内容扩展: 增加了 ${(transformedLength - originalLength).toLocaleString()} 字符`);
        } else {
            console.log(`   📉 内容压缩: 减少了 ${(originalLength - transformedLength).toLocaleString()} 字符`);
        }
        
        return result;
        
    } catch (error) {
        console.error('AI模型调用失败:', error.message);
        throw error;
    }
}

// API路由

// 管理员登录API
app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码不能为空' });
        }
        
        if (username === ADMIN_CONFIG.username && password === ADMIN_CONFIG.password) {
            req.session.isAdmin = true;
            req.session.loginTime = new Date();
            console.log('管理员登录成功');
            res.json({ success: true, message: '登录成功' });
        } else {
            console.log('管理员登录失败：用户名或密码错误');
            res.status(401).json({ error: '用户名或密码错误' });
        }
    } catch (error) {
        console.error('管理员登录错误:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

// 管理员登出API
app.post('/api/admin/logout', (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('登出失败:', err);
                return res.status(500).json({ error: '登出失败' });
            }
            res.json({ success: true, message: '登出成功' });
        });
    } catch (error) {
        console.error('登出错误:', error);
        res.status(500).json({ error: '登出失败' });
    }
});

// 检查管理员状态API
app.get('/api/admin/status', (req, res) => {
    res.json({ 
        isAdmin: !!req.session.isAdmin,
        loginTime: req.session.loginTime || null
    });
});

// 获取压缩率统计API（管理员功能）
app.get('/api/admin/compression-stats', async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.status(401).json({ error: '需要管理员权限' });
        }

        const stats = await databaseManager.getCompressionStatistics();
        
        res.json({
            success: true,
            statistics: {
                totalTransformations: stats.total_transformations || 0,
                averageCompressionRatio: parseFloat((stats.avg_compression_ratio || 0).toFixed(3)),
                minCompressionRatio: parseFloat((stats.min_compression_ratio || 0).toFixed(3)),
                maxCompressionRatio: parseFloat((stats.max_compression_ratio || 0).toFixed(3)),
                averageOriginalLength: Math.round(stats.avg_original_length || 0),
                averageTransformedLength: Math.round(stats.avg_transformed_length || 0),
                expansionCount: stats.expansion_count || 0,
                compressionCount: stats.compression_count || 0,
                expansionPercentage: stats.total_transformations > 0 ? 
                    parseFloat(((stats.expansion_count / stats.total_transformations) * 100).toFixed(1)) : 0,
                compressionPercentage: stats.total_transformations > 0 ? 
                    parseFloat(((stats.compression_count / stats.total_transformations) * 100).toFixed(1)) : 0
            }
        });
    } catch (error) {
        console.error('获取压缩率统计失败:', error);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

// URL检查API - 检查是否已存在转化
app.post('/api/check-url', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: '缺少URL参数' });
        }

        // 标准化URL
        const normalizedUrl = urlUtils.normalizeUrl(url);
        console.log(`检查URL重复: ${url} -> ${normalizedUrl}`);

        // 查询数据库中是否已存在相同的标准化URL
        const existingTransformation = await databaseManager.getTransformationByUrl(normalizedUrl);

        if (existingTransformation) {
            res.json({
                exists: true,
                isAdmin: !!req.session.isAdmin, // 添加管理员状态
                transformation: {
                    uuid: existingTransformation.uuid,
                    title: existingTransformation.title,
                    created_at: existingTransformation.created_at,
                    style: existingTransformation.style,
                    complexity: existingTransformation.complexity,
                    shareUrl: `${req.protocol}://${req.get('host')}/share/${existingTransformation.uuid}`
                }
            });
        } else {
            res.json({ 
                exists: false,
                isAdmin: !!req.session.isAdmin
            });
        }
    } catch (error) {
        console.error('URL检查失败:', error);
        res.status(500).json({ error: 'URL检查失败' });
    }
});

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
        
        // 校验内容是否有意义
        console.log('开始校验内容质量...');
        const validation = await contentValidator.validateContent(extractedData, modelManager);
        console.log('内容校验结果:', validation);
        
        if (!validation.isValid) {
            return res.status(400).json({ 
                error: `内容校验失败: ${validation.reason}`,
                suggestion: '请检查URL是否正确，或者该页面是否包含有效内容。'
            });
        }
        
        // 转化内容（AI自动选择风格，服务端自动选择模型）
        const result = await transformContent(extractedData, null, complexity);
        console.log(`内容转化成功，转化后长度: ${result.length} 字符`);
        
        // 检查是否可能被截断
        if (result.length < 500) {
            console.warn('警告: 转化结果长度较短，可能存在截断问题');
        }
        
        // 获取实际使用的模型信息
        const usedModel = modelManager.selectBestModel();
        
        // 生成标题（从URL或内容中提取）
        let title = '';
        try {
            const urlObj = new URL(url);
            title = urlObj.hostname + urlObj.pathname;
            // 尝试从转化内容中提取更好的标题
            const titleMatch = result.match(/^#\s*(.+)$/m);
            if (titleMatch) {
                title = titleMatch[1].trim();
            }
        } catch {
            title = url.substring(0, 100);
        }
        
        // 保存转化结果到数据库
        let transformationUuid = null;
        try {
            const normalizedUrl = urlUtils.normalizeUrl(url);
            const originalLength = extractedData.content.length;
            const transformedLength = result.length;
            const compressionRatio = transformedLength / originalLength;
            
            const saveResult = await databaseManager.saveTransformation({
                title: title,
                originalUrl: normalizedUrl, // 保存标准化的URL
                transformedContent: result,
                style: 'auto',
                complexity: complexity,
                imageCount: extractedData.imageCount,
                images: extractedData.images,
                originalLength: originalLength,
                transformedLength: transformedLength,
                compressionRatio: compressionRatio
            });
            transformationUuid = saveResult.uuid;
            const action = saveResult.updated ? '覆盖更新' : '新建保存';
            console.log(`转化结果已${action}到数据库，UUID: ${transformationUuid}`);
        } catch (saveError) {
            console.error('保存到数据库失败:', saveError);
        }
        
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
            model: usedModel,
            shareUrl: transformationUuid ? `${req.protocol}://${req.get('host')}/share/${transformationUuid}` : null,
            uuid: transformationUuid
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
            
            // 第二步：校验内容质量
            res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'validating', message: '正在校验内容质量...' })}\n\n`);
            
            console.log('开始校验内容质量...');
            const validation = await contentValidator.validateContent(extractedData, modelManager);
            console.log('内容校验结果:', validation);
            
            if (!validation.isValid) {
                res.write(`data: ${JSON.stringify({ 
                    type: 'error', 
                    error: `内容校验失败: ${validation.reason}`,
                    suggestion: '请检查URL是否正确，或者该页面是否包含有效内容。'
                })}\n\n`);
                res.end();
                return;
            }
            
            res.write(`data: ${JSON.stringify({ 
                type: 'progress', 
                stage: 'validated', 
                message: `内容校验通过：${validation.reason}`,
                data: { validation: validation }
            })}\n\n`);
            
            // 第三步：AI转化 - 使用流式输出
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
            
            // 生成标题（从URL或内容中提取）
            let title = '';
            try {
                const urlObj = new URL(url);
                title = urlObj.hostname + urlObj.pathname;
                // 尝试从转化内容中提取更好的标题
                const titleMatch = result.match(/^#\s*(.+)$/m);
                if (titleMatch) {
                    title = titleMatch[1].trim();
                }
            } catch {
                title = url.substring(0, 100);
            }
            
            // 保存转化结果到数据库
            let transformationUuid = null;
            try {
                const normalizedUrl = urlUtils.normalizeUrl(url);
                const originalLength = extractedData.content.length;
                const transformedLength = result.length;
                const compressionRatio = transformedLength / originalLength;
                
                const saveResult = await databaseManager.saveTransformation({
                    title: title,
                    originalUrl: normalizedUrl, // 保存标准化的URL
                    transformedContent: result,
                    style: 'auto',
                    complexity: complexity,
                    imageCount: extractedData.imageCount,
                    images: extractedData.images,
                    originalLength: originalLength,
                    transformedLength: transformedLength,
                    compressionRatio: compressionRatio
                });
                transformationUuid = saveResult.uuid;
                const action = saveResult.updated ? '覆盖更新' : '新建保存';
                console.log(`转化结果已${action}到数据库，UUID: ${transformationUuid}`);
            } catch (saveError) {
                console.error('保存到数据库失败:', saveError);
            }
            
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
                    model: usedModel,
                    shareUrl: transformationUuid ? `${req.protocol}://${req.get('host')}/share/${transformationUuid}` : null,
                    uuid: transformationUuid
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
    
    // 智能处理超长内容：如果内容过长，进行智能截取
    let processedContent = content;
    if (content.length > 60000) {
        // 对于特别长的内容，保留开头、多个中段和结尾，确保内容均衡
        const start = content.substring(0, 18000);                    // 开头18k字符
        const quarter = content.substring(Math.floor(content.length * 0.25), Math.floor(content.length * 0.25) + 12000);  // 1/4位置12k字符
        const middle = content.substring(Math.floor(content.length * 0.5), Math.floor(content.length * 0.5) + 12000);      // 中间12k字符  
        const threequarter = content.substring(Math.floor(content.length * 0.75), Math.floor(content.length * 0.75) + 8000); // 3/4位置8k字符
        const end = content.substring(Math.max(0, content.length - 10000));  // 结尾10k字符
        
        processedContent = start + '\n\n' + quarter + '\n\n' + middle + '\n\n' + threequarter + '\n\n' + end;
        
        console.log(`流式转化：内容过长(${content.length}字符)，已智能截取到${processedContent.length}字符，保持结构完整性`);
    }
    
    const finalPrompt = `${basePrompt}\n\n${complexityInstruction}${imageSection}\n\n请转化以下内容，确保输出完整、详细的内容（目标长度1000-2000字）：\n\n${processedContent}`;
    
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
        const result = await callModelWithStreamCallback(modelManager, modelId, messages, apiKey, onChunk);
        
        // 计算和记录压缩率统计（流式模式）
        const originalLength = content.length;
        const transformedLength = result.length;
        const compressionRatio = (transformedLength / originalLength).toFixed(3);
        
        console.log(`📊 流式转化统计:`);
        console.log(`   原始长度: ${originalLength.toLocaleString()} 字符`);
        console.log(`   转化后长度: ${transformedLength.toLocaleString()} 字符`);
        console.log(`   压缩率: ${compressionRatio} (${(compressionRatio * 100).toFixed(1)}%)`);
        
        if (compressionRatio > 1) {
            console.log(`   📈 内容扩展: 增加了 ${(transformedLength - originalLength).toLocaleString()} 字符`);
        } else {
            console.log(`   📉 内容压缩: 减少了 ${(originalLength - transformedLength).toLocaleString()} 字符`);
        }
        
        return result;
        
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
            const isEnabled = modelManager.isModelEnabled(model.id);
            
            return {
                ...model,
                hasValidKey,
                isEnabled,
                isSelected: model.id === selectedModel,
                isCurrent: model.id === currentModel,
                // 添加状态描述
                status: getModelStatus(model.id, hasValidKey, isEnabled, model.id === selectedModel, model.id === currentModel)
            };
        });

        // 添加选择结果的说明
        const selectionInfo = getSelectionExplanation(selectedModel, currentModel, modelStatus);

        res.json({
            selectedModel,
            currentModel,
            priority: modelPriority,
            models: modelStatus,
            selectionInfo
        });
    } catch (error) {
        console.error('获取模型配置失败:', error);
        res.status(500).json({ error: '获取模型配置失败' });
    }
});



// 辅助函数：获取模型状态描述
function getModelStatus(modelId, hasValidKey, isEnabled, isSelected, isCurrent) {
    if (!isEnabled) {
        return { type: 'disabled', message: '模型已禁用' };
    }
    if (!hasValidKey) {
        return { type: 'no_key', message: '缺少API密钥' };
    }
    if (isSelected && isCurrent) {
        return { type: 'active', message: '选中且正在使用' };
    }
    if (isSelected && !isCurrent) {
        return { type: 'selected_unavailable', message: '选中但不可用，已自动切换' };
    }
    if (!isSelected && isCurrent) {
        return { type: 'fallback_active', message: '作为备选正在使用' };
    }
    if (hasValidKey && isEnabled) {
        return { type: 'available', message: '可用' };
    }
    return { type: 'unknown', message: '状态未知' };
}

// 辅助函数：获取选择结果说明
function getSelectionExplanation(selectedModel, currentModel, modelStatus) {
    if (selectedModel === currentModel) {
        return {
            type: 'success',
            message: `正在使用您选择的模型: ${getModelName(selectedModel, modelStatus)}`
        };
    } else if (selectedModel && currentModel !== selectedModel) {
        const selectedModelInfo = modelStatus.find(m => m.id === selectedModel);
        const currentModelInfo = modelStatus.find(m => m.id === currentModel);
        
        let reason = '未知原因';
        if (selectedModelInfo && !selectedModelInfo.hasValidKey) {
            reason = '缺少API密钥';
        } else if (selectedModelInfo && !selectedModelInfo.isEnabled) {
            reason = '模型已禁用';
        }
        
        return {
            type: 'fallback',
            message: `您选择的模型 ${getModelName(selectedModel, modelStatus)} 不可用(${reason})，已自动切换到 ${getModelName(currentModel, modelStatus)}`,
            selectedModel: selectedModelInfo?.name || selectedModel,
            currentModel: currentModelInfo?.name || currentModel,
            reason
        };
    } else {
        return {
            type: 'auto',
            message: `自动选择最佳模型: ${getModelName(currentModel, modelStatus)}`
        };
    }
}

// 辅助函数：获取模型显示名称
function getModelName(modelId, modelStatus) {
    const model = modelStatus.find(m => m.id === modelId);
    return model ? model.name : modelId;
}

// 新增API接口 - 获取已转化文件列表
app.get('/api/transformations', async (req, res) => {
    try {
        // 支持两种分页方式：传统分页(page)和偏移分页(offset)
        const page = parseInt(req.query.page);
        const offset = parseInt(req.query.offset);
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        
        // 计算实际offset
        let actualOffset;
        if (offset !== undefined) {
            actualOffset = offset;
        } else {
            const actualPage = page || 1;
            actualOffset = (actualPage - 1) * limit;
        }
        
        let transformations;
        let total;
        
        if (search) {
            // 搜索模式：需要调整数据库方法支持offset
            transformations = await databaseManager.searchTransformations(search, limit, actualOffset);
            total = await databaseManager.getSearchTransformationCount(search);
        } else {
            transformations = await databaseManager.getAllTransformations(limit, actualOffset);
            total = await databaseManager.getTransformationCount();
        }
        
        res.json({
            success: true,
            data: transformations,
            isAdmin: !!req.session.isAdmin, // 添加管理员状态
            pagination: {
                page: page || Math.floor(actualOffset / limit) + 1,
                limit: limit,
                offset: actualOffset,
                total: total,
                pages: Math.ceil(total / limit),
                hasMore: actualOffset + transformations.length < total
            }
        });
    } catch (error) {
        console.error('获取转化列表失败:', error);
        res.status(500).json({ error: '获取转化列表失败' });
    }
});

// 根据UUID获取转化内容
app.get('/api/transformations/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const transformation = await databaseManager.getTransformationByUuid(uuid);
        
        if (!transformation) {
            return res.status(404).json({ error: '转化内容不存在' });
        }
        
        res.json({
            success: true,
            data: transformation
        });
    } catch (error) {
        console.error('获取转化内容失败:', error);
        res.status(500).json({ error: '获取转化内容失败' });
    }
});

// 分享页面 - 通过UUID访问转化内容
app.get('/share/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const transformation = await databaseManager.getTransformationByUuid(uuid);
        
        if (!transformation) {
            return res.status(404).send(`
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>内容不存在 - 悟流</title>
                        <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                                   padding: 2rem; text-align: center; }
                            .error { color: #ef4444; }
                        </style>
                    </head>
                    <body>
                        <h1 class="error">内容不存在</h1>
                        <p>您访问的转化内容不存在或已被删除。</p>
                        <a href="/">返回首页</a>
                    </body>
                </html>
            `);
        }
        
        // 生成分享页面HTML
        const shareHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${transformation.title} - 悟流分享</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;500&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
    <style>
        body { font-family: 'Noto Serif SC', serif; }
        .markdown-content { 
            line-height: 1.8; 
            font-size: 1rem; /* 调整为与转化页面一致的字体大小 */
            color: #e2e8f0;
        }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 { 
            color: #3b82f6; margin: 1.5em 0 0.5em 0; font-weight: 600; 
        }
        .markdown-content h1 { font-size: 1.5em; border-bottom: 2px solid #3b82f6; padding-bottom: 0.3em; }
        .markdown-content h2 { font-size: 1.3em; }
        .markdown-content h3 { font-size: 1.1em; }
        .markdown-content p { margin: 1em 0; text-align: justify; }
        .markdown-content blockquote {
            border-left: 4px solid #3b82f6; padding-left: 1em; margin: 1em 0;
            background: rgba(59, 130, 246, 0.1); border-radius: 0 8px 8px 0;
        }
        .markdown-content code {
            background: rgba(59, 130, 246, 0.2); padding: 0.2em 0.4em; border-radius: 4px;
            font-family: SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
        }
        .markdown-content pre {
            background: rgba(15, 23, 42, 0.8); padding: 1em; border-radius: 8px; overflow-x: auto;
            border: 1px solid rgba(59, 130, 246, 0.2);
        }
        .markdown-content pre code {
            font-family: SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;
        }
        .markdown-content ul, .markdown-content ol { padding-left: 2em; margin: 1em 0; }
        .markdown-content li { margin: 0.5em 0; }
        .markdown-content em, .markdown-content i {
            font-size: 0.85em; color: rgba(148, 163, 184, 0.75); opacity: 0.8;
        }
        .source-link {
            color: #60a5fa;
            text-decoration: none;
            border-bottom: 1px solid rgba(96, 165, 250, 0.3);
            transition: all 0.2s ease;
        }
        .source-link:hover {
            color: #93c5fd;
            border-bottom-color: #93c5fd;
        }
    </style>
</head>
<body class="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
    <div class="container mx-auto max-w-6xl p-6"> <!-- 调整宽度与转化页面一致 -->
        <div class="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden">
            <!-- 品牌头部 -->
            <div class="bg-gradient-to-r from-slate-800/80 to-blue-800/80 px-8 py-6 border-b border-slate-700/50">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                        <!-- 品牌标识 -->
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                                <i class="fas fa-brain text-white text-xl"></i>
                            </div>
                            <div class="text-white">
                                <div class="text-xl font-semibold flex items-center space-x-2">
                                    <span>悟流</span>
                                    <span class="text-sm font-normal text-slate-300">/ Stream of Wisdom</span>
                                </div>
                                <div class="text-xs text-slate-400 opacity-75">将内容转化为知识，知识于在心中生根。</div>
                            </div>
                        </div>
                    </div>
                    <a href="/" class="text-slate-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-700/50">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                        </svg>
                    </a>
                </div>
                
                <!-- 文章信息 -->
                <div class="mt-4 pt-4 border-t border-slate-700/50">
                    <h1 class="text-xl font-semibold text-white mb-3">${transformation.title}</h1>
                    <div class="flex flex-col sm:flex-row sm:items-center sm:space-x-6 text-sm text-slate-300 space-y-2 sm:space-y-0">
                        <div class="flex items-center space-x-2">
                            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                            </svg>
                            <a href="${transformation.original_url}" target="_blank" rel="noopener noreferrer" class="source-link">
                                原文链接
                            </a>
                        </div>
                        <div class="flex items-center space-x-2">
                            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span>${new Date(transformation.created_at).toLocaleDateString('zh-CN')} ${new Date(transformation.created_at).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})}</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                            <span>复杂度: ${transformation.complexity === 'beginner' ? '初学者' : transformation.complexity === 'intermediate' ? '中级' : transformation.complexity === 'advanced' ? '高级' : transformation.complexity}</span>
                        </div>
                    </div>
                </div>
            </div>
            <!-- 内容区域 -->
            <div class="px-8 py-6">
                <div class="markdown-content prose prose-slate prose-invert max-w-none text-slate-200" id="markdownContent">
                    <!-- 内容将由JavaScript渲染 -->
                </div>
            </div>
            <script>
                // 配置marked.js
                if (typeof marked !== 'undefined') {
                    marked.setOptions({
                        breaks: true,
                        gfm: true,
                        headerIds: false,
                        mangle: false
                    });
                }
                
                // 渲染Markdown内容
                const markdownContent = \`${transformation.transformed_content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
                const contentElement = document.getElementById('markdownContent');
                
                if (contentElement && typeof marked !== 'undefined') {
                    try {
                        contentElement.innerHTML = marked.parse(markdownContent);
                    } catch (error) {
                        console.error('Markdown rendering error:', error);
                        // 降级到纯文本显示
                        contentElement.innerHTML = '<p>' + markdownContent.replace(/\\n/g, '<br>') + '</p>';
                    }
                } else {
                    // 降级到纯文本显示
                    if (contentElement) {
                        contentElement.innerHTML = '<p>' + markdownContent.replace(/\\n/g, '<br>') + '</p>';
                    }
                }
            </script>
            <div class="mt-8 pt-6 pb-8 border-t text-center">
                <a href="/" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                    </svg>
                    返回悟流首页
                </a>
            </div>
        </div>
    </div>
</body>
</html>
        `;
        
        res.send(shareHtml);
    } catch (error) {
        console.error('获取分享内容失败:', error);
        res.status(500).send('服务器错误');
    }
});

// 删除转化内容（仅管理员）
app.delete('/api/transformations/:uuid', async (req, res) => {
    try {
        // 检查管理员权限
        if (!req.session.isAdmin) {
            return res.status(403).json({ error: '需要管理员权限' });
        }

        const { uuid } = req.params;
        const deletedCount = await databaseManager.deleteTransformation(uuid);
        
        if (deletedCount === 0) {
            return res.status(404).json({ error: '转化内容不存在' });
        }

        console.log(`管理员删除转化记录: ${uuid}`);
        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        console.error('删除转化内容失败:', error);
        res.status(500).json({ error: '删除转化内容失败' });
    }
});

// 清理统计API
app.get('/api/cleanup/status', (req, res) => {
    try {
        const status = fileCleanupManager.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('获取清理状态失败:', error);
        res.status(500).json({ error: '获取清理状态失败' });
    }
});

// 手动执行清理
app.post('/api/cleanup/manual', async (req, res) => {
    try {
        const deletedCount = await fileCleanupManager.cleanupMissingFiles();
        res.json({
            success: true,
            message: `清理完成，删除了 ${deletedCount} 个无效记录`
        });
    } catch (error) {
        console.error('手动清理失败:', error);
        res.status(500).json({ error: '手动清理失败' });
    }
});

// 结果页面路由 - 与分享页面使用相同的数据但不同的展示
app.get('/result/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const transformation = await databaseManager.getTransformationByUuid(uuid);
        
        if (!transformation) {
            // 如果转化不存在，重定向到主页
            return res.redirect('/');
        }
        
        // 返回主页HTML，但带有数据标记，让前端知道要显示转化结果
        const html = await fs.readFile(path.join(__dirname, '../../public', 'index.html'), 'utf-8');
        
        // 在HTML中注入转化数据
        const htmlWithData = html.replace(
            '<script type="module" src="/app.js"></script>',
            `<script>
                window.INITIAL_TRANSFORMATION_DATA = ${JSON.stringify(transformation)};
                window.INITIAL_TRANSFORMATION_UUID = '${uuid}';
            </script>
            <script type="module" src="/app.js"></script>`
        );
        
        res.send(htmlWithData);
    } catch (error) {
        console.error('获取结果页面失败:', error);
        res.redirect('/');
    }
});

// 根路径重定向到主页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public', 'index.html'));
});

// 启动服务器
async function startServer() {
    try {
        // 初始化数据库
        await databaseManager.init();
        
        // 启动文件清理定时任务
        fileCleanupManager.startPeriodicCleanup();
        
        // 启动HTTP服务器
        app.listen(PORT, HOST, async () => {
            // 获取AI校验配置状态
            let aiValidationStatus = '启用';
            try {
                const isEnabled = await configManager.isAiValidationEnabled();
                aiValidationStatus = isEnabled ? '启用' : '禁用';
            } catch (error) {
                aiValidationStatus = '配置加载失败';
            }

            console.log('\n' + '='.repeat(60));
            console.log('🌟 悟流 / Stream of Wisdom 服务器已启动');
            console.log(`📡 访问地址: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
            console.log(`🧠 当前模型: ${modelManager.selectBestModel()}`);
            console.log(`🔍 AI校验: ${aiValidationStatus}`);
            console.log(`👑 管理员账户: ${ADMIN_CONFIG.username}`);
            console.log('💾 数据库已初始化');
            console.log('🧹 文件清理任务已启动');
            console.log('按 Ctrl+C 停止服务器');
            console.log('='.repeat(60) + '\n');
        });
        
        // 优雅关闭
        process.on('SIGINT', () => {
            console.log('\n正在关闭服务器...');
            fileCleanupManager.stopPeriodicCleanup();
            databaseManager.close();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
}

startServer();