/**
 * test_new_features.js
 * Automated integration test verifying:
 * 1. Custom room code creation.
 * 2. Graceful 1-minute reconnection on socket disconnect.
 * 3. Fast and clean return-to-lobby restart flow.
 */

const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

console.log('🏁 Khởi chạy kiểm thử tự động các tính năng mới...');

async function runTest() {
  return new Promise((resolve, reject) => {
    let client1, client2, client2Reconnected;
    const customRoomCode = 'MO123';

    // Helper to connect a socket client
    function connectClient(name) {
      const socket = io(SERVER_URL, {
        forceNew: true,
        transports: ['websocket']
      });

      socket.on('connect', () => {
        console.log(`🔌 [${name}] Đã kết nối với ID: ${socket.id}`);
      });

      socket.on('error_message', (data) => {
        console.error(`❌ [${name}] LỖI TỪ SERVER:`, data.message);
      });

      return socket;
    }

    // Connect Host
    client1 = connectClient('HostCat');

    client1.on('room_created', (data) => {
      console.log(`🏠 [HostCat] Tạo phòng thành công! Mã phòng: ${data.roomCode}`);
      if (data.roomCode !== customRoomCode) {
        reject(new Error(`Thất bại: Mã phòng không trùng với mã tự chọn ${customRoomCode} (Nhận được: ${data.roomCode})`));
        return;
      }
      console.log(`✅ 1. Kiểm thử tạo phòng bằng mã tự chọn THÀNH CÔNG!`);

      // Connect Player 2
      client2 = connectClient('PlayerCat');

      client2.on('room_joined', (joinData) => {
        console.log(`👥 [PlayerCat] Vào phòng ${customRoomCode} thành công!`);
        
        // Simulates a disconnect on PlayerCat after joining
        console.log(`⚡ [PlayerCat] Simulating unexpected disconnect...`);
        setTimeout(() => {
          client2.disconnect();
          console.log(`🔌 [PlayerCat] Socket đã ngắt kết nối.`);
          
          // Verify that after disconnect, PlayerCat can reconnect with same name and room code
          setTimeout(() => {
            console.log(`🔄 [PlayerCat] Tiến hành kết nối lại với Socket ID mới...`);
            client2Reconnected = connectClient('PlayerCat');
            
            client2Reconnected.on('room_joined', (reconnectData) => {
              console.log(`✅ 2. Kết nối lại thành công! Trở lại phòng: ${reconnectData.roomCode}`);
              console.log(`👥 Danh sách người chơi hiện tại:`, reconnectData.room.players.map(p => `${p.name} (ID: ${p.id}, Disconnected: ${p.disconnected})`).join(', '));
              
              const p = reconnectData.room.players.find(p => p.name === 'PlayerCat');
              if (p && !p.disconnected && p.id === client2Reconnected.id) {
                console.log(`✅ 3. Khôi phục socket ID mới và trạng thái người chơi THÀNH CÔNG!`);
                
                // Now test ready and start game
                console.log('⚡ [PlayerCat] Gửi trạng thái sẵn sàng...');
                client2Reconnected.emit('toggle_ready');
              } else {
                reject(new Error('Thất bại: Thông tin người chơi kết nối lại không trùng khớp'));
              }
            });

            // Trigger join room to reconnect
            setTimeout(() => {
              client2Reconnected.emit('join_room', { roomCode: customRoomCode, name: 'PlayerCat', avatar: '😸' });
            }, 500);

          }, 1500);

        }, 1000);
      });

      client1.on('player_ready', (readyData) => {
        console.log(`📢 [HostCat] Nhận tin: Có người chơi sẵn sàng!`);
        
        // Host starts the game
        console.log('🚀 [HostCat] Bắt đầu game!');
        client1.emit('start_game');
      });

      client1.on('game_started', () => {
        console.log(`🎮 Game bắt đầu thành công!`);
        
        // Now test Return to Lobby
        console.log(`🔄 [HostCat] Phát tín hiệu quay lại phòng chờ (Return to Lobby)...`);
        setTimeout(() => {
          client1.emit('return_to_lobby');
        }, 1000);
      });

      client1.on('returned_to_lobby', (data) => {
        console.log(`✅ 4. Quay lại sảnh chờ thành công! Trạng thái phòng:`, data.room.status);
        console.log(`✅ Kiểm thử toàn bộ tính năng mới hoàn thành xuất sắc!`);
        
        // Cleanup
        client1.disconnect();
        if (client2Reconnected) client2Reconnected.disconnect();
        resolve();
      });

      // Join room
      setTimeout(() => {
        client2.emit('join_room', { roomCode: customRoomCode, name: 'PlayerCat', avatar: '😸' });
      }, 500);
    });

    // Create room with custom code
    setTimeout(() => {
      console.log(`🏠 [HostCat] Đang gửi yêu cầu tạo phòng với mã tự chọn: ${customRoomCode}...`);
      client1.emit('create_room', { name: 'HostCat', avatar: '😺', maxPlayers: 4, roomCode: customRoomCode });
    }, 1000);
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
