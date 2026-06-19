const path = require('path');
const fs = require('fs');

class AuditLogger {
    constructor() {
        // Ensure data directory exists
        this.dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        // Initialize JSON file-based logging
        this.logsFile = path.join(this.dataDir, 'audit_logs.json');
        this.initFile();
        
        console.log(`✅ Audit Logger initialized: ${this.logsFile}`);
    }
    
    initFile() {
        // Create audit logs file if it doesn't exist
        if (!fs.existsSync(this.logsFile)) {
            fs.writeFileSync(this.logsFile, JSON.stringify([]));
        }
    }
    
    // Load logs from file
    loadLogs() {
        try {
            const data = fs.readFileSync(this.logsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading audit logs:', error);
            return [];
        }
    }
    
    // Save logs to file
    saveLogs(logs) {
        try {
            fs.writeFileSync(this.logsFile, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error('Error saving audit logs:', error);
        }
    }
    
    // Main logging function
    log(eventType, userId = null, sessionId = null, details = {}, req = null) {
        const logEntry = {
            id: Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            event_type: eventType,
            user_id: userId,
            session_id: sessionId,
            details: details,
            ip_address: req?.ip || req?.connection?.remoteAddress || 'unknown',
            user_agent: req?.headers?.['user-agent'] || 'unknown',
            created_at: new Date().toISOString()
        };
        
        try {
            const logs = this.loadLogs();
            logs.unshift(logEntry); // Add to beginning for newest first
            
            // Keep only last 10000 logs to prevent file from growing too large
            if (logs.length > 10000) {
                logs.splice(10000);
            }
            
            this.saveLogs(logs);
            console.log(`📝 [AUDIT] ${eventType} by ${userId || 'system'} at ${logEntry.timestamp}`);
        } catch (error) {
            console.error('❌ Audit log error:', error);
        }
    }
    
    // High Priority Event Helpers
    userLogin(userId, sessionId, req) {
        this.log('USER_LOGIN', userId, sessionId, {
            action: 'User joined session',
            role: userId ? userId.split('_')[1] : 'unknown'
        }, req);
    }
    
    userLogout(userId, sessionId, req) {
        this.log('USER_LOGOUT', userId, sessionId, {
            action: 'User left session'
        }, req);
    }
    
    sessionCreated(userId, sessionId, sessionData, req) {
        this.log('SESSION_CREATED', userId, sessionId, {
            action: 'New session created',
            teamName: sessionData.teamName,
            sprintName: sessionData.sprintName
        }, req);
    }
    
    sessionJoined(userId, sessionId, req) {
        this.log('SESSION_JOINED', userId, sessionId, {
            action: 'User joined existing session'
        }, req);
    }
    
    storyCreated(userId, sessionId, storyData, req) {
        this.log('STORY_CREATED', userId, sessionId, {
            action: 'New story added',
            storyNumber: storyData.number,
            storySummary: storyData.summary
        }, req);
    }
    
    storyUpdated(userId, sessionId, storyId, oldData, newData, req) {
        this.log('STORY_UPDATED', userId, sessionId, {
            action: 'Story modified',
            storyId: storyId,
            oldData: oldData,
            newData: newData
        }, req);
    }
    
    storyDeleted(userId, sessionId, storyData, req) {
        this.log('STORY_DELETED', userId, sessionId, {
            action: 'Story removed',
            storyNumber: storyData.number,
            storySummary: storyData.summary
        }, req);
    }
    
    estimationProvided(userId, sessionId, storyId, points, reasoning, req) {
        this.log('ESTIMATION_PROVIDED', userId, sessionId, {
            action: 'User provided story estimate',
            storyId: storyId,
            points: points,
            reasoning: reasoning || null
        }, req);
    }
    
    estimationChanged(userId, sessionId, storyId, oldPoints, newPoints, req) {
        this.log('ESTIMATION_CHANGED', userId, sessionId, {
            action: 'User updated their estimate',
            storyId: storyId,
            oldPoints: oldPoints,
            newPoints: newPoints
        }, req);
    }
    
    // Query function for retrieving logs
    async getLogs(filters = {}) {
        return new Promise((resolve, reject) => {
            try {
                let logs = this.loadLogs();
                
                // Apply filters
                if (filters.sessionId) {
                    logs = logs.filter(log => log.session_id === filters.sessionId);
                }
                
                if (filters.userId) {
                    logs = logs.filter(log => log.user_id && log.user_id.includes(filters.userId));
                }
                
                if (filters.eventType) {
                    logs = logs.filter(log => log.event_type === filters.eventType);
                }
                
                if (filters.dateFrom) {
                    const fromDate = new Date(filters.dateFrom);
                    logs = logs.filter(log => new Date(log.timestamp) >= fromDate);
                }
                
                if (filters.dateTo) {
                    const toDate = new Date(filters.dateTo + 'T23:59:59.999Z');
                    logs = logs.filter(log => new Date(log.timestamp) <= toDate);
                }
                
                // Apply limit
                const limit = filters.limit || 1000;
                logs = logs.slice(0, limit);
                
                resolve(logs);
            } catch (error) {
                reject(error);
            }
        });
    }
    
    // Get summary statistics
    async getStats() {
        return new Promise((resolve, reject) => {
            try {
                const logs = this.loadLogs();
                
                // Calculate statistics
                const totalLogs = logs.length;
                const uniqueSessions = [...new Set(logs.map(log => log.session_id).filter(Boolean))].length;
                const uniqueUsers = [...new Set(logs.map(log => log.user_id).filter(Boolean))].length;
                
                // Event type statistics
                const eventTypeCounts = {};
                logs.forEach(log => {
                    eventTypeCounts[log.event_type] = (eventTypeCounts[log.event_type] || 0) + 1;
                });
                
                const eventTypeStats = Object.entries(eventTypeCounts)
                    .map(([event_type, count]) => ({ event_type, count }))
                    .sort((a, b) => b.count - a.count);
                
                resolve({
                    totalLogs,
                    totalSessions: uniqueSessions,
                    totalUsers: uniqueUsers,
                    eventTypeStats
                });
            } catch (error) {
                reject(error);
            }
        });
    }
    
    // Cleanup old logs (optional method for maintenance)
    cleanup(daysToKeep = 30) {
        try {
            const logs = this.loadLogs();
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            const filteredLogs = logs.filter(log => new Date(log.timestamp) >= cutoffDate);
            
            this.saveLogs(filteredLogs);
            console.log(`✅ Cleaned up audit logs, kept ${filteredLogs.length} entries from last ${daysToKeep} days`);
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
        }
    }
}

// Export singleton instance
module.exports = new AuditLogger();