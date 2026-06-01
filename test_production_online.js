/**
 * test_production_online.js
 * Headless integration test for Exploding Kittens Online deployed on production Render.
 */

const { io } = require('socket.io-client');

const SERVER_URL = 'https://mo-neo.onrender.com';

console.log('🏁 Khởi chạy kiểm thử tự động trực tuyến trên PRODUCTION Render...');
console.log(`📡 Đang nhắm tới server: ${SERVER_URL}`);

async function runTest() {
  return new Promise((resolve, reject) => {
    let client1, client2;
    let roomCode = null;
    let turnCount = 0;
    let client1HandReceived = false;
    let client2HandReceived = false;

    // Helper function to create a clean socket connection
    function connectClient(name) {
      const socket = io(SERVER_URL, {
        forceNew: true,
        transports: ['websocket'],
        timeout: 20000 // Tăng timeout socket vì Render có thể bị cold start
      });

      socket.on('connect', () => {
        console.log(`🔌 [${name}] Đã kết nối với ID: ${socket.id}`);
      });

      socket.on('connect_error', (err) => {
        console.error(`❌ [${name}] Lỗi kết nối socket:`, err.message);
        console.log(`💡 Mẹo: Có thể server Render đang khởi động lại (cold start). Hãy chờ một chút...`);
      });

      socket.on('error_message', (data) => {
        console.error(`❌ [${name}] LỖI TỪ SERVER:`, data.message);
      });

      return socket;
    }

    // Handle game events
    function registerGameEvents(client, name) {
      client.on('game_started', (data) => {
        console.log(`... [${name}] Game đã bắt đầu! Tổng số người chơi: ${data.playerCount}`);
      });

      client.on('game_state', (state) => {
        console.log(`\n=================== [${name}] Cập nhật Trạng Thái Game ===================`);
        console.log(`Lượt hiện tại của: Người chơi số ${state.currentPlayerIndex}`);
        console.log(`Số bài trong deck: ${state.deckCount}`);
        console.log(`Đống bài bỏ (5 lá gần nhất):`, state.discardPile.map(c => `${c.type}`).join(', ') || 'Rỗng');
        if (state.myHand) {
          console.log(`Bài trên tay của bạn (${state.myHand.length} lá):`);
          state.myHand.forEach((c, idx) => {
            console.log(`   [${idx}] ID: ${c.id} | Loại: ${c.type}`);
          });
          if (name === 'HostCat') client1HandReceived = true;
          if (name === 'PlayerCat') client2HandReceived = true;
        }
        console.log('========================================================================\n');

        // HostCat initiates the first action (draw)
        if (name === 'HostCat' && state.currentPlayerIndex === state.myIndex && turnCount === 0) {
          turnCount++;
          console.log(`🎯 Lượt của HostCat! Tiến hành rút bài để kết thúc lượt...`);
          setTimeout(() => {
            client.emit('draw_card');
          }, 1500);
        }

        // Once PlayerCat receives the turn (currentPlayerIndex === myIndex) and HostCat has already drawn, the test is successful!
        if (name === 'PlayerCat' && state.currentPlayerIndex === state.myIndex && turnCount > 0 && client1HandReceived && client2HandReceived) {
          console.log(`🎉 [PlayerCat] Nhận được lượt đi sau khi HostCat rút bài! Giao thức online hoạt động hoàn hảo trên server production!`);
          setTimeout(() => {
            cleanupAndFinish(true);
          }, 1000);
        }
      });

      client.on('game_log', (data) => {
        console.log(`📜 [${name} LOG] ${data.message}`);
      });

      client.on('turn_start', (data) => {
        console.log(`🔔 [${name}] Bắt đầu lượt của: ${data.playerName} (Phải chơi ${data.turnsToPlay} lượt)`);
      });

      client.on('nope_window', (data) => {
        console.log(`⏱️ [${name}] Cửa sổ Nope được mở! Lá bài đang chờ: ${data.card.type}. Timeout: ${data.timeoutMs}ms`);
        client.emit('nope_response', { useNope: false });
      });

      client.on('game_over', (data) => {
        console.log(`🏆 [${name}] GAME KẾT THÚC! Người chiến thắng: ${data.winnerName}`);
        cleanupAndFinish(true);
      });
    }

    let finished = false;
    function cleanupAndFinish(success) {
      if (finished) return;
      finished = true;

      console.log('\n🧹 Dọn dẹp kết nối...');
      if (client1) client1.disconnect();
      if (client2) client2.disconnect();

      if (success) {
        console.log('✅ KIỂM THỬ TRỰC TUYẾN PRODUCTION THÀNH CÔNG RỰC RỠ!');
        resolve();
      } else {
        console.error('❌ KIỂM THỬ THẤT BẠI!');
        reject(new Error('Kiểm thử thất bại hoặc hết thời gian chờ (Render Cold Start)'));
      }
    }

    // Set a timeout of 40 seconds to allow Render server spin-up
    setTimeout(() => {
      cleanupAndFinish(false);
    }, 40000);

    // Connect Host
    client1 = connectClient('HostCat');
    registerGameEvents(client1, 'HostCat');

    client1.on('room_created', (data) => {
      roomCode = data.roomCode;
      console.log(`🏠 [HostCat] Đã tạo phòng thành công! Mã phòng: ${roomCode}`);

      // Once room is created, connect Player 2 and join
      client2 = connectClient('PlayerCat');
      registerGameEvents(client2, 'PlayerCat');

      client2.on('room_joined', (joinData) => {
        console.log(`👥 [PlayerCat] Đã vào phòng thành công!`);

        // Player 2 toggles ready
        console.log('⚡ [PlayerCat] Gửi trạng thái sẵn sàng...');
        client2.emit('toggle_ready');
      });

      client1.on('player_ready', (readyData) => {
        console.log(`📢 [HostCat] Nhận tin: Có người chơi sẵn sàng!`);
        const p2 = readyData.room.players.find(p => p.id === client2.id);
        console.log(`   PlayerCat ready: ${p2 ? p2.ready : 'không tìm thấy'}`);

        if (p2 && p2.ready) {
          // Both ready! Host starts the game
          console.log('🚀 [HostCat] Gửi yêu cầu Bắt Đầu Game!');
          client1.emit('start_game');
        }
      });

      // Join room
      setTimeout(() => {
        console.log('👥 [PlayerCat] Đang gửi yêu cầu vào phòng...');
        client2.emit('join_room', { roomCode, name: 'PlayerCat', avatar: '😸' });
      }, 500);
    });

    // Wait a bit after connecting client1 to create room (allows Render server to wake up first if sleeping)
    setTimeout(() => {
      console.log('🏠 [HostCat] Đang gửi yêu cầu tạo phòng...');
      client1.emit('create_room', { name: 'HostCat', avatar: '😺', maxPlayers: 4 });
    }, 4000);
  });
}

runTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
