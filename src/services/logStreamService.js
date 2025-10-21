class LogStreamService {
    constructor() {
        // Map of jobId -> array of log entries
        this.logs = new Map();
        // Map of jobId -> array of SSE response objects
        this.clients = new Map();
    }

    // Add a log entry for a job
    addLog(jobId, message, level = 'info') {
        if (!this.logs.has(jobId)) {
            this.logs.set(jobId, []);
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            jobId
        };

        this.logs.get(jobId).push(logEntry);

        // Send to all connected clients
        this.broadcast(jobId, logEntry);

        // Keep only last 500 logs per job to prevent memory issues
        const logs = this.logs.get(jobId);
        if (logs.length > 500) {
            this.logs.set(jobId, logs.slice(-500));
        }
    }

    // Get all logs for a job
    getLogs(jobId) {
        return this.logs.get(jobId) || [];
    }

    // Clear logs for a job
    clearLogs(jobId) {
        this.logs.delete(jobId);
        this.closeAllClients(jobId);
    }

    // Register a new SSE client
    addClient(jobId, res) {
        if (!this.clients.has(jobId)) {
            this.clients.set(jobId, []);
        }
        this.clients.get(jobId).push(res);

        // Send existing logs to new client
        const existingLogs = this.getLogs(jobId);
        existingLogs.forEach(log => {
            this.sendToClient(res, log);
        });
    }

    // Remove a client
    removeClient(jobId, res) {
        if (!this.clients.has(jobId)) return;

        const clients = this.clients.get(jobId);
        const index = clients.indexOf(res);
        if (index > -1) {
            clients.splice(index, 1);
        }

        if (clients.length === 0) {
            this.clients.delete(jobId);
        }
    }

    // Broadcast log to all clients watching this job
    broadcast(jobId, logEntry) {
        if (!this.clients.has(jobId)) return;

        const clients = this.clients.get(jobId);
        clients.forEach(client => {
            this.sendToClient(client, logEntry);
        });
    }

    // Send log entry to a specific client
    sendToClient(res, logEntry) {
        try {
            res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
        } catch (error) {
            console.error('[LogStream] Error sending to client:', error.message);
        }
    }

    // Close all clients for a job
    closeAllClients(jobId) {
        if (!this.clients.has(jobId)) return;

        const clients = this.clients.get(jobId);
        clients.forEach(client => {
            try {
                client.write('event: close\ndata: {}\n\n');
                client.end();
            } catch (error) {
                // Client already closed
            }
        });

        this.clients.delete(jobId);
    }

    // Cleanup old logs (call periodically)
    cleanup(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours default
        const now = Date.now();
        for (const [jobId, logs] of this.logs.entries()) {
            if (logs.length === 0) continue;

            const lastLog = logs[logs.length - 1];
            const lastLogTime = new Date(lastLog.timestamp).getTime();

            if (now - lastLogTime > maxAgeMs) {
                this.clearLogs(jobId);
            }
        }
    }
}

module.exports = new LogStreamService();
