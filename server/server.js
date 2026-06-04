const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://127.0.0.1:64317', // Browser preview proxy
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
    
    sessions[sessionId] = {
        ...sessionData,
        lastUpdated: new Date().toISOString()
    };
    
    saveSessions(sessions);
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

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Story Point Estimator Server running on port ${PORT}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`💾 Sessions stored in: ${SESSIONS_FILE}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Server shutting down gracefully...');
    process.exit(0);
});
