/**
 * URL标准化工具
 * 用于移除不影响页面内容的参数，以便进行重复检测
 */

class UrlUtils {
    constructor() {
        // 常见的不影响内容的参数
        this.ignoredParams = new Set([
            // 跟踪参数
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
            
            // Google Analytics
            'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
            
            // Facebook
            'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_ref', 'fb_source',
            
            // Twitter
            'twclid', 'twitterclickid',
            
            // Microsoft/Bing
            'msclkid', 'msclid',
            
            // Amazon
            'tag', 'linkCode', 'linkId', 'ref_', 'ref',
            
            // 通用跟踪
            'source', 'medium', 'campaign', 'content', 'term',
            'affiliate', 'partner', 'referrer', 'ref_source',
            
            // 时间戳和会话
            'timestamp', 't', '_t', 'ts', 'time',
            'sessionid', 'session_id', 'sid', '_sid',
            'rand', 'random', '_r', 'cache_bust', 'cb',
            
            // 分析和调试
            'debug', '_debug', 'test', '_test', 'preview',
            'nocache', 'no_cache', '_nc', 'v', 'version',
            
            // 分享参数
            'share', 'shared', 'from', 'via', 'source_platform',
            'share_source', 'share_medium', 'shared_via',
            
            // 其他常见参数
            'hl', 'lang', 'language', // 语言参数可能不影响主要内容
            '_', '__', '___', // 常用的缓存破坏参数
        ]);
    }

    /**
     * 标准化URL，移除不相关的参数
     * @param {string} urlString - 原始URL
     * @returns {string} 标准化后的URL
     */
    normalizeUrl(urlString) {
        try {
            const url = new URL(urlString);
            
            // 移除fragment（#后面的部分）
            url.hash = '';
            
            // 遍历查询参数，移除不相关的
            const paramsToDelete = [];
            for (const [key] of url.searchParams) {
                if (this.shouldIgnoreParam(key)) {
                    paramsToDelete.push(key);
                }
            }
            
            paramsToDelete.forEach(param => {
                url.searchParams.delete(param);
            });
            
            // 对剩余参数进行排序，确保一致性
            url.searchParams.sort();
            
            // 移除末尾的斜杠（如果不是根路径）
            if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
                url.pathname = url.pathname.slice(0, -1);
            }
            
            // 确保协议是https（如果原来是http且支持https）
            // 这里暂时保持原协议，避免误判
            
            return url.toString();
        } catch (error) {
            console.warn('URL标准化失败:', error.message);
            // 如果URL解析失败，返回原始URL
            return urlString;
        }
    }

    /**
     * 判断是否应该忽略某个参数
     * @param {string} paramName - 参数名
     * @returns {boolean} 是否应该忽略
     */
    shouldIgnoreParam(paramName) {
        const lowerName = paramName.toLowerCase();
        
        // 检查完全匹配
        if (this.ignoredParams.has(lowerName)) {
            return true;
        }
        
        // 检查前缀匹配
        const ignoredPrefixes = [
            'utm_', 'ga_', 'fb_', 'tw_', 'ig_', 'li_', 'pin_',
            'gclid', 'fbclid', 'msclkid', '_ga', '_gid',
            'mc_', 'email_', 'campaign_', 'promo_', 'coupon_'
        ];
        
        for (const prefix of ignoredPrefixes) {
            if (lowerName.startsWith(prefix)) {
                return true;
            }
        }
        
        // 检查后缀匹配
        const ignoredSuffixes = ['_source', '_medium', '_campaign', '_ref', '_id'];
        for (const suffix of ignoredSuffixes) {
            if (lowerName.endsWith(suffix)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 比较两个URL是否指向相同的内容
     * @param {string} url1 
     * @param {string} url2 
     * @returns {boolean} 是否相同
     */
    areUrlsEquivalent(url1, url2) {
        const normalized1 = this.normalizeUrl(url1);
        const normalized2 = this.normalizeUrl(url2);
        return normalized1 === normalized2;
    }
}

module.exports = UrlUtils; 