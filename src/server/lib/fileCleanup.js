const fs = require('fs').promises;
const path = require('path');

class FileCleanupManager {
    constructor(databaseManager) {
        this.db = databaseManager;
        this.cleanupInterval = null;
        this.intervalMs = 30 * 60 * 1000; // 30分钟扫描一次
    }

    async checkFileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async cleanupMissingFiles() {
        try {
            console.log('开始扫描丢失的转化文件...');
            
            // 获取所有有文件路径的转化记录
            const transformationsWithFiles = await this.db.getTransformationsWithFiles();
            
            let deletedCount = 0;
            
            for (const transformation of transformationsWithFiles) {
                const { uuid, file_path } = transformation;
                
                if (file_path) {
                    const fileExists = await this.checkFileExists(file_path);
                    
                    if (!fileExists) {
                        console.log(`文件不存在，删除记录: ${file_path}`);
                        await this.db.deleteTransformation(uuid);
                        deletedCount++;
                    }
                }
            }
            
            if (deletedCount > 0) {
                console.log(`清理完成，删除了 ${deletedCount} 个丢失文件的记录`);
            } else {
                console.log('未发现丢失的文件');
            }
            
            return deletedCount;
        } catch (error) {
            console.error('文件清理扫描失败:', error);
            return 0;
        }
    }

    startPeriodicCleanup() {
        if (this.cleanupInterval) {
            console.log('定时清理任务已经在运行');
            return;
        }

        console.log(`启动定时文件清理任务，间隔: ${this.intervalMs / 1000 / 60} 分钟`);
        
        // 立即执行一次
        this.cleanupMissingFiles();
        
        // 设置定时任务
        this.cleanupInterval = setInterval(() => {
            this.cleanupMissingFiles();
        }, this.intervalMs);
    }

    stopPeriodicCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('定时文件清理任务已停止');
        }
    }

    setCleanupInterval(minutes) {
        this.intervalMs = minutes * 60 * 1000;
        
        // 如果正在运行，重新启动
        if (this.cleanupInterval) {
            this.stopPeriodicCleanup();
            this.startPeriodicCleanup();
        }
    }

    async cleanupByFilePath(filePath) {
        try {
            const deletedCount = await this.db.deleteTransformationsByFilePath(filePath);
            console.log(`根据文件路径清理了 ${deletedCount} 个记录: ${filePath}`);
            return deletedCount;
        } catch (error) {
            console.error(`清理文件路径记录失败: ${filePath}`, error);
            return 0;
        }
    }

    async cleanupOldRecords(daysOld = 30) {
        try {
            console.log(`开始清理 ${daysOld} 天前的旧记录...`);
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            
            return new Promise((resolve, reject) => {
                const sql = `DELETE FROM transformations WHERE created_at < ?`;
                
                this.db.db.run(sql, [cutoffDate.toISOString()], function(err) {
                    if (err) {
                        console.error('清理旧记录失败:', err);
                        reject(err);
                    } else {
                        console.log(`清理了 ${this.changes} 个旧记录`);
                        resolve(this.changes);
                    }
                });
            });
        } catch (error) {
            console.error('清理旧记录失败:', error);
            return 0;
        }
    }

    getStatus() {
        return {
            isRunning: !!this.cleanupInterval,
            intervalMinutes: this.intervalMs / 1000 / 60,
            nextCleanup: this.cleanupInterval ? 
                new Date(Date.now() + this.intervalMs).toISOString() : null
        };
    }
}

module.exports = FileCleanupManager; 