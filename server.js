// ============================================================
// server.js - Mèo Nổ Online (Exploding Kittens) Main Server
// Express + Socket.io real-time multiplayer game server
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const RoomManager = require('./server/RoomManager');

// --- Khởi tạo server ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Phục vụ file tĩnh từ thư mục public/
app.use(express.static(path.join(__dirname, 'public')));

// Khởi tạo bộ quản lý phòng
const roomManager = new RoomManager(io);

// ============================================================
// Socket.io - Xử lý kết nối
// ============================================================
io.on('connection', (socket) => {
  console.log(`[KẾT NỐI] Người chơi kết nối: ${socket.id}`);

  // --- Quản lý phòng ---

  // Tạo phòng mới
  socket.on('create_room', (data) => {
    roomManager.createRoom(socket, data);
  });

  // Tham gia phòng
  socket.on('join_room', (data) => {
    roomManager.joinRoom(socket, data);
  });

  // Rời phòng
  socket.on('leave_room', () => {
    roomManager.leaveRoom(socket);
  });

  // Bật/tắt trạng thái sẵn sàng
  socket.on('toggle_ready', () => {
    roomManager.toggleReady(socket);
  });

  // Bắt đầu game (chỉ chủ phòng)
  socket.on('start_game', () => {
    roomManager.startGame(socket);
  });

  // Quay lại phòng chờ sau khi game kết thúc
  socket.on('return_to_lobby', () => {
    roomManager.returnToLobby(socket);
  });

  // --- Hành động trong game ---

  // Đánh lá bài
  socket.on('play_cards', (data) => {
    roomManager.forwardToGame(socket, 'handlePlayCards', [
      socket.id,
      data.cardIds,
      data.targetId
    ]);
  });

  // Rút bài
  socket.on('draw_card', () => {
    roomManager.forwardToGame(socket, 'handleDrawCard', [socket.id]);
  });

  // Phản hồi Nope
  socket.on('nope_response', (data) => {
    roomManager.forwardToGame(socket, 'handleNopeResponse', [
      socket.id,
      data.useNope
    ]);
  });

  // Cho bài (khi bị Favor)
  socket.on('favor_give', (data) => {
    roomManager.forwardToGame(socket, 'handleFavorGive', [
      socket.id,
      data.cardId
    ]);
  });

  // Đặt Mèo Nổ lại vào bộ bài (sau khi Defuse)
  socket.on('defuse_place', (data) => {
    roomManager.forwardToGame(socket, 'handleDefusePlace', [
      socket.id,
      data.position
    ]);
  });

  // Chọn bài từ xấp bài bỏ (Combo 5 lá)
  socket.on('discard_picker_pick', (data) => {
    roomManager.forwardToGame(socket, 'handleDiscardPickerPick', [
      socket.id,
      data.cardId
    ]);
  });

  // --- Ngắt kết nối ---
  socket.on('disconnect', () => {
    console.log(`[NGẮT KẾT NỐI] Người chơi rời: ${socket.id}`);
    roomManager.handleDisconnect(socket);
  });
});

// ============================================================
// Khởi động server
// ============================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🐱💣 Mèo Nổ Online - Server đang chạy!`);
  console.log(`📡 Cổng: ${PORT}`);
  console.log(`🌐 Truy cập: http://localhost:${PORT}\n`);
});
