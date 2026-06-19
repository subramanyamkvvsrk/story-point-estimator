const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// Audit logging
const auditLogger = require('./audit-logger');

// ====== AUDIT LOG CONFIGURATION ======
const AUDIT_CONFIG = {
    RETENTION_DAYS: process.env.AUDIT_RETENTION_DAYS || 30,  // Configurable via environment or default 30 days
    CLEANUP_INTERVAL_HOURS: process.env.AUDIT_CLEANUP_HOURS || 24,  // Cleanup every 24 hours
    ENABLE_AUTO_CLEANUP: process.env.AUDIT_AUTO_CLEANUP !== 'false'  // Default true, set to 'false' to disable
};
// ====================================

const app = express();
const PORT = process.env.PORT || 53849;
const HOST = process.env.HOST || '127.0.0.1';

// Middleware
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        `http://localhost:${PORT}`,
        `http://127.0.0.1:${PORT}`,
        'http://127.0.0.1:64317', // Browser preview proxy
        'http://127.0.0.1:65089', // Current browser preview proxy
        /^http:\/\/127\.0\.0\.1:\d+$/, // Allow any localhost port for browser previews
        'https://story-point-estimator.onrender.com',
        'https://subramanyamkvvsrk.github.io'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../')));

// Data storage file path
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

// Initialize sessions file if it doesn't exist
if (!fs.existsSync(SESSIONS_FILE)) {
    fs.writeFileSync(SESSIONS_FILE, '{}');
}

// Helper functions for file-based session storage
const loadSessions = () => {
    try {
        const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading sessions:', error);
        return {};
    }
};

const saveSessions = (sessions) => {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
    } catch (error) {
        console.error('Error saving sessions:', error);
    }
};

// API Routes

// Get all sessions (for debugging)
app.get('/api/sessions', (req, res) => {
    const sessions = loadSessions();
    res.json(sessions);
});

// Get a specific session
app.get('/api/sessions/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const sessions = loadSessions();
    
    if (sessions[sessionId]) {
        res.json(sessions[sessionId]);
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

// Create a new session
app.post('/api/sessions', (req, res) => {
    const { sessionId, sessionData } = req.body;
    
    if (!sessionId || !sessionData) {
        return res.status(400).json({ error: 'Session ID and session data are required' });
    }
    
    const sessions = loadSessions();
    sessions[sessionId] = {
        ...sessionData,
        lastUpdated: new Date().toISOString()
    };
    
    saveSessions(sessions);
    
    // Audit log: Session created
    const creatorId = sessionData.createdBy || 'unknown';
    auditLogger.sessionCreated(creatorId, sessionId, sessionData, req);
    
    res.json(sessions[sessionId]);
});

// Update an existing session
app.put('/api/sessions/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { sessionData } = req.body;
    
    if (!sessionData) {
        return res.status(400).json({ error: 'Session data is required' });
    }
    
    const sessions = loadSessions();
    
    if (!sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    // Capture old session state before updating
    const oldSession = sessions[sessionId];
    const oldStoryCount = oldSession.stories ? oldSession.stories.length : 0;
    const oldEstimationCount = oldSession.estimations ? Object.keys(oldSession.estimations).length : 0;
    const oldRevealedCount = oldSession.revealedStories ? Object.keys(oldSession.revealedStories).length : 0;
    
    // Update session
    sessions[sessionId] = {
        ...sessionData,
        lastUpdated: new Date().toISOString()
    };
    
    saveSessions(sessions);
    
    // Smart audit logging - only log meaningful changes
    const newStoryCount = sessionData.stories ? sessionData.stories.length : 0;
    const newEstimationCount = sessionData.estimations ? Object.keys(sessionData.estimations).length : 0;
    const newRevealedCount = sessionData.revealedStories ? Object.keys(sessionData.revealedStories).length : 0;
    
    // Log only significant changes
    if (newStoryCount > oldStoryCount) {
        // New story added
        auditLogger.log('STORY_CREATED', sessionData.lastUpdatedBy || 'unknown', sessionId, {
            action: 'New story added to session',
            totalStories: newStoryCount,
            newStoriesAdded: newStoryCount - oldStoryCount
        }, req);
    } else if (newEstimationCount > oldEstimationCount) {
        // New estimation provided
        auditLogger.log('ESTIMATION_PROVIDED', sessionData.lastUpdatedBy || 'unknown', sessionId, {
            action: 'New estimation provided',
            totalEstimations: newEstimationCount,
            newEstimations: newEstimationCount - oldEstimationCount
        }, req);
    }
    // Skip logging routine session updates that don't represent meaningful actions
    
    res.json(sessions[sessionId]);
});

// Add a participant to a session
app.post('/api/sessions/:sessionId/participants', (req, res) => {
    const { sessionId } = req.params;
    const { participant } = req.body;
    
    if (!participant) {
        return res.status(400).json({ error: 'Participant data is required' });
    }
    
    const sessions = loadSessions();
    
    if (!sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if participant already exists
    const existingParticipant = sessions[sessionId].participants.find(
        p => p.name === participant.name && p.role === participant.role
    );
    
    if (!existingParticipant) {
        sessions[sessionId].participants.push(participant);
        sessions[sessionId].lastUpdated = new Date().toISOString();
        saveSessions(sessions);
        
        // Audit log: User joined session
        const userId = `${participant.name}_${participant.role}`;
        auditLogger.sessionJoined(userId, sessionId, req);
    }
    
    res.json(sessions[sessionId]);
});

// Delete a session (for cleanup)
app.delete('/api/sessions/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const sessions = loadSessions();
    
    if (sessions[sessionId]) {
        delete sessions[sessionId];
        saveSessions(sessions);
        res.json({ message: 'Session deleted successfully' });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        sessions: Object.keys(loadSessions()).length
    });
});

// Audit Log API Endpoints

// Get audit logs with filtering
app.get('/api/audit-logs', async (req, res) => {
    try {
        const filters = {
            sessionId: req.query.sessionId,
            userId: req.query.userId,
            eventType: req.query.eventType,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            limit: parseInt(req.query.limit) || 1000
        };
        
        const logs = await auditLogger.getLogs(filters);
        res.json(logs);
    } catch (error) {
        console.error('❌ Error retrieving audit logs:', error);
        res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
});

// Get audit log statistics
app.get('/api/audit-logs/stats', async (req, res) => {
    try {
        const stats = await auditLogger.getStats();
        res.json(stats);
    } catch (error) {
        console.error('❌ Error retrieving audit stats:', error);
        res.status(500).json({ error: 'Failed to retrieve audit statistics' });
    }
});

// Export audit logs as CSV
app.get('/api/audit-logs/export', async (req, res) => {
    try {
        const filters = {
            sessionId: req.query.sessionId,
            userId: req.query.userId,
            eventType: req.query.eventType,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            limit: 10000 // Higher limit for export
        };
        
        const logs = await auditLogger.getLogs(filters);
        
        // Convert to CSV
        const csvHeaders = ['Timestamp', 'Event Type', 'User ID', 'Session ID', 'Details', 'IP Address'];
        const csvRows = logs.map(log => [
            log.timestamp,
            log.event_type,
            log.user_id || '',
            log.session_id || '',
            JSON.stringify(log.details),
            log.ip_address || ''
        ]);
        
        const csvContent = [csvHeaders, ...csvRows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvContent);
    } catch (error) {
        console.error('❌ Error exporting audit logs:', error);
        res.status(500).json({ error: 'Failed to export audit logs' });
    }
});

// Enhanced CSV Export with Estimation Deviation Analysis
app.get('/api/estimation-analysis/export', async (req, res) => {
    try {
        const sessionId = req.query.sessionId;
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        // Load session data
        const sessions = loadSessions();
        const session = sessions[sessionId];
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Prepare story analysis data
        const stories = session.stories || [];
        const estimations = session.estimations || {};
        
        // Sheet 1: Story Analysis
        const storyAnalysisHeaders = [
            'Story Number', 'JIRA Link', 'Story Summary', 'Restrictions', 
            'Developer Average', 'QA Average', 'Overall Average', 'Total Estimators'
        ];
        
        const storyAnalysisRows = stories.map(story => {
            const storyEstimations = estimations[story.id] || {};
            const estimates = Object.entries(storyEstimations).map(([userId, data]) => {
                const points = typeof data === 'object' ? data.points : data;
                const role = userId.split('_')[1];
                return { userId, points: parseFloat(points) || 0, role };
            });

            const devEstimates = estimates.filter(e => e.role === 'Dev').map(e => e.points);
            const qaEstimates = estimates.filter(e => e.role === 'QA').map(e => e.points);
            const allEstimates = estimates.map(e => e.points);

            const devAvg = devEstimates.length > 0 ? (devEstimates.reduce((a, b) => a + b, 0) / devEstimates.length).toFixed(1) : 'N/A';
            const qaAvg = qaEstimates.length > 0 ? (qaEstimates.reduce((a, b) => a + b, 0) / qaEstimates.length).toFixed(1) : 'N/A';
            const overallAvg = allEstimates.length > 0 ? (allEstimates.reduce((a, b) => a + b, 0) / allEstimates.length).toFixed(1) : 'N/A';

            return [
                story.number || 'N/A',
                story.url || 'N/A', 
                story.summary || 'N/A',
                story.restrictions ? (story.restrictions.devOnly ? 'Dev Only' : story.restrictions.qaOnly ? 'QA Only' : 'None') : 'None',
                devAvg,
                qaAvg, 
                overallAvg,
                estimates.length
            ];
        });

        // Sheet 2: Estimation Deviation Analysis
        const deviationAnalysisHeaders = [
            'User', 'Role', 'Total Estimates', 'Average Deviation', 'Over Estimate %', 
            'Under Estimate %', 'Consistency Score', 'Deviation Pattern', 'Typical Deviation Range'
        ];

        // Calculate user deviation metrics
        const userMetrics = {};
        
        stories.forEach(story => {
            const storyEstimations = estimations[story.id] || {};
            const estimates = Object.entries(storyEstimations).map(([userId, data]) => {
                const points = typeof data === 'object' ? data.points : data;
                const role = userId.split('_')[1];
                return { userId, points: parseFloat(points) || 0, role };
            });

            if (estimates.length > 1) { // Need at least 2 estimates to calculate average
                const overallAvg = estimates.reduce((sum, e) => sum + e.points, 0) / estimates.length;
                
                estimates.forEach(estimate => {
                    const { userId, points, role } = estimate;
                    if (!userMetrics[userId]) {
                        userMetrics[userId] = {
                            role,
                            estimates: [],
                            deviations: [],
                            overEstimates: 0,
                            underEstimates: 0,
                            totalEstimates: 0
                        };
                    }
                    
                    const deviation = points - overallAvg;
                    userMetrics[userId].estimates.push(points);
                    userMetrics[userId].deviations.push(deviation);
                    userMetrics[userId].totalEstimates++;
                    
                    if (deviation > 0.5) userMetrics[userId].overEstimates++;
                    else if (deviation < -0.5) userMetrics[userId].underEstimates++;
                });
            }
        });

        const deviationAnalysisRows = Object.entries(userMetrics).map(([userId, metrics]) => {
            const avgDeviation = metrics.deviations.length > 0 
                ? (metrics.deviations.reduce((a, b) => a + b, 0) / metrics.deviations.length).toFixed(2)
                : '0.00';
            
            const overEstimatePercent = metrics.totalEstimates > 0 
                ? ((metrics.overEstimates / metrics.totalEstimates) * 100).toFixed(1)
                : '0.0';
            
            const underEstimatePercent = metrics.totalEstimates > 0 
                ? ((metrics.underEstimates / metrics.totalEstimates) * 100).toFixed(1)
                : '0.0';

            // Determine consistency score and pattern
            let consistencyScore = 'Balanced';
            let deviationPattern = 'Neutral';
            
            const overPercent = parseFloat(overEstimatePercent);
            const underPercent = parseFloat(underEstimatePercent);
            
            if (overPercent >= 70) {
                consistencyScore = 'High Over-Estimator';
                deviationPattern = 'Consistently High';
            } else if (underPercent >= 70) {
                consistencyScore = 'High Under-Estimator';  
                deviationPattern = 'Consistently Low';
            } else if (overPercent >= 60) {
                consistencyScore = 'Moderate Over-Estimator';
                deviationPattern = 'Generally High';
            } else if (underPercent >= 60) {
                consistencyScore = 'Moderate Under-Estimator';
                deviationPattern = 'Generally Low';
            }

            // Calculate typical deviation range
            const sortedDeviations = [...metrics.deviations].sort((a, b) => a - b);
            const minDev = sortedDeviations[0] || 0;
            const maxDev = sortedDeviations[sortedDeviations.length - 1] || 0;
            const deviationRange = `${minDev.toFixed(1)} to ${maxDev.toFixed(1)}`;

            return [
                userId,
                metrics.role,
                metrics.totalEstimates,
                avgDeviation,
                `${overEstimatePercent}%`,
                `${underEstimatePercent}%`,
                consistencyScore,
                deviationPattern,
                deviationRange
            ];
        });

        // Generate multi-section CSV content
        const csvSections = [
            '=== STORY ANALYSIS ===',
            [storyAnalysisHeaders, ...storyAnalysisRows].map(row => 
                row.map(field => `"${field}"`).join(',')).join('\n'),
            '',
            '',
            '=== ESTIMATION DEVIATION ANALYSIS ===',
            [deviationAnalysisHeaders, ...deviationAnalysisRows].map(row => 
                row.map(field => `"${field}"`).join(',')).join('\n')
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=estimation-analysis-${sessionId}-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvSections);

    } catch (error) {
        console.error('❌ Error exporting estimation analysis:', error);
        res.status(500).json({ error: 'Failed to export estimation analysis' });
    }
});

// Get unique session IDs (filtered by date if provided)
app.get('/api/audit-logs/session-ids', async (req, res) => {
    try {
        const filters = {
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            limit: 10000 // Get more logs to extract all session IDs
        };
        
        const logs = await auditLogger.getLogs(filters);
        
        // Extract unique session IDs
        const sessionIds = [...new Set(logs
            .map(log => log.session_id)
            .filter(Boolean) // Remove null/undefined session IDs
        )];
        
        // Sort session IDs alphabetically for better UX
        sessionIds.sort();
        
        res.json({ sessionIds });
    } catch (error) {
        console.error('❌ Error retrieving session IDs:', error);
        res.status(500).json({ error: 'Failed to retrieve session IDs' });
    }
});

// Admin dashboard route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

// Serve the main application (now clean and fixed)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Start server
app.listen(PORT, HOST, () => {
    console.log(`✅ Story Point Estimator Server running on ${HOST}:${PORT}`);
    console.log(`🌐 Access at: http://${HOST}:${PORT}`);
    console.log(`📊 Health check: http://${HOST}:${PORT}/api/health`);
    console.log(`🔧 Admin dashboard: http://${HOST}:${PORT}/admin`);
    console.log(`💾 Sessions stored in: ${SESSIONS_FILE}`);
    
    // ====== AUDIT LOG AUTOMATIC CLEANUP ======
    if (AUDIT_CONFIG.ENABLE_AUTO_CLEANUP) {
        // Initial cleanup on startup
        console.log(`🧹 Running initial audit log cleanup (keeping last ${AUDIT_CONFIG.RETENTION_DAYS} days)...`);
        auditLogger.cleanup(parseInt(AUDIT_CONFIG.RETENTION_DAYS));
        
        // Schedule periodic cleanup
        const cleanupInterval = setInterval(() => {
            console.log(`🔄 Scheduled audit log cleanup (keeping last ${AUDIT_CONFIG.RETENTION_DAYS} days)...`);
            auditLogger.cleanup(parseInt(AUDIT_CONFIG.RETENTION_DAYS));
        }, AUDIT_CONFIG.CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000); // Convert hours to milliseconds
        
        console.log(`📋 Audit log auto-cleanup enabled: ${AUDIT_CONFIG.RETENTION_DAYS} days retention, cleanup every ${AUDIT_CONFIG.CLEANUP_INTERVAL_HOURS} hours`);
        
        // Store cleanup interval reference for graceful shutdown
        process.cleanupInterval = cleanupInterval;
    } else {
        console.log(`📋 Audit log auto-cleanup disabled`);
    }
    // ========================================
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down gracefully...');
    if (process.cleanupInterval) {
        clearInterval(process.cleanupInterval);
        console.log('🧹 Audit log cleanup interval cleared');
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Server shutting down gracefully...');
    if (process.cleanupInterval) {
        clearInterval(process.cleanupInterval);
        console.log('🧹 Audit log cleanup interval cleared');
    }
    process.exit(0);
});
