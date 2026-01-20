import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

// =============================================================================
// SCHEMAS
// =============================================================================

const RegisterSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email().optional(),
});

const LoginSchema = z.object({
  username: z.string(),
  password: z.string().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Generate anonymous token
   * Allows players to start playing immediately without signup
   */
  fastify.post('/anonymous', async (request, reply) => {
    const username = generateUsername();
    const oderId = `anon_${generateId()}`;

    const token = fastify.jwt.sign(
      {
        sub: oderId,
        username,
        isAnonymous: true,
      },
      { expiresIn: '30d' }
    );

    return {
      success: true,
      data: {
        token,
        user: {
          id: oderId,
          username,
          isAnonymous: true,
          chips: 10000, // Starting chips
        },
      },
    };
  });

  /**
   * Register new account
   * Can convert anonymous account to registered
   */
  fastify.post('/register', async (request, reply) => {
    const body = RegisterSchema.parse(request.body);

    // TODO: Implement with database
    // For now, just generate a token
    const oderId = `user_${generateId()}`;

    const token = fastify.jwt.sign(
      {
        sub: oderId,
        username: body.username,
        email: body.email,
        isAnonymous: false,
      },
      { expiresIn: '30d' }
    );

    return {
      success: true,
      data: {
        token,
        user: {
          id: oderId,
          username: body.username,
          email: body.email,
          isAnonymous: false,
          chips: 10000,
        },
      },
    };
  });

  /**
   * Get current user info
   */
  fastify.get('/me', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.status(401).send({ success: false, error: 'No token provided' });
      }

      const decoded = fastify.jwt.verify<{
        sub: string;
        username: string;
        isAnonymous: boolean;
      }>(token);

      return {
        success: true,
        data: {
          id: decoded.sub,
          username: decoded.username,
          isAnonymous: decoded.isAnonymous,
          chips: 10000, // TODO: Get from database
        },
      };
    } catch {
      return reply.status(401).send({ success: false, error: 'Invalid token' });
    }
  });
};

// =============================================================================
// HELPERS
// =============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

function generateUsername(): string {
  const adjectives = [
    'Lucky', 'Wild', 'Bold', 'Swift', 'Sharp', 'Slick', 'Cool', 'Hot', 'Fast', 'Smooth',
    'Clever', 'Wise', 'Brave', 'Keen', 'Quick', 'Smart', 'Sly', 'Crafty', 'Nimble', 'Steady',
  ];
  const nouns = [
    'Ace', 'King', 'Queen', 'Jack', 'Dealer', 'Shark', 'Wolf', 'Fox', 'Eagle', 'Tiger',
    'Hawk', 'Bear', 'Lion', 'Falcon', 'Panther', 'Viper', 'Cobra', 'Phoenix', 'Dragon', 'Raven',
  ];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);

  return `${adj}${noun}${num}`;
}
