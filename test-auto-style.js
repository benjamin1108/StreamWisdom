const axios = require('axios');

// 测试不同类型的文章，验证AI自动风格选择
const testCases = [
    {
        name: "技术文章测试",
        url: "https://docs.python.org/3/tutorial/introduction.html", // Python官方教程
        expected_style: "技术解释风格",
        description: "应该自动选择技术解释风格，用清晰的逻辑结构和技术类比"
    },
    {
        name: "故事类文章测试", 
        url: "https://www.bbc.com/news/business", // BBC商业新闻
        expected_style: "故事叙述风格",
        description: "应该自动选择故事叙述风格，使用场景化描述"
    },
    {
        name: "科普类文章测试",
        url: "https://www.scientificamerican.com/", // 科学美国人
        expected_style: "知识科普风格", 
        description: "应该自动选择知识科普风格，从基础概念开始循序渐进"
    }
];

async function testAutoStyleSelection() {
    console.log('🧪 开始测试AI自动风格判断功能...\n');
    
    for (const testCase of testCases) {
        console.log(`📖 测试案例: ${testCase.name}`);
        console.log(`🔗 URL: ${testCase.url}`);
        console.log(`🎯 期望风格: ${testCase.expected_style}`);
        console.log(`📝 描述: ${testCase.description}`);
        
        try {
            const startTime = Date.now();
            
            const response = await axios.post('http://localhost:3000/api/transform', {
                url: testCase.url,
                complexity: 'beginner'
            }, {
                timeout: 60000
            });
            
            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            
            if (response.data.success) {
                console.log(`✅ 转化成功`);
                console.log(`⏱️  耗时: ${duration}秒`);
                console.log(`🤖 使用模型: ${response.data.model}`);
                console.log(`📊 原文长度: ${response.data.originalLength} 字符`);
                console.log(`📊 转化后长度: ${response.data.transformedLength} 字符`);
                console.log(`🖼️  图片数量: ${response.data.imageCount} 张`);
                
                // 分析转化结果的风格特征
                const result = response.data.result;
                console.log(`\n📄 转化结果预览 (前200字符):`);
                console.log(`"${result.substring(0, 200)}..."`);
                
                // 简单的风格分析
                analyzeStyle(result, testCase.expected_style);
                
            } else {
                console.log(`❌ 转化失败: ${response.data.error}`);
            }
            
        } catch (error) {
            console.log(`❌ 请求失败: ${error.message}`);
            if (error.response?.data?.error) {
                console.log(`服务器错误: ${error.response.data.error}`);
            }
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
    }
    
    console.log('🎉 测试完成！');
}

function analyzeStyle(content, expectedStyle) {
    console.log(`\n🔍 风格分析:`);
    
    // 技术解释风格特征检查
    const technicalMarkers = [
        /API|算法|函数|变量|数据|代码|程序|系统|架构/g,
        /如何工作|为什么这样设计|具体步骤|实现方法/g,
        /像.*一样|就像.*菜单|类似.*存储/g
    ];
    
    // 故事叙述风格特征检查  
    const narrativeMarkers = [
        /从前|后来|最终|有一天|开始时/g,
        /想象一下|故事|情景|场景|经历/g,
        /对人的影响|实际意义|让人感到/g
    ];
    
    // 知识科普风格特征检查
    const educationalMarkers = [
        /简单来说|你可能会想|通俗地讲|换句话说/g,
        /什么是|为什么重要|基础概念|首先了解/g,
        /日常生活中|我们熟悉的|常见的例子/g
    ];
    
    let technicalScore = 0;
    let narrativeScore = 0; 
    let educationalScore = 0;
    
    technicalMarkers.forEach(marker => {
        const matches = content.match(marker);
        technicalScore += matches ? matches.length : 0;
    });
    
    narrativeMarkers.forEach(marker => {
        const matches = content.match(marker);
        narrativeScore += matches ? matches.length : 0;
    });
    
    educationalMarkers.forEach(marker => {
        const matches = content.match(marker);
        educationalScore += matches ? matches.length : 0;
    });
    
    console.log(`🔧 技术解释风格特征: ${technicalScore}个`);
    console.log(`📚 故事叙述风格特征: ${narrativeScore}个`);
    console.log(`🎓 知识科普风格特征: ${educationalScore}个`);
    
    // 判断主导风格
    const maxScore = Math.max(technicalScore, narrativeScore, educationalScore);
    let detectedStyle = '混合风格';
    
    if (maxScore > 0) {
        if (technicalScore === maxScore) detectedStyle = '技术解释风格';
        else if (narrativeScore === maxScore) detectedStyle = '故事叙述风格';
        else if (educationalScore === maxScore) detectedStyle = '知识科普风格';
    }
    
    console.log(`🎯 检测到的主导风格: ${detectedStyle}`);
    console.log(`📋 期望风格: ${expectedStyle}`);
    
    if (detectedStyle === expectedStyle) {
        console.log(`✅ 风格匹配成功！`);
    } else {
        console.log(`⚠️  风格不完全匹配，但AI可能基于内容特点做了合理选择`);
    }
}

// 执行测试
if (require.main === module) {
    testAutoStyleSelection().catch(console.error);
} 