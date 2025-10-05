#!/usr/bin/env node

/**
 * Development WebSocket server script
 * Runs a simple WebSocket server for local development
 */

const { WebSocketServer } = require('../dist/server/websocket-server');

const port = process.env.WEBSOCKET_PORT || 8080;

console.log('Starting WebSocket server for development...');

const wsServer = new WebSocketServer(port);
wsServer.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down WebSocket server...');
    wsServer.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nShutting down WebSocket server...');
    wsServer.stop();
    process.exit(0);
});
