const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

class DatabaseManager {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'data', 'transformations.db');
        this.db = null;
    }

    async init() {
        try {
            // 确保data目录存在
            const dataDir = path.dirname(this.dbPath);
            await fs.mkdir(dataDir, { recursive: true });

            // 连接数据库
            this.db = new sqlite3.Database(this.dbPath);
            
            // 创建表
            await this.createTables();
            console.log('数据库初始化成功');
        } catch (error) {
            console.error('数据库初始化失败:', error);
            throw error;
        }
    }

    createTables() {
        return new Promise((resolve, reject) => {
            const sql = `
                CREATE TABLE IF NOT EXISTS transformations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uuid TEXT UNIQUE NOT NULL,
                    title TEXT NOT NULL,
                    original_url TEXT NOT NULL,
                    transformed_content TEXT NOT NULL,
                    style TEXT DEFAULT 'academic',
                    complexity TEXT DEFAULT 'medium',
                    file_path TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    image_count INTEGER DEFAULT 0,
                    images TEXT DEFAULT '[]'
                )
            `;
            
            this.db.run(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async saveTransformation(data) {
        const transformationUuid = uuidv4();
        const {
            title,
            originalUrl,
            transformedContent,
            style = 'academic',
            complexity = 'medium',
            filePath = null,
            imageCount = 0,
            images = []
        } = data;

        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO transformations 
                (uuid, title, original_url, transformed_content, style, complexity, file_path, image_count, images)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            this.db.run(sql, [
                transformationUuid,
                title,
                originalUrl,
                transformedContent,
                style,
                complexity,
                filePath,
                imageCount,
                JSON.stringify(images)
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id: this.lastID,
                        uuid: transformationUuid
                    });
                }
            });
        });
    }

    async getTransformationByUuid(uuid) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM transformations 
                WHERE uuid = ?
            `;
            
            this.db.get(sql, [uuid], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        row.images = JSON.parse(row.images || '[]');
                    }
                    resolve(row);
                }
            });
        });
    }

    async getAllTransformations(limit = 50, offset = 0) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, uuid, title, original_url, style, complexity, 
                       created_at, image_count, file_path
                FROM transformations 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `;
            
            this.db.all(sql, [limit, offset], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getTransformationCount() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT COUNT(*) as count FROM transformations`;
            
            this.db.get(sql, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    async deleteTransformation(uuid) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM transformations WHERE uuid = ?`;
            
            this.db.run(sql, [uuid], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async deleteTransformationsByFilePath(filePath) {
        return new Promise((resolve, reject) => {
            const sql = `DELETE FROM transformations WHERE file_path = ?`;
            
            this.db.run(sql, [filePath], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async getTransformationsWithFiles() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT uuid, file_path FROM transformations 
                WHERE file_path IS NOT NULL AND file_path != ''
            `;
            
            this.db.all(sql, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async updateTransformation(uuid, data) {
        const { title, transformedContent, style, complexity } = data;
        
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE transformations 
                SET title = ?, transformed_content = ?, style = ?, complexity = ?, updated_at = CURRENT_TIMESTAMP
                WHERE uuid = ?
            `;
            
            this.db.run(sql, [title, transformedContent, style, complexity, uuid], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async searchTransformations(query, limit = 20) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, uuid, title, original_url, style, complexity, 
                       created_at, image_count, file_path
                FROM transformations 
                WHERE title LIKE ? OR original_url LIKE ? OR transformed_content LIKE ?
                ORDER BY created_at DESC 
                LIMIT ?
            `;
            
            const searchTerm = `%${query}%`;
            this.db.all(sql, [searchTerm, searchTerm, searchTerm, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getTransformationByUrl(originalUrl) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM transformations 
                WHERE original_url = ?
                ORDER BY created_at DESC
                LIMIT 1
            `;
            
            this.db.get(sql, [originalUrl], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        row.images = JSON.parse(row.images || '[]');
                    }
                    resolve(row);
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = DatabaseManager; 