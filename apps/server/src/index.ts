import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { Server } from 'socket.io';

import { setupSocketHandlers } from './socket/index.js';
import { roomRoutes } from './routes/rooms.js';
import { authRoutes } from './routes/auth.js';
import { RoomManager } from './services/RoomManager.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// =============================================================================
// SERVER SETUP
// =============================================================================

async function buildServer() {
  // Create Fastify instance
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  // Register plugins - allow all origins for development
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: JWT_SECRET,
  });

  // Initialize services
  const roomManager = new RoomManager();

  // Decorate fastify with shared instances (placeholders, io set after ready)
  fastify.decorate('io', null as unknown as Server);
  fastify.decorate('roomManager', roomManager);

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(roomRoutes, { prefix: '/api/rooms' });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  return fastify;
}

// =============================================================================
// START SERVER
// =============================================================================

async function start() {
  try {
    const fastify = await buildServer();

    // Start Fastify first so we have access to the underlying HTTP server
    await fastify.listen({ port: PORT, host: HOST });

    // Now create Socket.IO server using Fastify's underlying server
    const io = new Server(fastify.server, {
      cors: {
        origin: [CORS_ORIGIN, 'http://localhost:3000'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Update the io reference
    (fastify as any).io = io;

    // Setup Socket.IO handlers
    setupSocketHandlers(io, fastify.roomManager, fastify);

    fastify.log.info(`Server listening on http://${HOST}:${PORT}`);
    fastify.log.info(`WebSocket server ready`);

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        fastify.log.info(`Received ${signal}, shutting down...`);
        io.close();
        await fastify.close();
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

// =============================================================================
// TYPE DECLARATIONS
// =============================================================================

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
    roomManager: RoomManager;
  }
}
