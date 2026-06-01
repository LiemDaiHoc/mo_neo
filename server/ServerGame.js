// ============================================================
// ServerGame.js - Game Engine Mèo Nổ (Exploding Kittens)
// Xử lý toàn bộ logic game phía server
// ============================================================

// --- Định nghĩa các loại bài ---
const CardType = {
  EXPLODING_KITTEN: 'exploding_kitten',
  DEFUSE: 'defuse',
  SKIP: 'skip',
  ATTACK: 'attack',
  SEE_FUTURE: 'see_future',
  SHUFFLE: 'shuffle',
  NOPE: 'nope',
  FAVOR: 'favor',
  CAT_TACO: 'cat_taco',
  CAT_MELON: 'cat_melon',
  CAT_BEARD: 'cat_beard',
  CAT_RAINBOW: 'cat_rainbow',
  FIVE_CARD_COMBO: 'five_card_combo'
};

// Thông tin hiển thị cho từng loại bài (tiếng Việt)
const CardInfo = {
  [CardType.EXPLODING_KITTEN]: { name: 'Mèo Nổ', emoji: '💣' },
  [CardType.DEFUSE]:           { name: 'Tháo Ngòi', emoji: '🛠️' },
  [CardType.SKIP]:             { name: 'Bỏ Lượt', emoji: '🚫' },
  [CardType.ATTACK]:           { name: 'Tấn Công', emoji: '⚔️' },
  [CardType.SEE_FUTURE]:       { name: 'Nhìn Tương Lai', emoji: '🔮' },
  [CardType.SHUFFLE]:          { name: 'Xáo Bài', emoji: '🔀' },
  [CardType.NOPE]:             { name: 'Phản Đối', emoji: '🚫' },
  [CardType.FAVOR]:            { name: 'Xin Xỏ', emoji: '🙏' },
  [CardType.CAT_TACO]:         { name: 'Mèo Taco', emoji: '🌮' },
  [CardType.CAT_MELON]:        { name: 'Mèo Dưa Hấu', emoji: '🍉' },
  [CardType.CAT_BEARD]:        { name: 'Mèo Râu', emoji: '🧔' },
  [CardType.CAT_RAINBOW]:      { name: 'Mèo Cầu Vồng', emoji: '🌈' },
  [CardType.FIVE_CARD_COMBO]:  { name: 'Combo 5 Lá', emoji: '✨' }
};

// Danh sách các loại bài mèo (dùng để kiểm tra pair)
const CAT_TYPES = [CardType.CAT_TACO, CardType.CAT_MELON, CardType.CAT_BEARD, CardType.CAT_RAINBOW];

// Bộ đếm ID bài duy nhất
let nextCardId = 1;

/**
 * Tạo một lá bài mới với ID duy nhất
 */
function createCard(type) {
  return {
    id: `card_${nextCardId++}`,
    type
  };
}

/**
 * Xáo trộn mảng bằng thuật toán Fisher-Yates
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================================
// ServerGame Class
// ============================================================
class ServerGame {
  /**
   * @param {object} io - Socket.io server instance
   * @param {string} roomCode - Mã phòng
   * @param {Array} players - [{id: socketId, name, avatar, index}]
   */
  constructor(io, roomCode, players) {
    this.io = io;
    this.roomCode = roomCode;

    // Bộ bài chính (index 0 = đáy, index cuối = đỉnh)
    this.deck = [];
    // Bài đã đánh
    this.discardPile = [];

    // Thông tin người chơi trong game
    this.players = players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      hand: [],           // Bài trên tay
      isAlive: true,       // Còn sống?
      turnsToPlay: 1,      // Số lượt phải chơi (Attack tăng thêm)
      index: p.index
    }));

    this.currentPlayerIndex = 0; // Chỉ số người chơi hiện tại
    this.turnCount = 0;          // Đếm lượt
    this.log = [];               // Nhật ký game
    this.pendingAction = null;   // Hành động đang chờ (nope, favor, defuse)
    this.nopeTimer = null;       // Timer cho cửa sổ Nope
    this.isGameOver = false;     // Game đã kết thúc?
  }

  // ============================================================
  // KHỞI ĐẦU GAME
  // ============================================================

  /**
   * Bắt đầu game: tạo bộ bài, chia bài, phát trạng thái
   */
  start() {
    this.addLog('🎮 Trò chơi Mèo Nổ bắt đầu!');

    // 1. Tạo bộ bài (không có Mèo Nổ và Tháo Ngòi)
    this.deck = this.createBaseDeck();
    shuffleArray(this.deck);

    // 2. Chia 7 lá bài cho mỗi người chơi
    for (const player of this.players) {
      for (let i = 0; i < 7; i++) {
        if (this.deck.length > 0) {
          player.hand.push(this.deck.pop());
        }
      }
      // 3. Mỗi người chơi nhận 1 lá Tháo Ngòi
      player.hand.push(createCard(CardType.DEFUSE));
    }

    // 4. Thêm Tháo Ngòi còn lại vào bộ bài
    // Tổng 6 Defuse, đã chia numPlayers lá → còn (6 - numPlayers)
    const remainingDefuse = Math.max(0, 6 - this.players.length);
    for (let i = 0; i < remainingDefuse; i++) {
      this.deck.push(createCard(CardType.DEFUSE));
    }

    // 5. Thêm Mèo Nổ (số người chơi - 1)
    const numEK = this.players.length - 1;
    for (let i = 0; i < numEK; i++) {
      this.deck.push(createCard(CardType.EXPLODING_KITTEN));
    }

    // 6. Xáo lại bộ bài (sau khi thêm EK và Defuse)
    shuffleArray(this.deck);

    this.addLog(`📦 Bộ bài: ${this.deck.length} lá | ${numEK} Mèo Nổ đã được trộn vào!`);

    // 7. Thông báo game bắt đầu
    this.emitToRoom('game_started', {
      playerCount: this.players.length
    });

    // 8. Gửi trạng thái cá nhân cho từng người chơi
    this.broadcastState();

    // 9. Bắt đầu lượt đầu tiên
    this.startTurn();
  }

  /**
   * Tạo bộ bài cơ bản (không có Mèo Nổ và Tháo Ngòi)
   */
  createBaseDeck() {
    const deck = [];

    // Skip x4
    for (let i = 0; i < 4; i++) deck.push(createCard(CardType.SKIP));
    // Attack x4
    for (let i = 0; i < 4; i++) deck.push(createCard(CardType.ATTACK));
    // See Future x5
    for (let i = 0; i < 5; i++) deck.push(createCard(CardType.SEE_FUTURE));
    // Shuffle x4
    for (let i = 0; i < 4; i++) deck.push(createCard(CardType.SHUFFLE));
    // Nope x5
    for (let i = 0; i < 5; i++) deck.push(createCard(CardType.NOPE));
    // Favor x4
    for (let i = 0; i < 4; i++) deck.push(createCard(CardType.FAVOR));
    // Mỗi loại mèo x4
    for (const catType of CAT_TYPES) {
      for (let i = 0; i < 4; i++) deck.push(createCard(catType));
    }

    return deck;
  }

  // ============================================================
  // TRẠNG THÁI GAME
  // ============================================================

  /**
   * Tạo trạng thái game riêng biệt cho từng người chơi
   * Mỗi người chỉ thấy bài của mình, không thấy bài người khác
   */
  getPersonalizedState(playerId) {
    const self = this.players.find(p => p.id === playerId);
    if (!self) return null;

    return {
      // Thông tin chung
      roomCode: this.roomCode,
      deckCount: this.deck.length,
      discardPile: this.discardPile.slice(-5), // 5 lá gần nhất trên đống bỏ
      currentPlayerIndex: this.currentPlayerIndex,
      turnCount: this.turnCount,
      log: this.log.slice(-20), // 20 dòng log gần nhất
      isGameOver: this.isGameOver,

      // Thông tin cá nhân
      myIndex: self.index,
      myHand: self.hand,
      myTurnsToPlay: self.turnsToPlay,

      // Thông tin đối thủ (chỉ số lá bài, không phải nội dung)
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        index: p.index,
        cardCount: p.hand.length,
        isAlive: p.isAlive,
        turnsToPlay: p.turnsToPlay,
        isCurrentTurn: p.index === this.currentPlayerIndex
      })),

      // Pending action (nếu có liên quan đến người chơi này)
      pendingAction: this.getPendingActionForPlayer(playerId)
    };
  }

  /**
   * Lọc thông tin pending action phù hợp cho người chơi cụ thể
   */
  getPendingActionForPlayer(playerId) {
    if (!this.pendingAction) return null;

    const action = this.pendingAction;

    switch (action.type) {
      case 'nope':
        return {
          type: 'nope',
          cardPlayed: action.cardType,
          cardName: CardInfo[action.cardType]?.name || action.cardType,
          playedByName: action.playedByName,
          targetName: action.targetName || null,
          nopeCount: action.nopeCount || 0,
          timeLeft: Math.max(0, Math.ceil((action.expiresAt - Date.now()) / 1000))
        };

      case 'favor':
        // Chỉ người bị xin mới cần biết chi tiết
        if (action.targetId === playerId) {
          return {
            type: 'favor',
            requesterId: action.requesterId,
            requesterName: action.requesterName
          };
        }
        return {
          type: 'favor_waiting',
          targetName: action.targetName
        };

      case 'defuse':
        // Chỉ người cần đặt Mèo Nổ mới cần biết
        if (action.playerId === playerId) {
          return {
            type: 'defuse',
            maxPosition: this.deck.length // Vị trí tối đa (đặt ở đáy)
          };
        }
        return {
          type: 'defuse_waiting',
          playerName: action.playerName
        };

      case 'discard_picker':
        if (action.playerId === playerId) {
          return {
            type: 'discard_picker',
            discardPile: this.discardPile.map(c => ({
              id: c.id,
              type: c.type
            }))
          };
        }
        return {
          type: 'discard_picker_waiting',
          playerName: action.playerName
        };

      default:
        return null;
    }
  }

  /**
   * Gửi trạng thái cá nhân hóa cho tất cả người chơi
   */
  broadcastState() {
    for (const player of this.players) {
      if (!player.isAlive) continue;
      const state = this.getPersonalizedState(player.id);
      this.emitTo(player.id, 'game_state', state);
    }
  }

  // ============================================================
  // QUẢN LÝ LƯỢT CHƠI
  // ============================================================

  /**
   * Bắt đầu lượt mới
   */
  startTurn() {
    if (this.isGameOver) return;

    const current = this.players[this.currentPlayerIndex];
    if (!current || !current.isAlive) {
      this.advanceToNextPlayer();
      return;
    }

    this.turnCount++;
    const turnMsg = current.turnsToPlay > 1
      ? `👉 Lượt của ${current.name} (còn ${current.turnsToPlay} lượt)`
      : `👉 Lượt của ${current.name}`;

    this.addLog(turnMsg);

    this.emitToRoom('turn_start', {
      currentPlayerIndex: this.currentPlayerIndex,
      playerName: current.name,
      turnsToPlay: current.turnsToPlay
    });

    this.broadcastState();
  }

  /**
   * Chuyển sang người chơi tiếp theo còn sống
   */
  advanceToNextPlayer() {
    if (this.isGameOver) return;

    // Tìm người chơi tiếp theo còn sống
    const numPlayers = this.players.length;
    let nextIndex = this.currentPlayerIndex;

    do {
      nextIndex = (nextIndex + 1) % numPlayers;
      // Tránh vòng lặp vô hạn
      if (nextIndex === this.currentPlayerIndex) break;
    } while (!this.players[nextIndex].isAlive);

    this.currentPlayerIndex = nextIndex;

    // Đặt lại turnsToPlay nếu chưa có (mặc định 1)
    const nextPlayer = this.players[this.currentPlayerIndex];
    if (nextPlayer.turnsToPlay <= 0) {
      nextPlayer.turnsToPlay = 1;
    }

    this.startTurn();
  }

  // ============================================================
  // ĐÁNH BÀI
  // ============================================================

  /**
   * Xử lý khi người chơi đánh bài
   * @param {string} playerId - Socket ID
   * @param {string[]} cardIds - Mảng ID các lá bài đánh
   * @param {string} targetId - Socket ID mục tiêu (nếu cần)
   */
  handlePlayCards(playerId, cardIds, targetId) {
    if (this.isGameOver) return;

    const player = this.players.find(p => p.id === playerId);
    if (!player || !player.isAlive) {
      this.emitTo(playerId, 'error_message', { message: 'Bạn đã bị loại!' });
      return;
    }

    // Kiểm tra có đang chờ hành động nào không
    if (this.pendingAction) {
      // Cho phép đánh Nope trong cửa sổ Nope
      if (this.pendingAction.type === 'nope') {
        // Nope được xử lý qua handleNopeResponse
        return;
      }
      this.emitTo(playerId, 'error_message', { message: 'Đang chờ hành động khác hoàn thành!' });
      return;
    }

    // Kiểm tra có phải lượt của người chơi không
    if (player.index !== this.currentPlayerIndex) {
      this.emitTo(playerId, 'error_message', { message: 'Chưa đến lượt của bạn!' });
      return;
    }

    // Kiểm tra tất cả card IDs có hợp lệ không
    if (!cardIds || cardIds.length === 0) {
      this.emitTo(playerId, 'error_message', { message: 'Bạn chưa chọn lá bài nào!' });
      return;
    }

    const cards = cardIds.map(id => player.hand.find(c => c.id === id));
    if (cards.some(c => !c)) {
      this.emitTo(playerId, 'error_message', { message: 'Lá bài không hợp lệ!' });
      return;
    }

    // Không được đánh Mèo Nổ hoặc Tháo Ngòi chủ động
    if (cards.some(c => c.type === CardType.EXPLODING_KITTEN)) {
      this.emitTo(playerId, 'error_message', { message: 'Không thể đánh lá Mèo Nổ!' });
      return;
    }
    if (cards.some(c => c.type === CardType.DEFUSE)) {
      this.emitTo(playerId, 'error_message', { message: 'Không thể đánh lá Tháo Ngòi chủ động!' });
      return;
    }

    // --- Xử lý theo số lượng bài ---

    if (cards.length === 1) {
      // Đánh 1 lá bài đơn
      const card = cards[0];

      // Kiểm tra lá bài đơn có hiệu lực không
      if (CAT_TYPES.includes(card.type)) {
        this.emitTo(playerId, 'error_message', {
          message: 'Bài mèo phải đánh theo cặp (2 lá cùng loại)!'
        });
        return;
      }

      // Kiểm tra mục tiêu cho Favor
      if (card.type === CardType.FAVOR) {
        if (!targetId) {
          this.emitTo(playerId, 'error_message', { message: 'Bạn cần chọn mục tiêu cho lá Xin Xỏ!' });
          return;
        }
        const target = this.players.find(p => p.id === targetId);
        if (!target || !target.isAlive || target.id === playerId) {
          this.emitTo(playerId, 'error_message', { message: 'Mục tiêu không hợp lệ!' });
          return;
        }
        if (target.hand.length === 0) {
          this.emitTo(playerId, 'error_message', { message: 'Mục tiêu không có bài để cho!' });
          return;
        }
      }

      // Xóa bài khỏi tay, thêm vào đống bỏ
      this.removeCardsFromHand(player, [card.id]);
      this.discardPile.push(card);

      const cardName = CardInfo[card.type]?.name || card.type;
      const targetPlayer = targetId ? this.players.find(p => p.id === targetId) : null;
      const targetName = targetPlayer ? targetPlayer.name : null;

      this.addLog(`${CardInfo[card.type]?.emoji || '🃏'} ${player.name} đánh ${cardName}${targetName ? ` → ${targetName}` : ''}`);

      // Bắt đầu cửa sổ Nope (trừ Nope)
      if (card.type === CardType.NOPE) {
        // Nope không thể nope chính nó khi đánh đơn (không có gì để nope)
        this.emitTo(playerId, 'error_message', { message: 'Không có gì để Phản Đối!' });
        // Trả lại bài
        this.discardPile.pop();
        player.hand.push(card);
        return;
      }

      // Phát trạng thái sau khi đánh bài
      this.emitToRoom('card_played', {
        playerIndex: player.index,
        playerName: player.name,
        cardType: card.type,
        cardName,
        targetName
      });

      // Mở cửa sổ Nope
      this.startNopeWindow(card.type, player.index, targetPlayer?.index, (cancelled) => {
        if (cancelled) {
          this.addLog(`❌ Hiệu ứng ${cardName} bị hủy bởi Phản Đối!`);
          this.broadcastState();
        } else {
          this.resolveCardEffect(card.type, player.index, targetPlayer?.index);
        }
      });

    } else if (cards.length === 2) {
      // Đánh cặp bài mèo
      if (cards[0].type !== cards[1].type) {
        this.emitTo(playerId, 'error_message', { message: 'Hai lá bài phải cùng loại!' });
        return;
      }

      if (!CAT_TYPES.includes(cards[0].type)) {
        this.emitTo(playerId, 'error_message', { message: 'Chỉ bài mèo mới đánh được theo cặp!' });
        return;
      }

      if (!targetId) {
        this.emitTo(playerId, 'error_message', { message: 'Bạn cần chọn mục tiêu để ăn cắp bài!' });
        return;
      }

      const target = this.players.find(p => p.id === targetId);
      if (!target || !target.isAlive || target.id === playerId) {
        this.emitTo(playerId, 'error_message', { message: 'Mục tiêu không hợp lệ!' });
        return;
      }

      if (target.hand.length === 0) {
        this.emitTo(playerId, 'error_message', { message: 'Mục tiêu không có bài để ăn cắp!' });
        return;
      }

      // Xóa cặp bài khỏi tay
      this.removeCardsFromHand(player, cardIds);
      this.discardPile.push(...cards);

      const catName = CardInfo[cards[0].type]?.name || cards[0].type;
      this.addLog(`🐱 ${player.name} đánh cặp ${catName} → ăn cắp bài của ${target.name}`);

      this.emitToRoom('card_played', {
        playerIndex: player.index,
        playerName: player.name,
        cardType: 'cat_pair',
        cardName: `Cặp ${catName}`,
        targetName: target.name
      });

      // Mở cửa sổ Nope cho cặp mèo
      this.startNopeWindow(cards[0].type, player.index, target.index, (cancelled) => {
        if (cancelled) {
          this.addLog(`❌ Ăn cắp bài bị hủy bởi Phản Đối!`);
          this.broadcastState();
        } else {
          // Ăn cắp 1 lá bài ngẫu nhiên từ mục tiêu
          this.stealRandomCard(player, target);
        }
      });

    } else if (cards.length === 5) {
      // Đánh combo 5 lá khác biệt
      const types = new Set(cards.map(c => c.type));
      if (types.size !== 5) {
        this.emitTo(playerId, 'error_message', { message: '5 lá bài phải hoàn toàn khác loại nhau!' });
        return;
      }

      // Xóa 5 lá khỏi tay, thêm vào đống bài bỏ
      this.removeCardsFromHand(player, cardIds);
      this.discardPile.push(...cards);

      this.addLog(`✨ ${player.name} đánh Combo 5 lá khác biệt!`);

      this.emitToRoom('card_played', {
        playerIndex: player.index,
        playerName: player.name,
        cardType: CardType.FIVE_CARD_COMBO,
        cardName: 'Combo 5 Lá',
        targetName: null
      });

      // Mở cửa sổ Nope cho Combo 5 lá
      this.startNopeWindow(CardType.FIVE_CARD_COMBO, player.index, null, (cancelled) => {
        if (cancelled) {
          this.addLog(`❌ Combo 5 Lá bị hủy bởi Phản Đối!`);
          this.broadcastState();
        } else {
          // Thực hiện rút bài từ discard pile
          this.resolveFiveCardCombo(player.index);
        }
      });

    } else {
      this.emitTo(playerId, 'error_message', { message: 'Số lượng bài không hợp lệ!' });
    }
  }

  // ============================================================
  // RÚT BÀI
  // ============================================================

  /**
   * Xử lý khi người chơi rút bài từ bộ bài
   */
  handleDrawCard(playerId) {
    if (this.isGameOver) return;

    const player = this.players.find(p => p.id === playerId);
    if (!player || !player.isAlive) return;

    // Kiểm tra có đang chờ hành động nào không
    if (this.pendingAction) {
      this.emitTo(playerId, 'error_message', { message: 'Đang chờ hành động khác hoàn thành!' });
      return;
    }

    // Kiểm tra lượt
    if (player.index !== this.currentPlayerIndex) {
      this.emitTo(playerId, 'error_message', { message: 'Chưa đến lượt của bạn!' });
      return;
    }

    // Rút bài từ đỉnh bộ bài
    if (this.deck.length === 0) {
      this.emitTo(playerId, 'error_message', { message: 'Bộ bài đã hết!' });
      return;
    }

    const drawnCard = this.deck.pop();

    // --- Rút phải Mèo Nổ! ---
    if (drawnCard.type === CardType.EXPLODING_KITTEN) {
      this.addLog(`💣 ${player.name} rút phải MÈO NỔ!!!`);

      this.emitToRoom('exploding_kitten_drawn', {
        playerIndex: player.index,
        playerName: player.name
      });

      // Kiểm tra có Tháo Ngòi không
      const defuseCard = player.hand.find(c => c.type === CardType.DEFUSE);

      if (defuseCard) {
        // Có Tháo Ngòi → sử dụng tự động, yêu cầu đặt vị trí Mèo Nổ
        this.removeCardsFromHand(player, [defuseCard.id]);
        this.discardPile.push(defuseCard);

        this.addLog(`🛠️ ${player.name} sử dụng Tháo Ngòi! Đang chọn vị trí đặt Mèo Nổ...`);

        this.emitToRoom('defuse_used', {
          playerIndex: player.index,
          playerName: player.name
        });

        // Đặt pending action chờ người chơi chọn vị trí
        this.pendingAction = {
          type: 'defuse',
          playerId: player.id,
          playerName: player.name,
          playerIndex: player.index,
          ekCard: drawnCard // Lưu lá Mèo Nổ để đặt lại
        };

        // Gửi prompt cho người chơi chọn vị trí đặt Mèo Nổ
        this.emitTo(player.id, 'defuse_prompt', {
          deckSize: this.deck.length
        });

        this.broadcastState();

      } else {
        // Không có Tháo Ngòi → bị loại!
        this.eliminatePlayer(player, drawnCard);
      }

      return;
    }

    // --- Rút bài thường ---
    player.hand.push(drawnCard);

    this.addLog(`📥 ${player.name} rút 1 lá bài`);

    // Chỉ thông báo cho người chơi biết họ rút được gì
    this.emitTo(playerId, 'card_drawn', {
      card: drawnCard
    });

    // Thông báo cho phòng (không tiết lộ lá bài)
    this.emitToRoom('player_drew_card', {
      playerIndex: player.index,
      playerName: player.name,
      deckCount: this.deck.length
    });

    // Giảm số lượt phải chơi
    player.turnsToPlay--;

    if (player.turnsToPlay <= 0) {
      player.turnsToPlay = 1; // Reset cho lần tới
      this.advanceToNextPlayer();
    } else {
      // Còn lượt phải chơi (do Attack)
      this.addLog(`⚔️ ${player.name} còn ${player.turnsToPlay} lượt phải chơi`);
      this.startTurn();
    }
  }

  // ============================================================
  // HỆ THỐNG NOPE (Phản Đối)
  // ============================================================

  /**
   * Mở cửa sổ Nope - cho phép tất cả người chơi phản đối
   * @param {string} cardType - Loại bài vừa đánh
   * @param {number} playedByIndex - Index người đánh
   * @param {number|undefined} targetIndex - Index mục tiêu (nếu có)
   * @param {Function} onResolve - Callback(cancelled: boolean)
   */
  startNopeWindow(cardType, playedByIndex, targetIndex, onResolve) {
    const playedBy = this.players[playedByIndex];
    const target = targetIndex !== undefined && targetIndex !== null
      ? this.players[targetIndex]
      : null;

    // Tìm những người chơi có lá Nope (trừ người vừa đánh)
    const playersWithNope = this.players.filter(
      p => p.isAlive && p.hand.some(c => c.type === CardType.NOPE)
    );

    // Nếu không ai có Nope → thực hiện ngay
    if (playersWithNope.length === 0) {
      onResolve(false);
      return;
    }

    const expiresAt = Date.now() + 5000; // 5 giây

    this.pendingAction = {
      type: 'nope',
      cardType,
      playedByIndex,
      playedByName: playedBy.name,
      targetIndex,
      targetName: target?.name || null,
      onResolve,
      responses: {},    // playerId → true (dùng nope) | false (bỏ qua)
      nopeCount: 0,     // Số lá Nope đã được đánh
      expiresAt,
      eligiblePlayerIds: playersWithNope.map(p => p.id)
    };

    // Thông báo cho tất cả người chơi
    this.emitToRoom('nope_window', {
      cardType,
      cardName: CardInfo[cardType]?.name || cardType,
      playedByName: playedBy.name,
      playedByIndex,
      targetName: target?.name || null,
      duration: 5000,
      timeoutMs: 5000,
      card: {
        type: cardType,
        name: CardInfo[cardType]?.name || cardType,
        emoji: CardInfo[cardType]?.emoji || '🃏'
      }
    });

    this.broadcastState();

    // Đặt timer
    this.nopeTimer = setTimeout(() => {
      this.resolveNopeWindow();
    }, 5000);
  }

  /**
   * Xử lý phản hồi Nope từ người chơi
   */
  handleNopeResponse(playerId, useNope) {
    if (!this.pendingAction || this.pendingAction.type !== 'nope') {
      this.emitTo(playerId, 'error_message', { message: 'Không có cửa sổ Phản Đối nào đang mở!' });
      return;
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player || !player.isAlive) return;

    // Đã phản hồi rồi?
    if (this.pendingAction.responses[playerId] !== undefined) {
      return;
    }

    if (useNope) {
      // Kiểm tra có lá Nope không
      const nopeCard = player.hand.find(c => c.type === CardType.NOPE);
      if (!nopeCard) {
        this.emitTo(playerId, 'error_message', { message: 'Bạn không có lá Phản Đối!' });
        return;
      }

      // Xóa lá Nope khỏi tay
      this.removeCardsFromHand(player, [nopeCard.id]);
      this.discardPile.push(nopeCard);
      this.pendingAction.nopeCount++;

      this.addLog(`🚫 ${player.name} đánh Phản Đối! (${this.pendingAction.nopeCount} lần Phản Đối)`);

      this.emitToRoom('nope_played', {
        playerIndex: player.index,
        playerName: player.name,
        nopeCount: this.pendingAction.nopeCount
      });

      // Sau khi có Nope, mở cửa sổ counter-nope (4 giây)
      this.pendingAction.responses = {}; // Reset responses
      this.pendingAction.expiresAt = Date.now() + 4000;

      // Cập nhật danh sách eligible (ai còn Nope)
      this.pendingAction.eligiblePlayerIds = this.players
        .filter(p => p.isAlive && p.hand.some(c => c.type === CardType.NOPE))
        .map(p => p.id);

      // Clear timer cũ, đặt timer mới
      if (this.nopeTimer) clearTimeout(this.nopeTimer);

      // Nếu không ai còn Nope → resolve ngay
      if (this.pendingAction.eligiblePlayerIds.length === 0) {
        this.resolveNopeWindow();
        return;
      }

      this.emitToRoom('nope_window', {
        cardType: this.pendingAction.cardType,
        cardName: CardInfo[this.pendingAction.cardType]?.name || this.pendingAction.cardType,
        playedByName: this.pendingAction.playedByName,
        playedByIndex: this.pendingAction.playedByIndex,
        targetName: this.pendingAction.targetName,
        nopeCount: this.pendingAction.nopeCount,
        duration: 4000,
        timeoutMs: 4000,
        card: {
          type: this.pendingAction.cardType,
          name: CardInfo[this.pendingAction.cardType]?.name || this.pendingAction.cardType,
          emoji: CardInfo[this.pendingAction.cardType]?.emoji || '🃏'
        }
      });

      this.broadcastState();

      this.nopeTimer = setTimeout(() => {
        this.resolveNopeWindow();
      }, 4000);

    } else {
      // Bỏ qua
      this.pendingAction.responses[playerId] = false;

      // Kiểm tra nếu tất cả eligible đã phản hồi
      const allResponded = this.pendingAction.eligiblePlayerIds.every(
        id => this.pendingAction.responses[id] !== undefined
      );

      if (allResponded) {
        if (this.nopeTimer) clearTimeout(this.nopeTimer);
        this.resolveNopeWindow();
      }
    }
  }

  /**
   * Kết thúc cửa sổ Nope và quyết định kết quả
   * Quy tắc: số lẻ Nope → hủy, số chẵn Nope → không hủy
   */
  resolveNopeWindow() {
    if (!this.pendingAction || this.pendingAction.type !== 'nope') return;

    const { nopeCount, onResolve } = this.pendingAction;
    const cancelled = nopeCount % 2 === 1; // Số lẻ = hủy

    if (this.nopeTimer) {
      clearTimeout(this.nopeTimer);
      this.nopeTimer = null;
    }

    // Xóa pending action TRƯỚC khi gọi callback
    this.pendingAction = null;

    this.emitToRoom('nope_resolved', {
      cancelled,
      nopeCount
    });

    // Gọi callback
    onResolve(cancelled);
  }

  // ============================================================
  // HIỆU ỨNG BÀI
  // ============================================================

  /**
   * Thực hiện hiệu ứng của lá bài sau khi qua cửa sổ Nope
   */
  resolveCardEffect(cardType, playerIndex, targetIndex) {
    const player = this.players[playerIndex];
    if (!player || !player.isAlive) return;

    switch (cardType) {
      // --- BỎ LƯỢT ---
      case CardType.SKIP:
        this.addLog(`🚫 ${player.name} bỏ lượt!`);
        player.turnsToPlay--;
        if (player.turnsToPlay <= 0) {
          player.turnsToPlay = 1;
          this.advanceToNextPlayer();
        } else {
          this.startTurn();
        }
        break;

      // --- TẤN CÔNG ---
      case CardType.ATTACK: {
        this.addLog(`⚔️ ${player.name} tấn công!`);

        // Tìm người chơi tiếp theo còn sống
        const numPlayers = this.players.length;
        let nextIdx = playerIndex;
        do {
          nextIdx = (nextIdx + 1) % numPlayers;
        } while (!this.players[nextIdx].isAlive && nextIdx !== playerIndex);

        const nextPlayer = this.players[nextIdx];

        // Người tiếp theo phải chơi thêm 2 lượt
        // Nếu người hiện tại đang bị Attack (turnsToPlay > 1), 
        // cộng dồn số lượt còn lại cho người tiếp theo
        const remainingTurns = player.turnsToPlay; 
        nextPlayer.turnsToPlay = remainingTurns + 1; // +1 cho lượt bình thường, cộng remaining turns bỏ qua

        this.addLog(`⚔️ ${nextPlayer.name} phải chơi ${nextPlayer.turnsToPlay} lượt!`);

        // Kết thúc lượt hiện tại (không cần rút bài)
        player.turnsToPlay = 1;
        this.currentPlayerIndex = nextIdx;
        this.startTurn();
        break;
      }

      // --- NHÌN TƯƠNG LAI ---
      case CardType.SEE_FUTURE: {
        // Lấy 3 lá bài trên cùng (không rút ra)
        const topCards = this.deck.slice(-3).reverse(); // Đảo ngược để lá trên cùng ở đầu

        this.addLog(`🔮 ${player.name} nhìn 3 lá bài trên cùng!`);

        // CHỈ gửi cho người chơi này
        this.emitTo(player.id, 'see_future_result', {
          cards: topCards
        });

        this.broadcastState();
        break;
      }

      // --- XÁO BÀI ---
      case CardType.SHUFFLE:
        shuffleArray(this.deck);
        this.addLog(`🔀 ${player.name} xáo bộ bài!`);

        this.emitToRoom('deck_shuffled', {
          playerName: player.name,
          deckCount: this.deck.length
        });

        this.broadcastState();
        break;

      // --- XIN XỎ ---
      case CardType.FAVOR: {
        if (targetIndex === undefined || targetIndex === null) break;
        const target = this.players[targetIndex];
        if (!target || !target.isAlive || target.hand.length === 0) {
          this.addLog(`🙏 Xin Xỏ thất bại - mục tiêu không có bài!`);
          this.broadcastState();
          break;
        }

        this.addLog(`🙏 ${player.name} xin ${target.name} cho 1 lá bài!`);

        // Đặt pending action chờ mục tiêu chọn bài để cho
        this.pendingAction = {
          type: 'favor',
          requesterId: player.id,
          requesterName: player.name,
          requesterIndex: playerIndex,
          targetId: target.id,
          targetName: target.name,
          targetIndex
        };

        this.emitTo(target.id, 'favor_request', {
          requesterName: player.name,
          requesterId: player.id
        });

        this.broadcastState();
        break;
      }

      // --- CẶP MÈO (ăn cắp) ---
      case CardType.CAT_TACO:
      case CardType.CAT_MELON:
      case CardType.CAT_BEARD:
      case CardType.CAT_RAINBOW: {
        if (targetIndex === undefined || targetIndex === null) break;
        const target = this.players[targetIndex];
        if (!target || !target.isAlive) break;
        this.stealRandomCard(player, target);
        break;
      }

      default:
        console.error(`[LỖI] Loại bài không xử lý được: ${cardType}`);
        this.broadcastState();
    }
  }

  // ============================================================
  // XỬ LÝ FAVOR (Xin Xỏ)
  // ============================================================

  /**
   * Xử lý khi mục tiêu cho bài (Favor)
   */
  handleFavorGive(playerId, cardId) {
    if (!this.pendingAction || this.pendingAction.type !== 'favor') {
      this.emitTo(playerId, 'error_message', { message: 'Không có yêu cầu Xin Xỏ nào!' });
      return;
    }

    // Chỉ mục tiêu mới được cho bài
    if (this.pendingAction.targetId !== playerId) {
      this.emitTo(playerId, 'error_message', { message: 'Bạn không phải mục tiêu của Xin Xỏ!' });
      return;
    }

    const target = this.players.find(p => p.id === playerId);
    const requester = this.players.find(p => p.id === this.pendingAction.requesterId);

    if (!target || !requester) return;

    // Kiểm tra lá bài
    const card = target.hand.find(c => c.id === cardId);
    if (!card) {
      this.emitTo(playerId, 'error_message', { message: 'Lá bài không hợp lệ!' });
      return;
    }

    // Chuyển bài
    this.removeCardsFromHand(target, [card.id]);
    requester.hand.push(card);

    this.addLog(`🙏 ${target.name} cho ${requester.name} 1 lá bài`);

    // Thông báo cho người nhận biết được lá gì
    this.emitTo(requester.id, 'favor_received', {
      card,
      fromName: target.name
    });

    // Thông báo cho mục tiêu
    this.emitTo(target.id, 'favor_given', {
      cardId: card.id,
      toName: requester.name
    });

    this.emitToRoom('favor_completed', {
      giverName: target.name,
      receiverName: requester.name
    });

    this.pendingAction = null;
    this.broadcastState();
  }

  // ============================================================
  // XỬ LÝ DEFUSE (Tháo Ngòi)
  // ============================================================

  /**
   * Xử lý khi người chơi chọn vị trí đặt lại Mèo Nổ
   * @param {string} playerId
   * @param {number} position - 0 = đỉnh, deck.length = đáy
   */
  handleDefusePlace(playerId, position) {
    if (!this.pendingAction || this.pendingAction.type !== 'defuse') {
      this.emitTo(playerId, 'error_message', { message: 'Không có yêu cầu đặt Mèo Nổ!' });
      return;
    }

    if (this.pendingAction.playerId !== playerId) {
      this.emitTo(playerId, 'error_message', { message: 'Bạn không phải người cần đặt Mèo Nổ!' });
      return;
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    const ekCard = this.pendingAction.ekCard;

    // Validate position: 0 = đỉnh (cuối mảng), max = đáy (đầu mảng)
    // Client gửi: 0 = đỉnh, deck.length = đáy
    const maxPos = this.deck.length; // Có thể đặt ở bất kỳ vị trí nào
    const clampedPos = Math.max(0, Math.min(position, maxPos));

    // Chuyển đổi: position 0 (đỉnh) → chèn ở cuối mảng
    //             position max (đáy) → chèn ở đầu mảng
    const insertIndex = this.deck.length - clampedPos;
    this.deck.splice(insertIndex, 0, ekCard);

    // KHÔNG tiết lộ vị trí cho người khác!
    this.addLog(`🛠️ ${player.name} đã đặt Mèo Nổ lại vào bộ bài`);

    this.emitToRoom('defuse_complete', {
      playerName: player.name,
      deckCount: this.deck.length
    });

    this.pendingAction = null;

    // Giảm lượt và chuyển tiếp
    player.turnsToPlay--;
    if (player.turnsToPlay <= 0) {
      player.turnsToPlay = 1;
      this.advanceToNextPlayer();
    } else {
      this.startTurn();
    }
  }

  // ============================================================
  // XỬ LÝ COMBO 5 LÁ (Discard Pile Picker)
  // ============================================================

  /**
   * Bắt đầu chọn bài từ đống bỏ cho Combo 5 lá
   */
  resolveFiveCardCombo(playerIndex) {
    const player = this.players[playerIndex];
    if (!player || !player.isAlive) return;

    if (this.discardPile.length === 0) {
      this.addLog(`✨ ${player.name} chơi Combo 5 lá nhưng xấp bài bỏ đang trống!`);
      this.broadcastState();
      return;
    }

    this.addLog(`🎁 ${player.name} đang chọn 1 lá từ xấp bài bỏ...`);

    // Thiết lập hành động chờ
    this.pendingAction = {
      type: 'discard_picker',
      playerId: player.id,
      playerName: player.name,
      playerIndex: player.index
    };

    // Gửi sự kiện yêu cầu chọn bài riêng cho người chơi đó
    this.emitTo(player.id, 'discard_picker_prompt', {
      discardPile: this.discardPile.map(c => ({
        id: c.id,
        type: c.type
      }))
    });

    this.broadcastState();
  }

  /**
   * Xử lý khi người chơi chọn lá bài từ xấp bài bỏ
   */
  handleDiscardPickerPick(playerId, cardId) {
    if (!this.pendingAction || this.pendingAction.type !== 'discard_picker') {
      this.emitTo(playerId, 'error_message', { message: 'Không có yêu cầu chọn bài!' });
      return;
    }

    if (this.pendingAction.playerId !== playerId) {
      this.emitTo(playerId, 'error_message', { message: 'Bạn không phải người chọn bài!' });
      return;
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    // Tìm lá bài trong xấp bài bỏ
    const cardIdx = this.discardPile.findIndex(c => c.id === cardId);
    if (cardIdx === -1) {
      this.emitTo(playerId, 'error_message', { message: 'Lá bài không tồn tại trong xấp bài bỏ!' });
      return;
    }

    const cardToPick = this.discardPile[cardIdx];
    if (cardToPick.type === CardType.EXPLODING_KITTEN) {
      this.emitTo(playerId, 'error_message', { message: 'Không thể chọn lá Mèo Nổ!' });
      return;
    }

    // Rút khỏi xấp bài bỏ và đưa vào tay
    const card = this.discardPile.splice(cardIdx, 1)[0];
    player.hand.push(card);

    const cardName = CardInfo[card.type]?.name || card.type;
    this.addLog(`🎁 ${player.name} đã lấy lá ${cardName} từ xấp bài bỏ!`);

    this.pendingAction = null;
    this.broadcastState();
  }

  // ============================================================
  // LOẠI NGƯỜI CHƠI
  // ============================================================

  /**
   * Loại người chơi khỏi game khi rút phải Mèo Nổ mà không có Tháo Ngòi
   */
  eliminatePlayer(player, ekCard) {
    player.isAlive = false;

    this.addLog(`💀 ${player.name} đã bị loại bởi Mèo Nổ!`);

    // Bỏ tất cả bài trên tay vào đống bỏ
    this.discardPile.push(ekCard);
    this.discardPile.push(...player.hand);
    player.hand = [];

    this.emitToRoom('player_eliminated', {
      playerIndex: player.index,
      playerName: player.name
    });

    // Kiểm tra điều kiện thắng
    if (this.checkWinCondition()) return;

    // Tiếp tục game
    player.turnsToPlay = 1;
    this.advanceToNextPlayer();
  }

  /**
   * Xử lý khi người chơi ngắt kết nối giữa game
   */
  handlePlayerDisconnect(socketId) {
    const player = this.players.find(p => p.id === socketId);
    if (!player || !player.isAlive) return;

    player.isAlive = false;

    this.addLog(`🔌 ${player.name} mất kết nối và bị loại!`);

    // Bỏ bài vào đống bỏ
    this.discardPile.push(...player.hand);
    player.hand = [];

    this.emitToRoom('player_eliminated', {
      playerIndex: player.index,
      playerName: player.name,
      reason: 'disconnect'
    });

    // Nếu đang chờ hành động từ người này → hủy
    if (this.pendingAction) {
      if (this.pendingAction.type === 'defuse' && this.pendingAction.playerId === socketId) {
        // Tự loại vì không thể đặt Mèo Nổ
        this.pendingAction = null;
      }
      if (this.pendingAction && this.pendingAction.type === 'favor' && this.pendingAction.targetId === socketId) {
        // Hủy Favor
        this.addLog(`🙏 Xin Xỏ bị hủy do ${player.name} mất kết nối`);
        this.pendingAction = null;
      }
      if (this.pendingAction && this.pendingAction.type === 'nope') {
        // Xóa khỏi eligible
        this.pendingAction.eligiblePlayerIds = this.pendingAction.eligiblePlayerIds.filter(
          id => id !== socketId
        );
        this.pendingAction.responses[socketId] = false;
      }
    }

    // Kiểm tra điều kiện thắng
    if (this.checkWinCondition()) return;

    // Nếu đang là lượt người bị disconnect → chuyển lượt
    if (player.index === this.currentPlayerIndex) {
      this.advanceToNextPlayer();
    } else {
      this.broadcastState();
    }
  }

  // ============================================================
  // KIỂM TRA THẮNG
  // ============================================================

  /**
   * Kiểm tra nếu chỉ còn 1 người sống → thắng
   * @returns {boolean} true nếu game kết thúc
   */
  checkWinCondition() {
    const alivePlayers = this.players.filter(p => p.isAlive);

    if (alivePlayers.length <= 1) {
      this.isGameOver = true;

      if (alivePlayers.length === 1) {
        const winner = alivePlayers[0];
        this.addLog(`🏆 ${winner.name} đã THẮNG trò chơi!`);

        this.emitToRoom('game_over', {
          winnerId: winner.id,
          winnerName: winner.name,
          winnerIndex: winner.index
        });
      } else {
        this.addLog('🤷 Trò chơi kết thúc - không có người thắng!');
        this.emitToRoom('game_over', { winnerId: null });
      }

      this.cleanup();
      this.broadcastState();
      return true;
    }

    return false;
  }

  // ============================================================
  // TIỆN ÍCH
  // ============================================================

  /**
   * Ăn cắp 1 lá bài ngẫu nhiên từ mục tiêu
   */
  stealRandomCard(stealer, victim) {
    if (victim.hand.length === 0) {
      this.addLog(`🐱 Ăn cắp thất bại - ${victim.name} không có bài!`);
      this.broadcastState();
      return;
    }

    // Chọn ngẫu nhiên
    const randomIndex = Math.floor(Math.random() * victim.hand.length);
    const stolenCard = victim.hand.splice(randomIndex, 1)[0];
    stealer.hand.push(stolenCard);

    this.addLog(`🐱 ${stealer.name} ăn cắp 1 lá bài từ ${victim.name}`);

    // Thông báo cho người ăn cắp biết được lá gì
    this.emitTo(stealer.id, 'card_stolen', {
      card: stolenCard,
      fromName: victim.name
    });

    // Thông báo cho nạn nhân
    this.emitTo(victim.id, 'card_lost', {
      cardId: stolenCard.id,
      toName: stealer.name
    });

    this.emitToRoom('steal_completed', {
      stealerName: stealer.name,
      victimName: victim.name
    });

    this.broadcastState();
  }

  /**
   * Xóa các lá bài khỏi tay người chơi theo ID
   */
  removeCardsFromHand(player, cardIds) {
    const idSet = new Set(cardIds);
    player.hand = player.hand.filter(c => !idSet.has(c.id));
  }

  /**
   * Thêm thông điệp vào nhật ký game
   */
  addLog(message) {
    const entry = {
      time: Date.now(),
      message
    };
    this.log.push(entry);

    // Gửi log mới cho phòng
    this.emitToRoom('game_log', entry);
  }

  /**
   * Gửi event đến 1 người chơi cụ thể
   */
  emitTo(playerId, event, data) {
    const socket = this.io.sockets.sockets.get(playerId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  /**
   * Gửi event đến tất cả người chơi trong phòng
   */
  emitToRoom(event, data) {
    this.io.to(this.roomCode).emit(event, data);
  }

  /**
   * Dọn dẹp khi game kết thúc
   */
  cleanup() {
    if (this.nopeTimer) {
      clearTimeout(this.nopeTimer);
      this.nopeTimer = null;
    }
    this.pendingAction = null;
  }
}

module.exports = ServerGame;
