const fs = require('fs').promises;
const path = require('path');

class ContentTypeChecker {
    constructor() {
        this.config = null;
        this.configPath = path.join(__dirname, '../../../config/content-types.json');
        this.loadConfig();
    }

    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf-8');
            this.config = JSON.parse(configData);
            console.log('📋 内容类型配置加载成功');
        } catch (error) {
            console.error('❌ 加载内容类型配置失败:', error.message);
            // 使用默认配置
            this.config = {
                enabled: true,
                allowedContentTypes: {
                    pdf: { enabled: true, domains: ['*'], restrictedDomains: [] },
                    html: { enabled: true, domains: ['*'], restrictedDomains: [] },
                    youtube: { enabled: false, domains: ['youtube.com', 'youtu.be', 'm.youtube.com'], restrictedDomains: [] }
                },
                restrictions: {
                    allowUnknownTypes: true
                }
            };
        }
    }

    // 重新加载配置
    async reloadConfig() {
        await this.loadConfig();
    }

    // 检查URL是否允许提取
    async isAllowedUrl(url) {
        if (!this.config) {
            await this.loadConfig();
        }

        // 如果配置被禁用，允许所有类型
        if (!this.config.enabled) {
            return { allowed: true, reason: '内容类型限制已禁用' };
        }

        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            const pathname = urlObj.pathname.toLowerCase();

            // 按优先级检查内容类型
            
            // 1. 检查是否是PDF
            if (this.isPdfUrl(url, hostname, pathname)) {
                return this.checkContentType('pdf', hostname);
            }

            // 2. 检查是否是YouTube
            if (this.isYouTubeUrl(hostname)) {
                return this.checkContentType('youtube', hostname);
            }

            // 3. 检查是否是GitHub
            if (this.isGitHubUrl(hostname)) {
                return this.checkContentType('github', hostname);
            }

            // 4. 检查是否是学术网站
            if (this.isAcademicUrl(hostname)) {
                return this.checkContentType('academic', hostname);
            }

            // 5. 检查是否是文档网站（通过特定路径模式）
            if (this.isDocumentationUrl(hostname, pathname)) {
                return this.checkContentType('documentation', hostname);
            }

            // 6. 默认作为HTML处理
            return this.checkContentType('html', hostname);

        } catch (error) {
            console.error('URL解析失败:', error.message);
            return { allowed: false, reason: 'URL格式无效' };
        }
    }

    // 判断是否是PDF URL
    isPdfUrl(url, hostname, pathname) {
        // 检查文件扩展名
        if (pathname.endsWith('.pdf')) {
            return true;
        }

        // 检查URL中是否包含PDF相关信息
        if (url.includes('pdf') || url.includes('PDF')) {
            return true;
        }

        // 检查学术网站的PDF模式
        const pdfPatterns = [
            'dl.acm.org.*pdf',
            'ieeexplore.ieee.org.*stamp',
            'link.springer.com.*pdf',
            'arxiv.org.*pdf',
            'researchgate.net.*pdf'
        ];

        return pdfPatterns.some(pattern => new RegExp(pattern, 'i').test(url));
    }

    // 判断是否是YouTube URL
    isYouTubeUrl(hostname) {
        const youtubeHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
        return youtubeHosts.includes(hostname);
    }

    // 判断是否是GitHub URL
    isGitHubUrl(hostname) {
        const githubHosts = ['github.com', 'www.github.com', 'raw.githubusercontent.com'];
        return githubHosts.includes(hostname);
    }

    // 判断是否是学术网站 URL
    isAcademicUrl(hostname) {
        const academicHosts = [
            'arxiv.org', 'www.arxiv.org',
            'ieee.org', 'ieeexplore.ieee.org', 'www.ieee.org',
            'acm.org', 'dl.acm.org', 'www.acm.org',
            'springer.com', 'link.springer.com', 'www.springer.com',
            'nature.com', 'www.nature.com',
            'researchgate.net', 'www.researchgate.net'
        ];
        
        return academicHosts.some(host => hostname.includes(host));
    }

    // 判断是否是文档网站（通过路径模式）
    isDocumentationUrl(hostname, pathname) {
        // 检查常见的文档路径模式
        const docPatterns = [
            '/docs/',
            '/documentation/',
            '/api/',
            '/guide/',
            '/tutorial/',
            '/manual/',
            '/help/',
            '/wiki/',
            '/reference/'
        ];

        // 检查常见的文档网站域名模式
        const docDomainPatterns = [
            'docs.',
            'documentation.',
            'wiki.',
            'manual.',
            'guide.',
            'help.',
            'api.'
        ];

        // 检查路径模式
        const hasDocPath = docPatterns.some(pattern => pathname.includes(pattern));
        
        // 检查域名模式
        const hasDocDomain = docDomainPatterns.some(pattern => hostname.startsWith(pattern));

        return hasDocPath || hasDocDomain;
    }

    // 检查特定内容类型是否允许
    checkContentType(type, hostname) {
        const typeConfig = this.config.allowedContentTypes[type];
        
        if (!typeConfig) {
            // 如果类型未定义，根据allowUnknownTypes设置决定
            const allowed = this.config.restrictions?.allowUnknownTypes !== false;
            return { 
                allowed, 
                reason: allowed ? '允许未知内容类型' : '不允许未知内容类型',
                contentType: type
            };
        }

        // 检查类型是否启用
        if (!typeConfig.enabled) {
            return { 
                allowed: false, 
                reason: `${typeConfig.description || type}类型已被禁用`,
                contentType: type
            };
        }

        // 检查域名限制
        const isAllowed = this.checkDomainRestrictions(hostname, typeConfig);
        
        return {
            allowed: isAllowed.allowed,
            reason: isAllowed.reason,
            contentType: type
        };
    }

    // 检查域名限制
    checkDomainRestrictions(hostname, typeConfig) {
        // 检查禁止列表（优先级最高）
        if (typeConfig.restrictedDomains && typeConfig.restrictedDomains.length > 0) {
            for (const restrictedDomain of typeConfig.restrictedDomains) {
                if (hostname.includes(restrictedDomain.toLowerCase())) {
                    return { 
                        allowed: false, 
                        reason: `域名 ${hostname} 在禁止列表中` 
                    };
                }
            }
        }

        // 检查允许列表
        if (typeConfig.domains && typeConfig.domains.length > 0) {
            // 如果包含通配符，允许所有域名
            if (typeConfig.domains.includes('*')) {
                return { allowed: true, reason: '域名检查通过' };
            }

            // 检查是否在允许列表中
            for (const allowedDomain of typeConfig.domains) {
                if (hostname.includes(allowedDomain.toLowerCase())) {
                    return { allowed: true, reason: '域名检查通过' };
                }
            }

            return { 
                allowed: false, 
                reason: `域名 ${hostname} 不在允许列表中` 
            };
        }

        // 如果没有配置域名限制，默认允许
        return { allowed: true, reason: '域名检查通过' };
    }

    // 获取所有配置的内容类型
    getContentTypes() {
        if (!this.config) {
            return {};
        }
        return this.config.allowedContentTypes;
    }

    // 获取当前配置
    getConfig() {
        return this.config;
    }

    // 更新配置
    async updateConfig(newConfig) {
        try {
            // 保存到文件
            await fs.writeFile(this.configPath, JSON.stringify(newConfig, null, 2));
            // 重新加载配置
            await this.loadConfig();
            console.log('✅ 内容类型配置更新成功');
            return true;
        } catch (error) {
            console.error('❌ 更新内容类型配置失败:', error.message);
            return false;
        }
    }
}

module.exports = ContentTypeChecker; 