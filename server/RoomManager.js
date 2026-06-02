// ============================================================
// RoomManager.js - Quản lý phòng chơi Mèo Nổ
// Tạo, tham gia, rời phòng, bắt đầu game
// ============================================================

const ServerGame = require('./ServerGame');

class RoomManager {
  constructor(io) {
    this.io = io;
    // Map: roomCode → room object
    this.rooms = new Map();
    // Map: socketId → roomCode (để tìm phòng nhanh)
    this.socketToRoom = new Map();
    // Map: socketId (old) → timeout object
    this.reconnectTimeouts = new Map();
  }

  // ============================================================
  // Tạo mã phòng ngẫu nhiên 6 ký tự (chữ hoa + số)
  // ============================================================
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code)); // Đảm bảo mã không trùng
    return code;
  }

  // ============================================================
  // Tạo phòng mới
  // ============================================================
  createRoom(socket, { name, avatar, maxPlayers, roomCode }) {
    // Kiểm tra nếu người chơi đang ở phòng khác
    if (this.socketToRoom.has(socket.id)) {
      socket.emit('error_message', { message: 'Bạn đang ở trong một phòng khác!' });
      return;
    }

    // Giới hạn maxPlayers hợp lệ (2-5)
    maxPlayers = Math.min(Math.max(maxPlayers || 4, 2), 5);

    let code = (roomCode || '').toUpperCase().trim();
    if (code) {
      // Validate code (only A-Z, 0-9, length between 2 and 6)
      const validCodeRegex = /^[A-Z0-9]{2,6}$/;
      if (!validCodeRegex.test(code)) {
        socket.emit('error_message', { message: 'Mã phòng phải từ 2-6 ký tự chữ hoặc số!' });
        return;
      }
      if (this.rooms.has(code)) {
        socket.emit('error_message', { message: 'Mã phòng đã tồn tại!' });
        return;
      }
    } else {
      code = this.generateRoomCode();
    }

    const room = {
      code,
      hostId: socket.id,
      players: [
        {
          id: socket.id,
          name: name || 'Người chơi',
          avatar: avatar || 'default',
          ready: false,
          index: 0
        }
      ],
      maxPlayers,
      status: 'waiting', // 'waiting' | 'playing' | 'finished'
      game: null
    };

    this.rooms.set(code, room);
    this.socketToRoom.set(socket.id, code);

    // Cho socket vào room channel của Socket.io
    socket.join(code);

    socket.emit('room_created', {
      roomCode: code,
      room: this.sanitizeRoom(room)
    });

    console.log(`[PHÒNG] ${name} tạo phòng ${code} (tối đa ${maxPlayers} người)`);
  }

  // ============================================================
  // Tham gia phòng
  // ============================================================
  joinRoom(socket, { roomCode, name, avatar }) {
    // Kiểm tra nếu người chơi đang ở phòng khác
    if (this.socketToRoom.has(socket.id)) {
      socket.emit('error_message', { message: 'Bạn đang ở trong một phòng khác!' });
      return;
    }

    const code = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(code);

    // Kiểm tra phòng tồn tại
    if (!room) {
      socket.emit('error_message', { message: 'Phòng không tồn tại!' });
      return;
    }

    // Kiểm tra nếu đây là kết nối lại của người chơi bị rớt mạng
    const disconnectedPlayer = room.players.find(p => p.name === name && p.disconnected);
    if (disconnectedPlayer) {
      const oldSocketId = disconnectedPlayer.id;
      
      // Hủy bỏ timeout kết nối lại
      const timeout = this.reconnectTimeouts.get(oldSocketId);
      if (timeout) {
        clearTimeout(timeout);
        this.reconnectTimeouts.delete(oldSocketId);
      }
      
      // Cập nhật lại socket ID mới
      disconnectedPlayer.id = socket.id;
      disconnectedPlayer.disconnected = false;
      
      this.socketToRoom.delete(oldSocketId);
      this.socketToRoom.set(socket.id, code);
      
      socket.join(code);
      
      console.log(`[PHÒNG] ${name} kết nối lại thành công phòng ${code}.`);
      
      // Nếu chủ phòng cũ bị rớt mạng và kết nối lại, cập nhật lại hostId
      if (room.hostId === oldSocketId) {
        room.hostId = socket.id;
      }
      
      // Thông báo cho các người chơi khác
      socket.to(code).emit('player_reconnected', {
        playerId: socket.id,
        playerName: name,
        room: this.sanitizeRoom(room)
      });
      
      // Phản hồi thành công cho chính client kết nối lại
      socket.emit('room_joined', {
        roomCode: code,
        room: this.sanitizeRoom(room)
      });
      
      // Cập nhật socket ID mới vào game instance nếu đang chơi
      if (room.game) {
        room.game.handlePlayerReconnect(oldSocketId, socket.id);
      }
      
      return;
    }

    // Kiểm tra trạng thái phòng
    if (room.status !== 'waiting') {
      socket.emit('error_message', { message: 'Trò chơi đã bắt đầu!' });
      return;
    }

    // Kiểm tra phòng đầy
    if (room.players.length >= room.maxPlayers) {
      socket.emit('error_message', { message: 'Phòng đã đầy!' });
      return;
    }

    // Thêm người chơi vào phòng
    const player = {
      id: socket.id,
      name: name || 'Người chơi',
      avatar: avatar || 'default',
      ready: false,
      index: room.players.length
    };

    room.players.push(player);
    this.socketToRoom.set(socket.id, code);
    socket.join(code);

    // Thông báo cho người vừa tham gia
    socket.emit('room_joined', {
      roomCode: code,
      room: this.sanitizeRoom(room)
    });

    // Thông báo cho những người khác trong phòng
    socket.to(code).emit('player_joined', {
      player: { id: player.id, name: player.name, avatar: player.avatar, index: player.index },
      room: this.sanitizeRoom(room)
    });

    console.log(`[PHÒNG] ${name} tham gia phòng ${code} (${room.players.length}/${room.maxPlayers})`);
  }

  // ============================================================
  // Rời phòng
  // ============================================================
  leaveRoom(socket) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;

    const room = this.rooms.get(code);
    if (!room) {
      this.socketToRoom.delete(socket.id);
      return;
    }

    const leavingPlayer = room.players.find(p => p.id === socket.id);
    const playerName = leavingPlayer ? leavingPlayer.name : 'Không rõ';

    // Nếu game đang chơi, xử lý disconnect trong game
    if (room.game && leavingPlayer) {
      room.game.handlePlayerDisconnect(socket.id);
    }

    // Xóa người chơi khỏi phòng
    room.players = room.players.filter(p => p.id !== socket.id);
    this.socketToRoom.delete(socket.id);
    socket.leave(code);

    // Nếu chủ phòng rời → chuyển host cho người tiếp theo (Host Migration)
    if (room.hostId === socket.id) {
      if (room.players.length > 0) {
        const newHost = room.players[0];
        room.hostId = newHost.id;
        // Chủ phòng mới tự động được đặt làm ready: true hoặc false tùy ý (thường không cần ready vì là host)
        newHost.ready = true; 

        // Cập nhật lại index cho người chơi còn lại
        room.players.forEach((p, i) => { p.index = i; });

        // Thông báo cho tất cả người còn lại biết chủ cũ rời và chuyển host
        this.io.to(code).emit('player_left', {
          playerId: socket.id,
          playerName,
          newHostId: room.hostId,
          room: this.sanitizeRoom(room)
        });

        console.log(`[PHÒNG] Chủ phòng ${playerName} rời phòng ${code}. Chuyển quyền chủ phòng cho ${newHost.name}`);
        return;
      } else {
        // Không còn ai trong phòng → hủy phòng
        if (room.game) {
          room.game.cleanup();
        }
        this.rooms.delete(code);
        console.log(`[PHÒNG] Phòng ${code} bị hủy (không còn ai và chủ phòng rời)`);
        return;
      }
    }

    // Cập nhật lại index cho người chơi còn lại
    room.players.forEach((p, i) => { p.index = i; });

    // Thông báo cho những người còn lại
    this.io.to(code).emit('player_left', {
      playerId: socket.id,
      playerName,
      room: this.sanitizeRoom(room)
    });

    console.log(`[PHÒNG] ${playerName} rời phòng ${code} (còn ${room.players.length}/${room.maxPlayers})`);

    // Nếu phòng trống → xóa
    if (room.players.length === 0) {
      if (room.game) room.game.cleanup();
      this.rooms.delete(code);
      console.log(`[PHÒNG] Phòng ${code} bị xóa (trống)`);
    }
  }

  // ============================================================
  // Bật/tắt trạng thái sẵn sàng
  // ============================================================
  toggleReady(socket) {
    const room = this.getRoomBySocket(socket.id);
    if (!room || room.status !== 'waiting') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // Chủ phòng không cần ready
    if (player.id === room.hostId) return;

    player.ready = !player.ready;

    this.io.to(room.code).emit('player_ready', {
      playerId: socket.id,
      ready: player.ready,
      room: this.sanitizeRoom(room)
    });
  }

  // ============================================================
  // Bắt đầu game (chỉ chủ phòng)
  // ============================================================
  startGame(socket) {
    const room = this.getRoomBySocket(socket.id);
    if (!room) {
      socket.emit('error_message', { message: 'Bạn không ở trong phòng nào!' });
      return;
    }

    // Chỉ chủ phòng mới được bắt đầu
    if (room.hostId !== socket.id) {
      socket.emit('error_message', { message: 'Chỉ chủ phòng mới được bắt đầu trò chơi!' });
      return;
    }

    // Kiểm tra trạng thái phòng
    if (room.status !== 'waiting') {
      socket.emit('error_message', { message: 'Trò chơi đã bắt đầu rồi!' });
      return;
    }

    // Cần ít nhất 2 người chơi
    if (room.players.length < 2) {
      socket.emit('error_message', { message: 'Cần ít nhất 2 người chơi để bắt đầu!' });
      return;
    }

    // Kiểm tra tất cả (trừ host) đã sẵn sàng
    const notReady = room.players.filter(p => p.id !== room.hostId && !p.ready);
    if (notReady.length > 0) {
      const names = notReady.map(p => p.name).join(', ');
      socket.emit('error_message', {
        message: `Người chơi chưa sẵn sàng: ${names}`
      });
      return;
    }

    // Bắt đầu game!
    room.status = 'playing';

    // Chuẩn bị danh sách người chơi cho game engine
    const gamePlayers = room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      index: p.index
    }));

    // Tạo ServerGame instance
    room.game = new ServerGame(this.io, room.code, gamePlayers);
    room.game.start();

    console.log(`[GAME] Phòng ${room.code} bắt đầu chơi với ${gamePlayers.length} người!`);
  }

  // ============================================================
  // Xử lý ngắt kết nối
  // ============================================================
  handleDisconnect(socket) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;

    const room = this.rooms.get(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // Kiểm tra xem phòng còn người trực kết nối khác không
    const activePlayers = room.players.filter(p => p.id !== socket.id && !p.disconnected);
    
    if (activePlayers.length > 0) {
      // Đánh dấu người chơi bị rớt mạng
      player.disconnected = true;
      console.log(`[PHÒNG] ${player.name} mất kết nối đột ngột khỏi phòng ${code}. Chờ kết nối lại trong 60 giây.`);
      
      // Thông báo cho các người chơi khác trong phòng
      this.io.to(code).emit('player_disconnected_grace', {
        playerId: socket.id,
        playerName: player.name,
        graceSeconds: 60
      });
      
      // Hẹn giờ 60 giây để xóa người chơi nếu không kết nối lại
      const timeout = setTimeout(() => {
        console.log(`[PHÒNG] Quá 60s, ${player.name} không kết nối lại phòng ${code}. Xử lý rời phòng.`);
        this.reconnectTimeouts.delete(socket.id);
        
        // Kiểm tra xem phòng còn tồn tại trước khi xử lý
        const currentRoom = this.rooms.get(code);
        if (currentRoom) {
          // Xử lý giống như rời phòng
          this.leaveRoom({ id: socket.id, leave: () => {} });
        }
      }, 60000);
      
      this.reconnectTimeouts.set(socket.id, timeout);
    } else {
      // Không còn ai khác trong phòng trực tuyến → Hủy phòng lập tức
      this.leaveRoom(socket);
    }
  }

  // ============================================================
  // Quay lại phòng chờ
  // ============================================================
  returnToLobby(socket) {
    const room = this.getRoomBySocket(socket.id);
    if (!room) return;

    // Reset trạng thái phòng chờ và dọn dẹp game cũ
    room.status = 'waiting';
    if (room.game) {
      room.game.cleanup();
      room.game = null;
    }

    // Đặt lại trạng thái sẵn sàng cho người chơi
    room.players.forEach(p => {
      p.ready = (p.id === room.hostId);
      p.disconnected = false; // xóa trạng thái mất mạng
    });

    // Hủy các timeout của người chơi trong phòng này
    room.players.forEach(p => {
      const timeout = this.reconnectTimeouts.get(p.id);
      if (timeout) {
        clearTimeout(timeout);
        this.reconnectTimeouts.delete(p.id);
      }
    });

    // Phát sự kiện bắt buộc quay về phòng chờ cho cả phòng
    this.io.to(room.code).emit('returned_to_lobby', {
      roomCode: room.code,
      room: this.sanitizeRoom(room)
    });

    console.log(`[PHÒNG] Phòng ${room.code} quay lại chế độ phòng chờ`);
  }

  // ============================================================
  // Chuyển tiếp hành động game đến ServerGame instance
  // ============================================================
  forwardToGame(socket, method, args) {
    const room = this.getRoomBySocket(socket.id);
    if (!room) {
      socket.emit('error_message', { message: 'Bạn không ở trong phòng nào!' });
      return;
    }

    if (!room.game) {
      socket.emit('error_message', { message: 'Trò chơi chưa bắt đầu!' });
      return;
    }

    if (room.status !== 'playing') {
      socket.emit('error_message', { message: 'Trò chơi chưa bắt đầu hoặc đã kết thúc!' });
      return;
    }

    // Gọi phương thức tương ứng trên ServerGame
    if (typeof room.game[method] === 'function') {
      room.game[method](...args);
    } else {
      console.error(`[LỖI] Phương thức ${method} không tồn tại trên ServerGame`);
    }
  }

  // ============================================================
  // Tìm phòng theo socketId
  // ============================================================
  getRoomBySocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;
    return this.rooms.get(code) || null;
  }

  // ============================================================
  // Lọc thông tin phòng an toàn để gửi cho client
  // (không bao gồm game state bí mật)
  // ============================================================
  sanitizeRoom(room) {
    return {
      code: room.code,
      hostId: room.hostId,
      maxPlayers: room.maxPlayers,
      status: room.status,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        ready: p.ready,
        index: p.index
      }))
    };
  }
}

module.exports = RoomManager;
