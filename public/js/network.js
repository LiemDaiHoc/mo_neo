/**
 * network.js - Socket.io client for online multiplayer
 * Mèo Nổ (Exploding Kittens) Browser Game
 */

const Network = {
  socket: null,
  roomCode: null,
  myPlayerId: null,
  isHost: false,
  isConnected: false,

  // ===== Connection =====

  connect() {
    if (this.socket && this.isConnected) return;

    if (typeof io === 'undefined') {
      console.warn('[Network] Socket.io is not loaded. Cannot connect online.');
      if (typeof UI !== 'undefined' && typeof UI.showRoomError === 'function') {
        UI.showRoomError('Không thể kết nối đến server. Socket.io chưa được tải.');
      }
      return;
    }

    this.socket = io();

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.myPlayerId = this.socket.id;
      console.log('[Network] Đã kết nối:', this.myPlayerId);
      UI.updateConnectionStatus(true);
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('[Network] Mất kết nối');
      UI.updateConnectionStatus(false);
      UI.showDisconnectMessage();
    });

    this.socket.on('reconnect', () => {
      this.isConnected = true;
      UI.updateConnectionStatus(true);
    });

    this._setupRoomEvents();
    this._setupGameEvents();
  },

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.roomCode = null;
    this.myPlayerId = null;
    this.isHost = false;
  },

  // ===== Room Actions =====

  createRoom(name, avatar, maxPlayers, roomCode) {
    if (!this.socket) return;
    this.socket.emit('create_room', { name, avatar, maxPlayers, roomCode });
  },

  returnToLobby() {
    if (!this.socket) return;
    this.socket.emit('return_to_lobby');
  },

  joinRoom(roomCode, name, avatar) {
    if (!this.socket) return;
    this.socket.emit('join_room', { roomCode, name, avatar });
  },

  leaveRoom() {
    if (!this.socket) return;
    this.socket.emit('leave_room');
    this.roomCode = null;
    this.isHost = false;
  },

  toggleReady() {
    if (!this.socket) return;
    this.socket.emit('toggle_ready');
  },

  startGame() {
    if (!this.socket || !this.isHost) return;
    this.socket.emit('start_game');
  },

  // ===== Game Actions =====

  playCards(cardIds, targetId) {
    if (!this.socket) return;
    this.socket.emit('play_cards', { cardIds, targetId });
  },

  drawCard() {
    if (!this.socket) return;
    this.socket.emit('draw_card');
  },

  nopeResponse(useNope) {
    if (!this.socket) return;
    this.socket.emit('nope_response', { useNope });
  },

  favorGive(cardId) {
    if (!this.socket) return;
    this.socket.emit('favor_give', { cardId });
  },

  defusePlace(position) {
    if (!this.socket) return;
    this.socket.emit('defuse_place', { position });
  },

  discardPickerPick(cardId) {
    if (!this.socket) return;
    this.socket.emit('discard_picker_pick', { cardId });
  },

  // ===== Room Event Listeners =====

  _setupRoomEvents() {
    const s = this.socket;

    s.on('room_created', (data) => {
      console.log('[Network] Phòng đã tạo:', data.roomCode);
      this.roomCode = data.roomCode;
      this.isHost = true;
      UI.showWaitingRoom(data);
    });

    s.on('room_joined', (data) => {
      console.log('[Network] Đã vào phòng:', data.roomCode);
      this.roomCode = data.roomCode;
      this.isHost = data.room ? (data.room.hostId === this.myPlayerId) : false;
      
      if (data.room && data.room.status === 'playing') {
        // Reconnection success! Switch to game screen
        UI.showGame();
        Game.initOnline();
      } else {
        UI.showWaitingRoom(data);
      }
    });

    s.on('player_joined', (data) => {
      console.log('[Network] Người chơi vào:', data.player.name);
      UI.updateWaitingRoom(data);
    });

    s.on('player_left', (data) => {
      console.log('[Network] Người chơi rời:', data.playerId);
      // If host left and we're new host, update status immediately before drawing
      if (data.newHostId) {
        this.isHost = (data.newHostId === this.myPlayerId);
      }
      UI.updateWaitingRoom(data);
    });

    s.on('player_ready', (data) => {
      console.log('[Network] Người chơi sẵn sàng:', data.playerId);
      UI.updateWaitingRoom(data);
    });

    s.on('room_error', (data) => {
      console.error('[Network] Lỗi phòng:', data.message);
      UI.showRoomError(data.message);
    });

    s.on('returned_to_lobby', (data) => {
      UI.closeModal();
      UI.stopConfetti();
      document.getElementById('game-over-screen')?.classList.remove('active');
      document.getElementById('game-screen')?.classList.remove('active');
      
      // Reset local Game state
      Game.phase = 'menu';
      Game.gameMode = 'online';
      
      // Update waiting room UI
      UI.showWaitingRoom(data);
    });

    s.on('player_disconnected_grace', (data) => {
      Game.addLog(`⚠️ ${data.playerName} mất kết nối! Đang chờ kết nối lại (60 giây)...`);
    });

    s.on('player_reconnected', (data) => {
      Game.addLog(`⚡ ${data.playerName} đã kết nối lại thành công!`);
      UI.updateWaitingRoom(data);
    });
  },

  // ===== Game Event Listeners =====

  _setupGameEvents() {
    const s = this.socket;

    s.on('game_started', (data) => {
      console.log('[Network] Game bắt đầu!');
      Game.initOnline(data);
    });

    s.on('game_state', (data) => {
      console.log('[Network] Cập nhật trạng thái game');
      Game.updateFromServer(data);
    });

    s.on('card_played', (data) => {
      // data: { playerIndex, playerName, cardType, cardName, targetName }
      if (data.cardType) {
        let cardObj;
        if (data.cardType === 'cat_pair') {
          // Construct 2 dummy card objects for pair animation
          const cardInfo = { emoji: '🐱', name: data.cardName || 'Bài Mèo', gradient: ['#ff9f43', '#ff5252'] };
          cardObj = [{ id: 'dummy_cat1', ...cardInfo }, { id: 'dummy_cat2', ...cardInfo }];
        } else if (data.cardType === 'five_card_combo') {
          // Construct 5 dummy card objects for 5-card combo animation
          const cardInfo = { emoji: '✨', name: data.cardName || 'Combo 5 Lá', gradient: ['#ec4899', '#8b5cf6'] };
          cardObj = Array.from({ length: 5 }, (_, i) => ({ id: `dummy_combo_${i}`, ...cardInfo }));
        } else {
          const info = typeof CARD_INFO !== 'undefined' ? CARD_INFO[data.cardType] : null;
          cardObj = info ? { ...info, id: 'dummy_' + data.cardType } : { id: 'dummy_' + data.cardType, emoji: '🃏', name: data.cardName || data.cardType, gradient: ['#444','#666'] };
        }
        
        Sounds.cardPlay();
        UI.animateCardPlay(cardObj, { index: data.playerIndex, name: data.playerName });
      }
    });

    s.on('exploding_kitten_drawn', (data) => {
      // data: { playerIndex, playerName }
      Sounds.explosion();
      Sounds.vibrateExplosion();
      UI.showExplosion({ name: data.playerName });
    });

    s.on('defuse_used', (data) => {
      // data: { playerIndex, playerName }
      Sounds.defuse();
      setTimeout(() => UI.hideExplosion(), 800);
      Game.addLog(`🔧 ${data.playerName} dùng Tháo Ngòi!`);
    });

    s.on('player_eliminated', (data) => {
      // data: { playerIndex, playerName }
      Sounds.eliminated();
      setTimeout(() => UI.hideExplosion(), 1200);
      Game.addLog(`💀 ${data.playerName} đã bị loại!`);
    });

    s.on('nope_window', (data) => {
      // data: { card, playedBy, timeoutMs }
      // Only show if we have a Nope card
      UI.showOnlineNopePrompt(data);
    });

    s.on('nope_played', (data) => {
      // data: { playerIndex, playerName, nopeCount }
      Sounds.nope();
      Game.addLog(`🚫 ${data.playerName} đánh Phản Đối!`);
      if (typeof UI !== 'undefined' && typeof UI.triggerNopeGlitchEffect === 'function') {
        UI.triggerNopeGlitchEffect(data.playerName);
      }
    });

    s.on('nope_resolved', () => {
      UI.closeModal();
    });

    s.on('see_future_result', (data) => {
      // data: { cards }
      Sounds.seeFuture();
      // Enrich cards with display info
      const enriched = (data.cards || []).map(c => {
        const info = typeof CARD_INFO !== 'undefined' ? CARD_INFO[c.type] : null;
        return info ? { ...c, ...info } : c;
      });
      UI.showSeeFuture(enriched);
    });

    s.on('favor_request', (data) => {
      // data from server: { requesterName, requesterId }
      // Get my hand from local game state
      const myPlayer = Game.players.find(p => p.isHuman);
      const myHand = myPlayer ? myPlayer.hand : [];
      UI.showOnlineFavorChoice({
        fromPlayerName: data.requesterName,
        myHand: myHand
      });
    });

    s.on('discard_picker_prompt', (data) => {
      UI.showOnlineDiscardPicker(data.discardPile);
    });

    s.on('defuse_prompt', (data) => {
      // data: { deckSize }
      UI.showOnlineDefusePlacement(data.deckSize);
    });

    s.on('turn_start', (data) => {
      // data: { currentPlayerIndex, playerName, turnsToPlay }
      // [BUG-010 FIX] Dùng player.index thay vì array index để tránh lệch sau khi ai đó bị loại
      const isMyTurn = Game.players.find(p => p.index === data.currentPlayerIndex)?.id === this.myPlayerId;
      if (isMyTurn) {
        Game.addLog(`🎯 Lượt của bạn!`);
        Sounds.turnStart();
        UI._turnFlashShown = false; // Reset for new turn
        UI.enablePlayerActions();
      } else {
        Game.addLog(`⏳ ${data.playerName} đang chơi...`);
        UI.showTurnGlow(false);
      }
    });

    s.on('game_over', (data) => {
      // data: { winnerId, winnerName }
      const isWinner = data.winnerId === this.myPlayerId;
      Game.phase = GamePhase.GAME_OVER;
      UI.showGameOver({
        name: data.winnerName,
        isHuman: isWinner
      });
    });

    s.on('game_log', (data) => {
      // data: { message }
      Game.addLog(data.message);
    });

    s.on('deck_shuffled', () => {
      Sounds.shuffle();
      UI.animateShuffle();
    });
  }
};
