#!/usr/bin/env node

/**
 * 悟流健康检查脚本
 * Stream Wisdom Health Check Script
 */

const http = require('http');
const process = require('process');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 8080,
  path: '/',
  method: 'GET',
  timeout: 5000
};

const healthCheck = () => {
  const req = http.request(options, (res) => {
    console.log(`✅ 健康检查通过 - 状态码: ${res.statusCode}`);
    process.exit(0);
  });

  req.on('error', (err) => {
    console.error(`❌ 健康检查失败: ${err.message}`);
    process.exit(1);
  });

  req.on('timeout', () => {
    console.error('❌ 健康检查超时');
    req.destroy();
    process.exit(1);
  });

  req.end();
};

console.log('🔍 开始健康检查...');
healthCheck(); 