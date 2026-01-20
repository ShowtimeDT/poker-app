# Poker App Architecture

## Overview

A full-stack real-time poker application built as a monorepo using Turborepo.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Monorepo** | Turborepo v2.3.0 |
| **Frontend** | Next.js 14 + React 18 + TailwindCSS |
| **Backend** | Fastify + Socket.IO |
| **Database** | PostgreSQL + Prisma ORM |
| **State** | Zustand (client) |
| **Animations** | Framer Motion |
| **Validation** | Zod |
| **Language** | TypeScript 5.3 |

## Directory Structure

```
poker-app/
├── apps/
│   ├── server/                 # Fastify backend
│   │   ├── prisma/             # Database schema
│   │   └── src/
│   │       ├── routes/         # REST API endpoints
│   │       ├── services/       # Business logic (RoomManager)
│   │       └── socket/         # WebSocket handlers
│   │
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # Pages (App Router)
│           ├── components/     # React components
│           │   ├── game/       # Game-specific components
│           │   └── ui/         # Shared UI components
│           ├── hooks/          # Custom React hooks
│           ├── lib/            # Utilities
│           └── stores/         # Zustand stores
│
├── packages/
│   ├── poker-engine/           # Core game logic
│   │   └── src/
│   │       ├── deck/           # Card dealing & shuffling
│   │       ├── evaluator/      # Hand evaluation
│   │       ├── state/          # Game state machine
│   │       └── variants/       # Poker variant implementations
│   │
│   ├── shared/                 # Shared types & constants
│   │   └── src/
│   │       ├── types/          # TypeScript interfaces
│   │       └── constants/      # Game constants
│   │
│   └── ui/                     # Shared UI components (future)
│
├── ARCHITECTURE.md             # This file
├── CHECKLIST.md                # Development checklist
├── turbo.json                  # Turborepo config
└── package.json                # Root package
```

## Data Flow

### 1. Game Start Flow

```
[Host clicks Start]
    → socket.emit('game:start')
    → Server: handleGameEvents()
    → RoomManager.startHand()
    → PokerGameState.startHand()
        - Reset player states
        - Shuffle deck (crypto-secure)
        - Post blinds
        - Deal hole cards → stored in holeCards Map
    → For each player: getGameState(roomId, oderId)
        - Attaches that player's hole cards only
    → socket.emit('game:state', personalizedState) to each player
    → Client: gameStore.setGameState()
    → UI: PokerTable renders with cards
```

### 2. Player Action Flow

```
[Player clicks Fold/Check/Call/Bet/Raise]
    → ActionButtons.onAction(type, amount)
    → sendAction({ type, amount, timestamp })
    → socket.emit('game:action', action)
    → Server: RoomManager.processAction()
    → PokerGameState.processAction()
        - Validate action
        - Execute action
        - Advance game (next player or next phase)
    → Broadcast updated state to all players
    → If hand complete: emit 'game:winner'
```

### 3. State Management

```
Frontend (Zustand):
  gameStore
    ├── isConnected: boolean
    ├── userId: string | null
    ├── room: Room | null
    ├── players: RoomPlayer[]
    ├── gameState: GameState | null
    ├── chat: ChatMessage[]
    └── winners: WinnerInfo[]

Backend (In-Memory):
  RoomManager
    ├── rooms: Map<roomId, ActiveRoom>
    ├── playerRooms: Map<oderId, roomId>
    └── roomCodes: Map<code, roomId>

  ActiveRoom
    ├── room: Room
    ├── gameState: PokerGameState
    ├── players: Map<oderId, RoomPlayer>
    └── spectators: Set<oderId>
```

## Component Architecture

### Game Components

```
PokerTable
├── TableSurface          # Green felt background
├── CommunityCards        # 5 card slots in center
├── PotDisplay            # Pot amount
├── PlayerSeat (x9)       # Player positions
│   ├── HoleCards         # Player's cards
│   ├── PlayerAvatar      # Profile picture
│   └── PlayerInfo        # Name + chips
├── DealerButton          # D button
├── BetDisplay (per seat) # Current bet amount
└── EmptySeat             # Clickable "Sit" button

ActionButtons
├── FoldButton
├── CheckButton
├── CallButton
├── BetButton → RaiseSlider
├── RaiseButton → RaiseSlider
└── AllInButton
```

### Card Components

```
PlayingCard
├── CardFront (suit + rank display)
└── CardBack (decorative pattern)

CardFan       # For displaying hole cards with overlap
CommunityCards # 5 slots with empty placeholders
```

## Socket Events

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `game:state` | `GameState` | Updated game state |
| `game:action` | `PlayerAction + playerId` | Action taken |
| `game:winner` | `WinnerInfo[]` | Hand winners |
| `room:joined` | `{room, userId, username}` | Room join success |
| `room:player-joined` | `RoomPlayer` | New player sat down |
| `room:player-left` | `playerId` | Player left |
| `room:chat` | `ChatMessage` | Chat message |
| `error` | `{code, message}` | Error occurred |

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `game:action` | `PlayerAction` | Player action |
| `game:start` | none | Host starts hand |
| `room:join` | `roomCode, password?` | Join room |
| `room:sit` | `seat, buyIn` | Sit at table |
| `room:stand` | none | Leave seat |
| `room:leave` | none | Leave room |
| `room:chat` | `message` | Send chat |

## Security

1. **Cryptographic Shuffling**: Uses Web Crypto API with Fisher-Yates algorithm
2. **Provably Fair**: Server seeds with SHA-256 hashing
3. **JWT Authentication**: Fastify JWT for user auth
4. **Hole Card Privacy**: Each player only receives their own hole cards
5. **Input Validation**: Zod schemas on all API inputs

## Game Variants Supported

- Texas Hold'em (implemented)
- Omaha (implemented)
- Omaha Hi-Lo (partial)
- Seven Card Stud (partial)
- Five Card Draw (partial)
- Blackjack (partial)

## Key Design Decisions

1. **Monorepo**: Enables code sharing between frontend/backend via packages
2. **In-Memory State**: RoomManager keeps active games in memory for performance
3. **Personalized State**: Each player receives state with only their own hole cards
4. **Socket.IO**: Chosen over raw WebSockets for reconnection handling and rooms
5. **Zustand over Redux**: Simpler state management for this use case
