import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import * as path from 'path';
import * as fs from 'fs';

import devicesRouter from './routes/devices';
import schedulesRouter from './routes/schedules';
import settingsRouter from './routes/settings';
import dccRouter from './routes/dcc';
import statusRouter from './routes/status';
import { dccService } from './services/dcc.service';
import { getSettings } from './services/data.service';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/devices', devicesRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/dcc', dccRouter);
app.use('/api/status', statusRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files
const frontendPath = path.join(__dirname, 'public');
if (fs.existsSync(frontendPath)) {
  console.log(`Serving frontend from: ${frontendPath}`);
  app.use(express.static(frontendPath));
  // Handle Angular routing - return index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });
} else {
  console.warn(`Frontend build not found at: ${frontendPath}`);
}

// Create HTTP server
const server = createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Set<WebSocket>();

function getStatus(): void {
    if (dccService.isConnected()) {
        dccService.sendCommand('<s><=><c><#><iDCC-EX>');
    }
}

setInterval(() => getStatus(), 4000);

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  clients.add(ws);

  // Send current status
  const status = dccService.getStatus();
  ws.send(JSON.stringify({ type: 'status', data: { backend: true, dccex: status.connected, power: status.power } }));

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(message: object): void {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// DCC-EX events to WebSocket broadcasts
dccService.on('status', (status) => {
  broadcast({ type: 'status', data: { backend: true, dccex: status.connected, power: status.power } });
});

dccService.on('message', (message) => {
  broadcast({ type: 'dcc-message', data: message });
});

dccService.on('power', (power) => {
  broadcast({ type: 'power', data: power });
});

// Start server
server.listen(PORT, () => {
  console.log(`DCC-EX Backend server running on port ${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);

  // Auto-connect to DCC-EX if configured
  const settings = getSettings();
  if (settings.dccex.autoConnect) {
    console.log(`Attempting to connect to DCC-EX at ${settings.dccex.host}:${settings.dccex.port}...`);
    dccService.configure(settings.dccex.host, settings.dccex.port);
    dccService.connect().then((connected) => {
      if (connected) {
        console.log('Connected to DCC-EX');
      } else {
        console.log('Failed to connect to DCC-EX (will retry)');
      }
    });
  }
});

export { app, server };
