import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@poker/shared';

// =============================================================================
// TYPES
// =============================================================================

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// =============================================================================
// SOCKET SINGLETON
// =============================================================================

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

let socket: TypedSocket | null = null;

/**
 * Generate a random ID for anonymous users
 */
function generateAnonId(): string {
  return 'anon_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Get or create a persistent anonymous ID for this browser session
 * This ensures the same ID is used across socket reconnections
 */
function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') {
    return generateAnonId();
  }

  let anonId = localStorage.getItem('poker_anon_id');
  if (!anonId) {
    anonId = generateAnonId();
    localStorage.setItem('poker_anon_id', anonId);
  }
  return anonId;
}

/**
 * Get or create socket connection
 */
export function getSocket(token?: string): TypedSocket {
  // Reuse existing socket if it exists (even if disconnected - it will reconnect)
  if (socket) {
    return socket;
  }

  // Use token from localStorage if not provided (for consistent identity)
  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('poker_token') : null);

  // Get persistent anonymous ID for users without a token
  const anonId = !authToken ? getOrCreateAnonId() : undefined;

  socket = io(SOCKET_URL, {
    auth: { token: authToken, anonId },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    socket.onAny((event, ...args) => {
      console.log('[Socket]', event, args);
    });
  }

  return socket;
}

/**
 * Disconnect socket
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Check if socket is connected
 */
export function isConnected(): boolean {
  return socket?.connected ?? false;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Wait for socket to connect
 */
export function waitForConnection(timeoutMs: number = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket?.connected) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Socket connection timeout'));
    }, timeoutMs);

    socket?.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });

    socket?.once('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Emit with acknowledgment
 */
export function emitWithAck<T>(
  event: keyof ClientToServerEvents,
  ...args: unknown[]
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Socket not connected'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 10000);

    // Use type assertion for dynamic event emission
    (socket as Socket).emit(event, ...args, (response: T) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}
