# Poker App Development Checklist

## Phase 1: Core Functionality (Current Focus)

### Card Display
- [x] PlayingCard component with front/back
- [x] CardFan for hole cards
- [x] CommunityCards with 5 slots
- [x] Card flip animations
- [x] Debug logging added to trace card display
- [x] Server sends personalized state with holeCards per player

### Action Buttons
- [x] ActionButtons component structure
- [x] Fold/Check/Call/Bet/Raise/All-In buttons
- [x] RaiseSlider with presets
- [x] Fixed type mismatch: ActionType wrapper for PlayerAction
- [x] Added validActions to GameState type
- [x] Server computes valid actions per player turn
- [x] Frontend uses validActions from server

### Game Flow
- [x] Room creation
- [x] Room joining via code
- [x] Player sit/stand
- [x] Game start (host)
- [x] Blinds posting
- [x] Hole card dealing
- [x] Community card dealing
- [x] Turn progression
- [x] Showdown and winner resolution
- [ ] Next hand auto-start

### State Management
- [x] Zustand store setup
- [x] Socket event handlers
- [x] GameState updates
- [x] Personalized state per player
- [x] Hole card privacy (only own cards visible)

### Build & Config
- [x] Fixed server tsconfig (noEmit for dev)
- [x] Fixed socket.ts type errors
- [x] Build passes for both web and server

## Phase 2: Game Variants

### Texas Hold'em
- [x] Basic game flow
- [x] Hand evaluation
- [ ] Side pot calculation
- [ ] Run it twice/thrice

### Omaha
- [x] 4 hole cards dealing
- [x] Must-use-2 evaluation
- [ ] Hi-Lo split logic

### Other Variants
- [ ] Seven Card Stud streets
- [ ] Five Card Draw
- [ ] Blackjack mode

## Phase 3: Advanced Features

### Bomb Pots
- [ ] Force ante from all players
- [ ] Skip preflop betting
- [ ] Deal flop immediately
- [ ] Double board option

### Straddles
- [ ] UTG straddle
- [ ] Multiple straddle support
- [ ] Blind structure adjustment

### Dealer's Choice
- [ ] Dealer picks variant UI
- [ ] Variant switching between hands
- [ ] Allowed variants configuration

### Time Bank
- [ ] Turn timer display
- [ ] Time bank reserve
- [ ] Auto-fold on timeout

## Phase 4: UI/UX Polish

### Animations
- [x] Card dealing animation
- [x] Card flip animation
- [ ] Chip movement animation
- [ ] Pot collection animation
- [ ] Winner highlight animation

### Responsiveness
- [ ] Mobile layout
- [ ] Tablet layout
- [ ] Desktop optimization

### Accessibility
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] High contrast mode

## Phase 5: Production Readiness

### Database Integration
- [x] Prisma schema defined
- [ ] Persist rooms to database
- [ ] Hand history storage
- [ ] Player statistics

### Testing
- [ ] Unit tests for poker-engine
- [ ] Integration tests for API
- [ ] E2E tests for game flow

### DevOps
- [ ] Docker configuration
- [ ] CI/CD pipeline
- [ ] Production deployment
- [ ] Monitoring/logging

---

## Session Progress Log

### Session 1 (Current)

**Completed:**
1. Created ARCHITECTURE.md with full system overview
2. Created CHECKLIST.md (this file)
3. Fixed sendAction type mismatch (ActionType to PlayerAction wrapper)
4. Fixed server tsconfig for monorepo compatibility
5. Fixed socket.ts type error with emit
6. Added validActions to GameState interface
7. Server now computes and sends validActions per player
8. Frontend uses dynamic validActions from server
9. Added debug logging for card display tracing
10. Improved getSocketId to return null and log warnings

**Architecture Changes:**
- `packages/shared/src/types/index.ts`: Added `validActions?: ActionType[]` to GameState
- `packages/poker-engine/src/state/index.ts`: getState() now includes validActions for current player
- `apps/web/src/app/room/[code]/page.tsx`: Uses gameState.validActions instead of hardcoded list
- `apps/server/src/socket/index.ts`: getSocketId returns null instead of empty string

**Build Status:** Passing

**Known Issues:**
- Need actual browser testing to verify card display
- Debug logs will show in dev mode to help diagnose any remaining issues

---

*Last Updated: Session 1 in progress*
