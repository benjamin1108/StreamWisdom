#!/usr/bin/env node

require('dotenv').config();

const PDFExtractor = require('../lib/pdfExtractor');

// 测试PDF URL列表
const testPdfUrls = [
    // arXiv论文
    'https://arxiv.org/pdf/1706.03762.pdf', // Attention Is All You Need
    // 一些公开的PDF文档
    'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
    // 可以添加更多测试PDF
];

async function testPdfExtraction() {
    const pdfExtractor = new PDFExtractor();
    
    console.log('🧪 开始PDF提取测试\n');
    
    for (let i = 0; i < testPdfUrls.length; i++) {
        const url = testPdfUrls[i];
        console.log(`\n📄 测试 ${i + 1}/${testPdfUrls.length}: ${url}`);
        console.log('='.repeat(80));
        
        try {
            const startTime = Date.now();
            const result = await pdfExtractor.extractPdfFromUrl(url);
            const duration = Date.now() - startTime;
            
            console.log(`\n✅ 提取成功! 耗时: ${duration}ms`);
            console.log(`📊 结果统计:`);
            console.log(`   - 标题: ${result.title}`);
            console.log(`   - 内容长度: ${result.content.length} 字符`);
            console.log(`   - 页数: ${result.pdfInfo?.pages || '未知'}`);
            console.log(`   - 作者: ${result.pdfInfo?.author || '未知'}`);
            console.log(`   - 内容预览: "${result.content.substring(0, 200)}..."`);
            
        } catch (error) {
            console.log(`\n❌ 提取失败: ${error.message}`);
        }
    }
    
    console.log('\n🎉 PDF测试完成!');
}

// 命令行参数处理
const args = process.argv.slice(2);
if (args.length > 0) {
    // 如果提供了URL参数，测试指定的PDF
    const testUrl = args[0];
    console.log(`🎯 测试指定PDF: ${testUrl}\n`);
    
    const pdfExtractor = new PDFExtractor();
    pdfExtractor.extractPdfFromUrl(testUrl)
        .then(result => {
            console.log(`\n✅ 提取成功!`);
            console.log(`📊 结果统计:`);
            console.log(`   - 标题: ${result.title}`);
            console.log(`   - 内容长度: ${result.content.length} 字符`);
            console.log(`   - 页数: ${result.pdfInfo?.pages || '未知'}`);
            console.log(`   - 作者: ${result.pdfInfo?.author || '未知'}`);
            console.log(`   - 内容预览: "${result.content.substring(0, 500)}..."`);
        })
        .catch(error => {
            console.log(`\n❌ 提取失败: ${error.message}`);
        });
} else {
    // 运行预设的测试
    testPdfExtraction().catch(console.error);
} 