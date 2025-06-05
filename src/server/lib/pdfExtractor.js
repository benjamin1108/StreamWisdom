const axios = require('axios');
const pdf = require('pdf-parse');

class PDFExtractor {
    constructor() {
        this.maxPdfSize = 50 * 1024 * 1024; // 50MB限制
        this.timeout = 30000; // 30秒超时
    }

    // 为不同网站获取合适的Referer
    getRefererForUrl(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            if (hostname.includes('arxiv.org')) {
                return 'https://arxiv.org/';
            } else if (hostname.includes('dl.acm.org')) {
                return 'https://dl.acm.org/';
            } else if (hostname.includes('ieee.org')) {
                return 'https://ieeexplore.ieee.org/';
            } else if (hostname.includes('researchgate.net')) {
                return 'https://www.researchgate.net/';
            } else if (hostname.includes('springer.com')) {
                return 'https://link.springer.com/';
            } else if (hostname.includes('nature.com')) {
                return 'https://www.nature.com/';
            }
            
            // 对于其他网站，使用主域名作为Referer
            return `https://${hostname}/`;
        } catch (error) {
            return undefined;
        }
    }

    // 检查URL是否是PDF
    isPdfUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            const hostname = urlObj.hostname.toLowerCase();
            
            // 检查文件扩展名
            if (pathname.endsWith('.pdf')) {
                return true;
            }
            
            // 检查查询参数中是否包含PDF相关信息
            const searchParams = urlObj.searchParams;
            if (searchParams.get('format') === 'pdf' || 
                searchParams.get('type') === 'pdf' ||
                pathname.includes('pdf')) {
                return true;
            }
            
            // 检查学术网站的PDF模式
            if (hostname.includes('dl.acm.org') && pathname.includes('/doi/pdf/')) {
                return true;
            }
            if (hostname.includes('ieeexplore.ieee.org') && pathname.includes('/stamp/')) {
                return true;
            }
            if (hostname.includes('link.springer.com') && pathname.includes('/content/pdf/')) {
                return true;
            }
            if (hostname.includes('arxiv.org') && pathname.includes('/pdf/')) {
                return true;
            }
            if (hostname.includes('researchgate.net') && pathname.includes('.pdf')) {
                return true;
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    // 下载PDF文件
    async downloadPdf(url) {
        console.log(`📄 开始下载PDF: ${url}`);
        
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: this.timeout,
                maxContentLength: this.maxPdfSize,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/pdf,*/*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Referer': this.getRefererForUrl(url),
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            // 验证响应是否真的是PDF
            const contentType = response.headers['content-type'] || '';
            const buffer = Buffer.from(response.data);
            
            // 检查是否遇到了Cloudflare或其他反爬虫保护
            const responseText = buffer.toString('utf8', 0, Math.min(1000, buffer.length));
            if (responseText.includes('Just a moment...') || 
                responseText.includes('Enable JavaScript and cookies') ||
                responseText.includes('cf-mitigated') ||
                responseText.includes('cloudflare')) {
                if (url.includes('dl.acm.org')) {
                    throw new Error('ACM数字图书馆启用了反爬虫保护，无法直接访问PDF。\n\n💡 建议：\n• 手动访问网站下载PDF后本地处理\n• 寻找该文章的开放获取版本\n• 使用机构网络访问');
                } else {
                    throw new Error('网站启用了反爬虫保护，需要浏览器环境才能访问');
                }
            }
            
            if (!contentType.includes('application/pdf') && !this.isPdfBuffer(buffer)) {
                throw new Error('下载的文件不是有效的PDF格式');
            }

            console.log(`✅ PDF下载成功，大小: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
            return buffer;

        } catch (error) {
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error('PDF下载超时，文件可能过大或网络较慢');
            } else if (error.code === 'ERR_FR_MAX_CONTENT_LENGTH_EXCEEDED') {
                throw new Error(`PDF文件过大（超过${this.maxPdfSize / 1024 / 1024}MB限制）`);
            } else if (error.response?.status === 403) {
                // 根据不同网站提供更具体的错误信息
                if (url.includes('dl.acm.org')) {
                    throw new Error('ACM数字图书馆PDF访问被拒绝。这可能是因为：\n\n🔒 访问限制：\n• 需要ACM会员权限或机构订阅\n• 文章可能不是开放获取（Open Access）\n• 需要通过学校或图书馆的网络访问\n\n🛡️ 反爬虫保护：\n• ACM使用了Cloudflare保护，阻止自动化访问\n\n💡 建议解决方案：\n• 通过有订阅权限的网络环境访问\n• 在Google Scholar或arXiv寻找该文章的开放版本\n• 联系作者获取预印本\n• 使用学校图书馆的数据库访问');
                } else if (url.includes('ieee.org')) {
                    throw new Error('IEEE PDF访问被拒绝，可能需要IEEE会员权限或机构订阅');
                } else {
                    throw new Error('PDF访问被拒绝，可能需要特殊权限或存在防盗链保护');
                }
            } else if (error.response?.status === 404) {
                throw new Error('PDF文件不存在');
            } else {
                throw new Error(`PDF下载失败: ${error.message}`);
            }
        }
    }

    // 检查buffer是否是PDF格式
    isPdfBuffer(buffer) {
        if (buffer.length < 4) return false;
        
        // PDF文件以"%PDF"开头
        const header = buffer.toString('ascii', 0, 4);
        return header === '%PDF';
    }

    // 提取PDF内容
    async extractPdfContent(pdfBuffer, url) {
        console.log('🔍 开始解析PDF内容...');
        
        try {
            const data = await pdf(pdfBuffer, {
                // 解析选项
                max: 0, // 不限制页数
                version: 'default',
                // 自定义页面渲染
                pagerender: (pageData) => {
                    // 自定义页面文本提取
                    let render_options = {
                        normalizeWhitespace: false,
                        disableCombineTextItems: false
                    };
                    
                    return pageData.getTextContent(render_options)
                        .then(textContent => {
                            let lastY, text = '';
                            
                            for (let item of textContent.items) {
                                if (lastY == item.transform[5] || !lastY) {
                                    text += item.str;
                                } else {
                                    text += '\n' + item.str;
                                }
                                lastY = item.transform[5];
                            }
                            
                            return text;
                        });
                }
            });

            console.log(`📊 PDF解析完成:`);
            console.log(`   - 页数: ${data.numpages}`);
            console.log(`   - 文本长度: ${data.text.length} 字符`);
            console.log(`   - 标题: ${data.info?.Title || '未知'}`);
            console.log(`   - 作者: ${data.info?.Author || '未知'}`);
            console.log(`   - 创建日期: ${data.info?.CreationDate || '未知'}`);

            // 清理和处理文本
            let cleanText = this.cleanPdfText(data.text);
            
            if (!cleanText || cleanText.length < 100) {
                throw new Error('PDF中没有提取到足够的文本内容，可能是扫描版PDF或图像PDF');
            }

            // 构建返回数据
            const extractedData = {
                content: cleanText,
                images: [], // PDF中的图片需要特殊处理，暂时为空
                imageCount: 0,
                title: data.info?.Title || this.extractTitleFromUrl(url) || 'PDF文档',
                url: url,
                extractedAt: new Date().toISOString(),
                pdfInfo: {
                    pages: data.numpages,
                    author: data.info?.Author,
                    subject: data.info?.Subject,
                    keywords: data.info?.Keywords,
                    creationDate: data.info?.CreationDate,
                    modificationDate: data.info?.ModDate,
                    producer: data.info?.Producer,
                    creator: data.info?.Creator
                },
                contentType: 'pdf'
            };

            console.log(`✅ PDF内容提取成功，最终文本长度: ${cleanText.length} 字符`);
            return extractedData;

        } catch (error) {
            console.error('PDF解析失败:', error);
            
            if (error.message.includes('Invalid PDF structure')) {
                throw new Error('PDF文件结构损坏或不是有效的PDF格式');
            } else if (error.message.includes('encrypted')) {
                throw new Error('PDF文件已加密，需要密码才能访问');
            } else if (error.message.includes('password')) {
                throw new Error('PDF文件受密码保护');
            } else {
                throw new Error(`PDF内容解析失败: ${error.message}`);
            }
        }
    }

    // 清理PDF文本
    cleanPdfText(text) {
        if (!text) return '';

        return text
            // 移除过多的空白字符
            .replace(/\s+/g, ' ')
            // 处理换行符
            .replace(/\n\s*\n\s*\n/g, '\n\n')  // 多个换行符减少为两个
            .replace(/\n\s+/g, '\n')  // 行首空格
            .replace(/\s+\n/g, '\n')  // 行尾空格
            // 移除PDF特有的奇怪字符
            .replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, ' ')
            // 合并重复的标点符号
            .replace(/\.{3,}/g, '...')
            .replace(/-{3,}/g, '---')
            // 移除页眉页脚常见模式
            .replace(/第\s*\d+\s*页/g, '')
            .replace(/Page\s*\d+/gi, '')
            // 修复单词断行问题（英文）
            .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
            // 清理首尾空白
            .trim();
    }

    // 从URL提取标题
    extractTitleFromUrl(url) {
        try {
            const urlObj = new URL(url);
            let pathname = urlObj.pathname;
            
            // 移除扩展名
            pathname = pathname.replace(/\.pdf$/i, '');
            
            // 提取文件名
            const filename = pathname.split('/').pop();
            
            if (filename && filename.length > 0) {
                // 将连字符和下划线替换为空格，并进行首字母大写
                return filename
                    .replace(/[-_]/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase())
                    .trim();
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    // 主提取方法
    async extractPdfFromUrl(url) {
        // 检查是否是PDF URL
        if (!this.isPdfUrl(url)) {
            // 尝试通过HEAD请求检查Content-Type
            try {
                const headResponse = await axios.head(url, { 
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                const contentType = headResponse.headers['content-type'] || '';
                if (!contentType.includes('application/pdf')) {
                    throw new Error('URL指向的不是PDF文件');
                }
            } catch (error) {
                throw new Error('无法确认URL是否指向PDF文件，请检查URL格式');
            }
        }

        // 下载并解析PDF
        const pdfBuffer = await this.downloadPdf(url);
        return await this.extractPdfContent(pdfBuffer, url);
    }

    // 检测常见的学术PDF网站并优化处理
    optimizeAcademicPdfUrl(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            // arXiv PDF处理
            if (hostname.includes('arxiv.org')) {
                // 将arXiv摘要页面转换为PDF下载链接
                if (url.includes('/abs/')) {
                    return url.replace('/abs/', '/pdf/') + '.pdf';
                }
            }
            
            // ResearchGate处理
            if (hostname.includes('researchgate.net')) {
                // ResearchGate的PDF需要特殊处理
                console.log('⚠️  ResearchGate PDF可能需要登录才能访问');
            }
            
            // IEEE处理
            if (hostname.includes('ieee.org')) {
                console.log('⚠️  IEEE PDF可能需要订阅权限');
            }
            
            // ACM数字图书馆处理
            if (hostname.includes('dl.acm.org')) {
                console.log('⚠️  ACM数字图书馆PDF可能需要订阅权限');
                // ACM的PDF链接通常需要特殊处理
                if (url.includes('/doi/pdf/')) {
                    // 提取DOI信息以便后续寻找开放获取版本
                    const doiMatch = url.match(/\/doi\/pdf\/(10\.\d+\/[^\/?]+)/);
                    if (doiMatch) {
                        const doi = doiMatch[1];
                        console.log(`📄 发现DOI: ${doi}`);
                        console.log(`💡 可尝试在以下地方寻找开放获取版本:`);
                        console.log(`   - Google Scholar: https://scholar.google.com/scholar?q=${encodeURIComponent(doi)}`);
                        console.log(`   - Semantic Scholar: https://www.semanticscholar.org/search?q=${encodeURIComponent(doi)}`);
                        console.log(`   - arXiv: https://arxiv.org/search/?query=${encodeURIComponent(doi)}`);
                    }
                    return url;
                }
            }
            
            return url;
        } catch (error) {
            return url;
        }
    }
}

module.exports = PDFExtractor; 