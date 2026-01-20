// Quick test script to verify game flow and card dealing
import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';

// Get tokens for two players
async function getToken() {
  const res = await fetch('http://localhost:3000/api/auth/anonymous', { method: 'POST' });
  const data = await res.json();
  return data.data;
}

// Create a room
async function createRoom(token) {
  const res = await fetch('http://localhost:3000/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'Test Room',
      variant: 'texas-holdem',
      stakes: { smallBlind: 1, bigBlind: 2, minBuyIn: 40, maxBuyIn: 200 },
      maxPlayers: 9,
      isPrivate: false,
    }),
  });
  const data = await res.json();
  return data.data.room;
}

// Create socket connection
function createSocket(token) {
  return io(SERVER_URL, {
    auth: { token },
    autoConnect: true,
  });
}

async function runTest() {
  console.log('🎰 Starting Poker Game Test...\n');

  // Get tokens for two players
  console.log('1. Getting tokens for two players...');
  const player1Auth = await getToken();
  const player2Auth = await getToken();
  console.log(`   Player 1: ${player1Auth.user.username} (${player1Auth.user.id})`);
  console.log(`   Player 2: ${player2Auth.user.username} (${player2Auth.user.id})`);

  // Create room
  console.log('\n2. Creating room...');
  const room = await createRoom(player1Auth.token);
  console.log(`   Room created: ${room.code}`);

  // Connect sockets
  console.log('\n3. Connecting players...');
  const socket1 = createSocket(player1Auth.token);
  const socket2 = createSocket(player2Auth.token);

  // Track game states
  let player1State = null;
  let player2State = null;

  // Set up event handlers
  socket1.on('connect', () => console.log('   Player 1 connected'));
  socket2.on('connect', () => console.log('   Player 2 connected'));

  socket1.on('room:joined', (data) => {
    console.log(`   Player 1 joined room as ${data.username}`);
  });

  socket2.on('room:joined', (data) => {
    console.log(`   Player 2 joined room as ${data.username}`);
  });

  socket1.on('game:state', (state) => {
    player1State = state;
    const myPlayer = state.players.find(p => p.oderId === player1Auth.user.id);
    console.log(`   [P1 State] Phase: ${state.phase}, My cards: ${myPlayer?.holeCards?.length || 0}, Valid actions: ${state.validActions?.join(', ') || 'none'}`);
    if (myPlayer?.holeCards?.length > 0) {
      console.log(`   [P1 Cards] ${myPlayer.holeCards.map(c => c.code).join(', ')}`);
    }
  });

  socket2.on('game:state', (state) => {
    player2State = state;
    const myPlayer = state.players.find(p => p.oderId === player2Auth.user.id);
    console.log(`   [P2 State] Phase: ${state.phase}, My cards: ${myPlayer?.holeCards?.length || 0}, Valid actions: ${state.validActions?.join(', ') || 'none'}`);
    if (myPlayer?.holeCards?.length > 0) {
      console.log(`   [P2 Cards] ${myPlayer.holeCards.map(c => c.code).join(', ')}`);
    }
  });

  socket1.on('error', (err) => console.error('   [P1 Error]', err));
  socket2.on('error', (err) => console.error('   [P2 Error]', err));

  // Wait for connections
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Join room
  console.log('\n4. Joining room...');
  socket1.emit('room:join', room.code);
  socket2.emit('room:join', room.code);
  await new Promise(resolve => setTimeout(resolve, 500));

  // Sit at table
  console.log('\n5. Sitting at table...');
  socket1.emit('room:sit', 0, 100); // Seat 0, buy-in 100
  await new Promise(resolve => setTimeout(resolve, 300));
  socket2.emit('room:sit', 1, 100); // Seat 1, buy-in 100
  await new Promise(resolve => setTimeout(resolve, 500));

  // Start game (only host can start)
  console.log('\n6. Starting game...');
  socket1.emit('game:start');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check results
  console.log('\n7. Checking results...');
  if (player1State && player1State.phase !== 'waiting') {
    const p1Cards = player1State.players.find(p => p.oderId === player1Auth.user.id)?.holeCards;
    const p2CardsVisibleToP1 = player1State.players.find(p => p.oderId === player2Auth.user.id)?.holeCards;

    console.log(`\n   ✅ Game started successfully!`);
    console.log(`   Phase: ${player1State.phase}`);
    console.log(`   Player 1 sees their own cards: ${p1Cards ? 'YES (' + p1Cards.map(c=>c.code).join(', ') + ')' : 'NO'}`);
    console.log(`   Player 1 sees Player 2's cards: ${p2CardsVisibleToP1 ? 'YES (BUG!)' : 'NO (correct - hidden)'}`);

    if (player2State) {
      const p2Cards = player2State.players.find(p => p.oderId === player2Auth.user.id)?.holeCards;
      console.log(`   Player 2 sees their own cards: ${p2Cards ? 'YES (' + p2Cards.map(c=>c.code).join(', ') + ')' : 'NO'}`);
    }

    // Test action
    if (player1State.validActions?.length > 0) {
      console.log(`\n8. Testing action (Player 1 checks/calls)...`);
      const action = player1State.validActions.includes('check') ? 'check' : 'call';
      socket1.emit('game:action', { type: action, timestamp: Date.now() });
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`   Action '${action}' sent`);
    }
  } else {
    console.log(`\n   ❌ Game did not start. Phase: ${player1State?.phase || 'unknown'}`);
  }

  // Cleanup
  console.log('\n9. Cleaning up...');
  socket1.disconnect();
  socket2.disconnect();

  console.log('\n✅ Test complete!\n');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
