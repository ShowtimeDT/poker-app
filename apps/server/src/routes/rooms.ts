import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { GameVariant, Stakes, CustomRules } from '@poker/shared';
import { DEFAULT_CUSTOM_RULES, STAKES_PRESETS } from '@poker/shared';

// =============================================================================
// SCHEMAS
// =============================================================================

const CreateRoomSchema = z.object({
  name: z.string().min(1).max(50),
  variant: z.enum([
    'texas-holdem',
    'omaha',
    'omaha-hi-lo',
    'seven-card-stud',
    'five-card-draw',
    'blackjack',
  ]),
  stakes: z.object({
    smallBlind: z.number().positive(),
    bigBlind: z.number().positive(),
    minBuyIn: z.number().positive(),
    maxBuyIn: z.number().positive(),
  }),
  maxPlayers: z.number().min(2).max(10).default(9),
  isPrivate: z.boolean().default(true),
  password: z.string().optional(),
  customRules: z.record(z.unknown()).optional(),
});

const JoinRoomSchema = z.object({
  code: z.string().length(6),
  password: z.string().optional(),
});

// =============================================================================
// ROUTES
// =============================================================================

export const roomRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Create new room
   */
  fastify.post('/', async (request, reply) => {
    try {
      // Verify auth
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const decoded = fastify.jwt.verify<{ sub: string; username: string }>(token);
      const body = CreateRoomSchema.parse(request.body);

      const room = fastify.roomManager.createRoom({
        name: body.name,
        variant: body.variant as GameVariant,
        stakes: body.stakes as Stakes,
        maxPlayers: body.maxPlayers,
        isPrivate: body.isPrivate,
        password: body.password,
        hostId: decoded.sub,
        customRules: body.customRules as Partial<CustomRules>,
      });

      return {
        success: true,
        data: {
          room: {
            id: room.id,
            code: room.code,
            name: room.name,
            variant: room.variant,
            stakes: room.stakes,
            maxPlayers: room.maxPlayers,
            isPrivate: room.isPrivate,
            hostId: room.hostId,
          },
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  /**
   * Get room by code
   */
  fastify.get('/:code', async (request, reply) => {
    const { code } = request.params as { code: string };

    const activeRoom = fastify.roomManager.getRoomByCode(code);
    if (!activeRoom) {
      return reply.status(404).send({
        success: false,
        error: 'Room not found',
      });
    }

    const room = activeRoom.room;
    const playerCount = activeRoom.players.size;

    return {
      success: true,
      data: {
        room: {
          id: room.id,
          code: room.code,
          name: room.name,
          variant: room.variant,
          stakes: room.stakes,
          maxPlayers: room.maxPlayers,
          playerCount,
          isPrivate: room.isPrivate,
          hasPassword: room.hasPassword,
          status: room.status,
        },
      },
    };
  });

  /**
   * List public rooms
   */
  fastify.get('/', async () => {
    const rooms = fastify.roomManager.listPublicRooms();

    return {
      success: true,
      data: {
        rooms: rooms.map(room => {
          const activeRoom = fastify.roomManager.getRoom(room.id);
          return {
            id: room.id,
            code: room.code,
            name: room.name,
            variant: room.variant,
            stakes: room.stakes,
            maxPlayers: room.maxPlayers,
            playerCount: activeRoom?.players.size || 0,
            status: room.status,
          };
        }),
      },
    };
  });

  /**
   * Get stakes presets
   */
  fastify.get('/presets/stakes', async () => {
    return {
      success: true,
      data: { presets: STAKES_PRESETS },
    };
  });

  /**
   * Get default rules
   */
  fastify.get('/presets/rules', async () => {
    return {
      success: true,
      data: { defaultRules: DEFAULT_CUSTOM_RULES },
    };
  });

  /**
   * Get server stats
   */
  fastify.get('/stats', async () => {
    const stats = fastify.roomManager.getStats();
    return {
      success: true,
      data: stats,
    };
  });
};
