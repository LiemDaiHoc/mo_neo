/**
 * test_multi_round_bot.js
 * Comprehensive Multiplayer Headless Simulation for Exploding Kittens Online.
 * Plays 3 consecutive full rounds, simulating real bot interactions:
 * - Playing Skip, Attack, Shuffle, See Future, Favor, Cat Pairs, Discard Combos.
 * - Reactive Nope / Counter-Nope battles.
 * - Simulating disconnection/reconnection of Player 2 in the middle of active play.
 * - Recycling the lobby using the return_to_lobby socket event to immediately restart a new game.
 */

const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const ROOM_CODE = 'PLAY5';
const BOT_COUNT = 3;
const GAME_ROUNDS_TO_PLAY = 3;

let activeSockets = [];
let gameRound = 1;
let playersReadyMap = new Map();
let currentTurnTimeout = null;

// Enriched card names dictionary for pretty logging
const CARD_NAMES = {
  nope: '🚫 Phản Đối',
  attack: '⚔️ Tấn Công',
  skip: '⏭️ Bỏ Lượt',
  see_future: '🔮 Nhìn Tương Lai',
  shuffle: '🔀 Xáo Bài',
  favor: '🎁 Xin Xỏ',
  defuse: '🔧 Tháo Ngòi',
  exploding_kitten: '💣 Mèo Nổ',
  cat_taco: '🌮 Mèo Taco',
  cat_melon: '🍉 Mèo Melon',
  cat_beard: '🧔 Mèo Râu Cằm',
  cat_rainbow: '🌈 Mèo Cầu Vồng'
};

function getCardName(type) {
  return CARD_NAMES[type] || type;
}

console.log(`\n========================================================================`);
console.log(`🎮 KHỞI CHẠY BỘ MÔ PHỎNG MULTIPLAYER CHƠI TRỰC TUYẾN LIÊN TỤC 3 VÁN`);
console.log(`📡 Đang nhắm tới server local: ${SERVER_URL}`);
console.log(`========================================================================\n`);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Spawns a socket client acting as a smart bot
function spawnBot(name, avatar, isHost) {
  const socket = io(SERVER_URL, {
    forceNew: true,
    transports: ['websocket'],
    timeout: 10000
  });

  let myIndex = -1;
  let myHand = [];
  let currentGameState = null;

  socket.on('connect', () => {
    console.log(`🔌 [${name}] Kết nối thành công. Socket ID: ${socket.id}`);
  });

  socket.on('error_message', (data) => {
    console.error(`❌ [${name} ERROR]`, data.message);
  });

  socket.on('room_created', (data) => {
    console.log(`🏠 [${name}] Phòng đã tạo thành công! Mã phòng: ${data.roomCode}`);
  });

  socket.on('room_joined', (data) => {
    console.log(`👥 [${name}] Đã vào phòng: ${data.roomCode}`);
    
    // Auto toggle ready if not host
    if (!isHost) {
      setTimeout(() => {
        console.log(`⚡ [${name}] Sẵn sàng!`);
        socket.emit('toggle_ready');
      }, 500);
    }
  });

  socket.on('returned_to_lobby', (data) => {
    console.log(`🔄 [${name}] Quay lại phòng chờ thành công!`);
    
    // Auto toggle ready if not host
    if (!isHost) {
      setTimeout(() => {
        console.log(`⚡ [${name}] Sẵn sàng ván tiếp theo!`);
        socket.emit('toggle_ready');
      }, 1000);
    }
  });

  socket.on('player_ready', (data) => {
    const readyPlayers = data.room.players.filter(p => p.ready);
    const guests = data.room.players.filter(p => p.id !== data.room.hostId);
    console.log(`📢 [Lobby Info] Trạng thái phòng chờ: ${readyPlayers.length}/${data.room.players.length} sẵn sàng.`);
    
    // If host and all guests ready, start game
    if (isHost) {
      const allGuestsReady = guests.every(p => p.ready);
      if (allGuestsReady && data.room.players.length === BOT_COUNT) {
        console.log(`🚀 [Host] Tất cả người chơi đã sẵn sàng! Bắt đầu ván số ${gameRound}...`);
        setTimeout(() => {
          socket.emit('start_game');
        }, 1500);
      }
    }
  });

  socket.on('game_started', (data) => {
    console.log(`🎮 [${name}] Game đã bắt đầu!`);
  });

  socket.on('game_state', async (state) => {
    currentGameState = state;
    myIndex = state.myIndex;
    myHand = state.myHand || [];

    // Only decide actions if it is my turn and game is not processing
    const isMyTurn = state.currentPlayerIndex === myIndex;
    
    if (isMyTurn) {
      // Small debounce to make visual logs readable
      clearTimeout(currentTurnTimeout);
      currentTurnTimeout = setTimeout(() => {
        makeBotTurn(socket, name, myHand, state);
      }, 1500);
    }
  });

  socket.on('nope_window', (data) => {
    // Decides randomly whether to Nope or counter-Nope with 35% probability
    const hasNope = myHand.some(c => c.type === 'nope');
    if (hasNope) {
      const wantsToNope = Math.random() < 0.35;
      console.log(`⏱️ [${name}] Có Phản Đối trên tay. Quyết định: ${wantsToNope ? '🚫 ĐÁNH PHẢN ĐỐI!' : 'Bỏ qua'}`);
      
      setTimeout(() => {
        socket.emit('nope_response', { useNope: wantsToNope });
      }, 800 + Math.random() * 800);
    }
  });

  socket.on('favor_request', (data) => {
    console.log(`🎁 [${name}] Bị ${data.requesterName} xin bài!`);
    
    setTimeout(() => {
      if (myHand.length > 0) {
        // Give a random card
        const cardToGive = myHand[Math.floor(Math.random() * myHand.length)];
        console.log(`🎁 [${name}] Cho đi lá bài: ${getCardName(cardToGive.type)}`);
        socket.emit('favor_give', { cardId: cardToGive.id });
      }
    }, 1200);
  });

  socket.on('defuse_prompt', (data) => {
    console.log(`🔧 [${name}] 💥 BỐC PHẢI MÈO NỔ! Đang dùng Tháo Ngòi...`);
    
    setTimeout(() => {
      // Put EK at a random position (0 = top, deckSize = bottom)
      const position = Math.floor(Math.random() * (data.deckSize + 1));
      console.log(`🔧 [${name}] Đặt lại Mèo Nổ vào bộ bài tại vị trí: ${position}`);
      socket.emit('defuse_place', { position });
    }, 1800);
  });

  socket.on('discard_picker_prompt', (data) => {
    console.log(`✨ [${name}] Đánh Combo 5 lá! Đang chọn bài từ xấp bài bỏ...`);
    
    setTimeout(() => {
      if (data.discardPile && data.discardPile.length > 0) {
        // Pick a card that is not EK
        const safeCards = data.discardPile.filter(c => c.type !== 'exploding_kitten');
        const cardToPick = safeCards.length > 0 ? safeCards[0] : data.discardPile[0];
        console.log(`✨ [${name}] Lấy lá bài từ xấp bỏ: ${getCardName(cardToPick.type)}`);
        socket.emit('discard_picker_pick', { cardId: cardToPick.id });
      }
    }, 1500);
  });

  socket.on('game_over', (data) => {
    console.log(`🏆 [${name} GAME OVER] Trò chơi kết thúc! Người thắng cuộc: ${data.winnerName || 'Không có'}`);
    
    if (isHost) {
      if (gameRound < GAME_ROUNDS_TO_PLAY) {
        gameRound++;
        console.log(`\n========================================================================`);
        console.log(`🔄 VÁN ${gameRound - 1} HOÀN TẤT. KHỞI ĐỘNG VÁN SỐ ${gameRound}...`);
        console.log(`========================================================================\n`);
        
        setTimeout(() => {
          console.log(`🏠 [Host] Yêu cầu quay lại phòng chờ...`);
          socket.emit('return_to_lobby');
        }, 3000);
      } else {
        console.log(`\n🎉 KHẢO SÁT & CHƠI ĐỦ 3 VÁN THÀNH CÔNG RỰC RỠ!`);
        console.log(`🧹 Dọn dẹp kết nối, dừng chương trình.`);
        activeSockets.forEach(s => s.disconnect());
        process.exit(0);
      }
    }
  });

  return socket;
}

// Autonomous bot turn action decision maker
function makeBotTurn(socket, name, hand, state) {
  console.log(`🎯 [Lượt của ${name}] Đang phân tích bài trên tay (${hand.length} lá)...`);
  
  // 1. Search for normal action cards we can play
  const playableActions = hand.filter(c => 
    ['skip', 'attack', 'see_future', 'shuffle', 'favor'].includes(c.type)
  );

  // 2. Search for Cat pairs
  const catCards = hand.filter(c => 
    ['cat_taco', 'cat_melon', 'cat_beard', 'cat_rainbow'].includes(c.type)
  );
  
  const catGroups = {};
  catCards.forEach(c => {
    if (!catGroups[c.type]) catGroups[c.type] = [];
    catGroups[c.type].push(c);
  });
  
  const playablePairs = Object.values(catGroups).filter(g => g.length >= 2);

  // 3. Search for 5 different cards combo
  const uniqueTypes = [...new Set(hand.map(c => c.type))].filter(t => t !== 'defuse' && t !== 'nope');
  const has5Combo = uniqueTypes.length >= 5;

  const decisionRoll = Math.random();

  // Pick alive opponent
  const opponents = state.opponents || [];
  const aliveOpponents = opponents.filter(o => o.isAlive);
  const randomOpponent = aliveOpponents.length > 0 
    ? aliveOpponents[Math.floor(Math.random() * aliveOpponents.length)] 
    : null;

  if (has5Combo && decisionRoll < 0.2) {
    // Play 5 different cards combo!
    const cardsToPlay = [];
    const addedTypes = new Set();
    for (const type of uniqueTypes) {
      if (addedTypes.size >= 5) break;
      const card = hand.find(c => c.type === type);
      if (card) {
        cardsToPlay.push(card.id);
        addedTypes.add(type);
      }
    }
    console.log(`✨ [${name}] Quyết định đánh Combo 5 lá khác biệt!`);
    socket.emit('play_cards', { cardIds: cardsToPlay, targetId: null });
    return;
  }

  if (playablePairs.length > 0 && randomOpponent && decisionRoll < 0.3) {
    // Play a cat pair
    const pair = playablePairs[0];
    const cardIds = [pair[0].id, pair[1].id];
    console.log(`🐱 [${name}] Quyết định đánh Cặp Mèo: ${getCardName(pair[0].type)} → Ăn cắp bài của ${randomOpponent.name}`);
    socket.emit('play_cards', { cardIds, targetId: randomOpponent.id });
    return;
  }

  if (playableActions.length > 0 && decisionRoll < 0.5) {
    // Play a single action card
    const card = playableActions[Math.floor(Math.random() * playableActions.length)];
    const needsTarget = card.type === 'favor' && randomOpponent;
    console.log(`🃏 [${name}] Quyết định đánh lá bài: ${getCardName(card.type)}${needsTarget ? ` nhắm vào ${randomOpponent.name}` : ''}`);
    socket.emit('play_cards', { 
      cardIds: [card.id], 
      targetId: needsTarget ? randomOpponent.id : null 
    });
    return;
  }

  // Otherwise, default to drawing a card
  console.log(`📥 [${name}] Quyết định bốc bài kết thúc lượt.`);
  socket.emit('draw_card');
}

// Runs the multi-round integration flow
async function startMultiRoundFlow() {
  // Connect Host
  const host = spawnBot('HostCat', '😺', true);
  activeSockets.push(host);

  // Allow host to connect first, then create room with custom code
  await sleep(1500);
  console.log(`🏠 [HostCat] Gửi yêu cầu tạo phòng với mã tự chọn: ${ROOM_CODE}...`);
  host.emit('create_room', { name: 'HostCat', avatar: '😺', maxPlayers: 5, roomCode: ROOM_CODE });

  await sleep(1500);

  // Connect guest bots
  for (let i = 1; i < BOT_COUNT; i++) {
    const name = `PlayerBot_${i}`;
    const avatar = ['😸', '😹', '😻', '😼'][i - 1];
    const bot = spawnBot(name, avatar, false);
    activeSockets.push(bot);
    
    await sleep(800);
    console.log(`🚪 [${name}] Gửi yêu cầu tham gia phòng ${ROOM_CODE}...`);
    bot.emit('join_room', { roomCode: ROOM_CODE, name, avatar });
  }

  // --- Simulate Disconnection & Reconnection during Game 2 ---
  // In the middle of play, we drop PlayerBot_1 and let them reconnect successfully
  setTimeout(async () => {
    const botToDisconnect = activeSockets[1]; // PlayerBot_1
    if (botToDisconnect && botToDisconnect.connected) {
      console.log(`\n========================================================================`);
      console.log(`⚠️ HỆ THỐNG: Giả lập PlayerBot_1 đột ngột rớt mạng (Disconnect)...`);
      console.log(`========================================================================\n`);
      
      botToDisconnect.disconnect();
      
      await sleep(6000); // Wait 6 seconds (well inside the 60s grace timeout)
      
      console.log(`\n========================================================================`);
      console.log(`🔄 HỆ THỐNG: Tiến hành kết nối lại cho PlayerBot_1 bằng Socket mới...`);
      console.log(`========================================================================\n`);
      
      // Spawn new socket under same name and join
      const reconnectedBot = spawnBot('PlayerBot_1', '😸', false);
      activeSockets[1] = reconnectedBot;
      
      await sleep(1000);
      reconnectedBot.emit('join_room', { roomCode: ROOM_CODE, name: 'PlayerBot_1', avatar: '😸' });
    }
  }, 16000); // Trigger mid-game during round 1/2
}

startMultiRoundFlow();
