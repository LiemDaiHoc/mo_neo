/**
 * game.js - Main game engine
 * Mèo Nổ (Exploding Kittens) Browser Game
 */

const GamePhase = {
  MENU: 'menu',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver'
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const Game = {
  // ===== State =====
  players: [],
  deck: [],
  discardPile: [],
  currentPlayerIndex: 0,
  phase: GamePhase.MENU,
  numPlayers: 4,
  log: [],
  nopeWindowActive: false,
  pendingAction: null,
  knownTopCards: null,
  knownTopCardsPlayer: -1,
  isProcessing: false,
  turnCount: 0,
  selectedCards: [],
  lastPlayedCard: null,

  // Online mode
  gameMode: 'offline',  // 'offline' | 'online'
  onlineState: null,     // Latest state from server

  // ===== Initialization =====

  init() {
    this.phase = GamePhase.MENU;
    this.gameMode = 'offline';
    this.onlineState = null;
    UI.showMenu();
  },

  initOffline() {
    this.gameMode = 'offline';
    this.onlineState = null;
  },

  initOnline(serverData) {
    this.gameMode = 'online';
    this.phase = GamePhase.PLAYING;
    this.log = [];
    this.selectedCards = [];
    this.isProcessing = false;
    this.turnCount = 0;

    this.addLog('🌐 Game online bắt đầu! Chúc may mắn!');
    Sounds.init();
    UI.showGame();

    if (serverData) {
      this.updateFromServer(serverData);
    }
  },

  updateFromServer(state) {
    this.onlineState = state;

    // Map server state into local game objects
    if (state.players) {
      this.players = state.players.map((p, i) => {
        const isMe = p.id === Network.myPlayerId;
        // For the local player, use myHand from server state
        let hand = [];
        if (isMe && state.myHand) {
          hand = state.myHand.map(c => {
            // Enrich card with display info from client-side CARD_INFO
            const info = CARD_INFO[c.type];
            if (info) {
              return { ...c, ...info };
            }
            return c;
          });
        }
        return {
          index: p.index !== undefined ? p.index : i,
          id: p.id,
          name: p.name,
          avatar: p.avatar || PLAYER_AVATARS[i] || '😺',
          color: PLAYER_COLORS[i] || '#00d4ff',
          isHuman: isMe,
          isAlive: p.isAlive !== undefined ? p.isAlive : true,
          hand: hand,
          cardCount: isMe ? hand.length : (p.cardCount || 0),
          turnsToPlay: p.turnsToPlay || 1,
          hasCardType(type) { return this.hand.some(c => c.type === type); },
          get cardCountDisplay() { return this.isHuman ? this.hand.length : this.cardCount; }
        };
      });
    }

    if (state.currentPlayerIndex !== undefined) {
      this.currentPlayerIndex = state.currentPlayerIndex;
    }

    if (state.deckCount !== undefined) {
      // For online, deck is just a count for display
      this.deck = new Array(state.deckCount);
    }

    if (state.discardPile) {
      // Enrich discard pile cards with display info
      this.discardPile = state.discardPile.map(c => {
        const info = CARD_INFO[c.type];
        return info ? { ...c, ...info } : c;
      });
    }

    if (state.turnCount !== undefined) {
      this.turnCount = state.turnCount;
    }

    this.numPlayers = this.players.length;
    this.selectedCards = [];
    this.isProcessing = false;

    UI.renderAll();
  },

  startGame(numPlayers) {
    this.numPlayers = numPlayers;
    this.players = [];
    this.deck = [];
    this.discardPile = [];
    this.currentPlayerIndex = 0;
    this.log = [];
    this.knownTopCards = null;
    this.knownTopCardsPlayer = -1;
    this.isProcessing = false;
    this.turnCount = 0;
    this.selectedCards = [];
    this.lastPlayedCard = null;

    // Create players
    for (let i = 0; i < numPlayers; i++) {
      this.players.push(new Player(i, i === 0));
    }

    // Create and deal
    this.deck = createDeck(numPlayers);
    const hands = dealCards(this.deck, numPlayers);
    for (let i = 0; i < numPlayers; i++) {
      this.players[i].hand = hands[i];
    }

    this.phase = GamePhase.PLAYING;
    this.addLog('🎮 Game bắt đầu! Chúc may mắn!');
    this.addLog(`📦 Bộ bài có ${this.deck.length} lá (${numPlayers - 1} Mèo Nổ 💣)`);

    Sounds.init();
    UI.showGame();
    UI.renderAll();

    // Start first turn
    this.startTurn();
  },

  // ===== Turn Management =====

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  },

  getNextAlivePlayer(fromIndex) {
    let idx = fromIndex;
    for (let i = 0; i < this.players.length; i++) {
      idx = (idx + 1) % this.players.length;
      if (this.players[idx].isAlive) return idx;
    }
    return -1;
  },

  getAlivePlayers() {
    return this.players.filter(p => p.isAlive);
  },

  getAliveOpponents(playerIndex) {
    return this.players.filter(p => p.isAlive && p.index !== playerIndex);
  },

  async startTurn() {
    const player = this.currentPlayer;
    if (!player.isAlive) {
      this.advanceToNextPlayer();
      return;
    }

    this.turnCount++;
    this.selectedCards = [];
    this.isProcessing = false;

    UI._turnFlashShown = false; // Reset turn flash for new turn
    UI.renderAll();
    UI.highlightCurrentPlayer();

    if (player.isHuman) {
      this.addLog(`🎯 Lượt của bạn! (Còn ${player.turnsToPlay} lượt phải chơi)`);
      Sounds.turnStart();
      UI.enablePlayerActions();
    } else {
      this.addLog(`🤖 Lượt của ${player.name}...`);
      await this.aiPlayTurn(player);
    }
  },

  // ===== Human Player Actions =====

  selectCard(cardId) {
    if (this.isProcessing) return;
    // In offline mode, human is always index 0; in online, check isHuman
    if (!this.currentPlayer || !this.currentPlayer.isHuman) return;

    const cardIdStr = String(cardId);
    const cardIdx = this.selectedCards.findIndex(id => String(id) === cardIdStr);

    if (cardIdx >= 0) {
      // Deselect card
      this.selectedCards.splice(cardIdx, 1);
    } else {
      const card = this.currentPlayer.hand.find(c => String(c.id) === cardIdStr);
      if (!card) return;

      // Toggle selection limit to 5 cards
      if (this.selectedCards.length < 5) {
        this.selectedCards.push(card.id);
      }
    }

    UI.updateCardSelectionStates();
  },

  canPlaySelected() {
    if (this.selectedCards.length === 0) return false;
    const player = this.currentPlayer;

    const cards = this.selectedCards.map(id => player.hand.find(c => c.id === id)).filter(Boolean);
    if (cards.length === 0) return false;

    // Single card plays
    if (cards.length === 1) {
      const card = cards[0];
      // These are always playable as single cards
      if ([CardType.SKIP, CardType.ATTACK, CardType.SEE_FUTURE,
           CardType.SHUFFLE, CardType.FAVOR].includes(card.type)) {
        return true;
      }
      // Nope can only be played reactively (handled separately)
      // Cat cards need pairs
      // Defuse and Exploding Kitten are not manually playable
      return false;
    }

    // Pair plays (cat cards)
    if (cards.length === 2) {
      if (isCatCard(cards[0].type) && cards[0].type === cards[1].type) {
        return this.getAliveOpponents(player.index).length > 0;
      }
    }

    // 5 different cards combo
    if (cards.length === 5) {
      const types = new Set(cards.map(c => c.type));
      return types.size === 5;
    }

    return false;
  },

  async playSelectedCards() {
    if (!this.canPlaySelected() || this.isProcessing) return;

    // Online mode: delegate to server
    if (this.gameMode === 'online') {
      this.isProcessing = true;
      const cardIds = [...this.selectedCards];
      // Check if we need a target
      const cards = cardIds.map(id => this.currentPlayer.hand.find(c => c.id === id)).filter(Boolean);
      const needsTarget = (cards.length === 2 && isCatCard(cards[0].type)) ||
                          (cards.length === 1 && cards[0].type === CardType.FAVOR);

      if (needsTarget) {
        const opponents = this.getAliveOpponents(this.currentPlayerIndex);
        if (opponents.length === 1) {
          Network.playCards(cardIds, opponents[0].id);
        } else {
          UI.showTargetPicker(opponents, (target) => {
            Network.playCards(cardIds, target.id);
          });
        }
      } else {
        Network.playCards(cardIds, null);
      }
      this.selectedCards = [];
      return;
    }

    this.isProcessing = true;
    const player = this.currentPlayer;
    const cards = this.selectedCards.map(id => player.hand.find(c => c.id === id)).filter(Boolean);

    if (cards.length === 2 && isCatCard(cards[0].type)) {
      // Cat pair - need to choose target
      const opponents = this.getAliveOpponents(player.index);
      if (opponents.length === 1) {
        await this.executeCatPair(player, cards, opponents[0]);
      } else {
        UI.showTargetPicker(opponents, async (target) => {
          await this.executeCatPair(player, cards, target);
        });
        return; // Will continue in callback
      }
    } else if (cards.length === 1) {
      const card = cards[0];

      if (card.type === CardType.FAVOR) {
        const opponents = this.getAliveOpponents(player.index);
        if (opponents.length === 1) {
          await this.executeCard(player, card, opponents[0]);
        } else {
          UI.showTargetPicker(opponents, async (target) => {
            await this.executeCard(player, card, target);
          });
          return;
        }
      } else {
        await this.executeCard(player, card);
      }
    } else if (cards.length === 5) {
      // 5 different cards combo!
      await this.executeFiveCardCombo(player, cards);
    }
  },

  async executeCard(player, card, target) {
    // Remove card from hand
    player.removeCard(card.id);
    this.discardPile.push(card);
    this.lastPlayedCard = card;
    this.selectedCards = [];

    Sounds.cardPlay();
    UI.animateCardPlay(card, player);
    await delay(400);

    // Check for Nope
    const noped = await this.checkForNope(card, player, target);
    if (noped) {
      this.addLog(`🚫 ${card.name} của ${player.name} bị Phản Đối!`);
      this.isProcessing = false;
      UI.renderAll();
      if (player.isHuman) UI.enablePlayerActions();
      return false; // Return false to indicate card play was blocked/negated
    }

    // Execute card effect
    await this.resolveCardEffect(card, player, target);

    this.isProcessing = false;
    UI.renderAll();

    // Check if turn ended (Skip, Attack)
    if (card.type === CardType.SKIP || card.type === CardType.ATTACK) {
      return true; // Return true to indicate card was successfully executed and ended turn
    }

    if (player.isHuman) {
      UI.enablePlayerActions();
    }
    return true; // Return true to indicate successful execution
  },

  async executeCatPair(player, cards, target) {
    // Remove both cards
    for (const card of cards) {
      player.removeCard(card.id);
      this.discardPile.push(card);
    }
    this.selectedCards = [];

    const cardName = cards[0].name;
    this.addLog(`🐱 ${player.name} đánh cặp ${cardName} → ăn cắp bài của ${target.name}!`);
    Sounds.catCombo();
    UI.animateCardPlay(cards, player);
    await delay(400);

    // Check for Nope (use first card as reference)
    const fakeCard = { ...cards[0], type: 'cat_pair' };
    const noped = await this.checkForNope(fakeCard, player, target);
    if (noped) {
      this.addLog(`🚫 Combo bị Phản Đối!`);
      this.isProcessing = false;
      UI.renderAll();
      if (player.isHuman) UI.enablePlayerActions();
      return;
    }

    // Steal a random card from target
    if (target.hand.length > 0) {
      const randomIdx = Math.floor(Math.random() * target.hand.length);
      const stolen = target.hand.splice(randomIdx, 1)[0];
      player.addCard(stolen);

      if (player.isHuman) {
        this.addLog(`✅ Bạn ăn cắp được: ${stolen.emoji} ${stolen.name}!`);
      } else if (target.isHuman) {
        this.addLog(`😱 ${player.name} lấy ${stolen.emoji} ${stolen.name} của bạn!`);
      } else {
        this.addLog(`✅ ${player.name} lấy 1 lá bài của ${target.name}`);
      }
    } else {
      this.addLog(`❌ ${target.name} không có bài để lấy!`);
    }

    this.isProcessing = false;
    UI.renderAll();
    if (player.isHuman) UI.enablePlayerActions();
  },

  async executeFiveCardCombo(player, cards) {
    // Remove all 5 cards from hand
    for (const card of cards) {
      player.removeCard(card.id);
      this.discardPile.push(card);
    }
    this.selectedCards = [];

    this.addLog(`✨ ${player.name} đánh Combo 5 lá khác biệt!`);
    Sounds.cardPlay();
    UI.animateCardPlay(cards, player);
    await delay(400);

    // Check for Nope
    const fakeCard = {
      id: 'fake_combo_5',
      type: 'five_card_combo',
      name: 'Combo 5 Lá Khác Biệt',
      emoji: '✨',
      color: '#ff2e63',
      gradient: ['#ec4899', '#8b5cf6']
    };

    const noped = await this.checkForNope(fakeCard, player);
    if (noped) {
      this.addLog(`🚫 Combo 5 Lá của ${player.name} bị Phản Đối!`);
      this.isProcessing = false;
      UI.renderAll();
      if (player.isHuman) UI.enablePlayerActions();
      return;
    }

    // Let the player pick a card from the discard pile
    if (player.isHuman) {
      // Show Discard Pile Picker modal
      UI.showDiscardPicker(this.discardPile, (selectedCard) => {
        // Remove card from discardPile
        const idx = this.discardPile.findIndex(c => c.id === selectedCard.id);
        if (idx !== -1) {
          this.discardPile.splice(idx, 1);
        }
        // Add to player hand
        player.addCard(selectedCard);
        this.addLog(`🎁 Bạn đã lấy lá ${selectedCard.name} từ xấp bài bỏ!`);

        this.isProcessing = false;
        UI.renderAll();
        UI.enablePlayerActions();
      });
    } else {
      // AI bot chooses card
      this.aiResolveFiveCardCombo(player);
    }
  },

  aiResolveFiveCardCombo(bot) {
    if (this.discardPile.length === 0) {
      this.addLog(`✨ ${bot.name} chơi Combo 5 lá nhưng xấp bài bỏ đang trống!`);
      this.isProcessing = false;
      UI.renderAll();
      return;
    }

    const priority = [
      CardType.DEFUSE, CardType.NOPE, CardType.ATTACK, 
      CardType.SKIP, CardType.SEE_FUTURE, CardType.FAVOR, CardType.SHUFFLE
    ];

    let chosenCard = null;
    for (const type of priority) {
      chosenCard = this.discardPile.find(c => c.type === type);
      if (chosenCard) break;
    }

    if (!chosenCard) {
      const candidates = this.discardPile.filter(c => c.type !== CardType.EXPLODING_KITTEN);
      if (candidates.length > 0) {
        chosenCard = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        chosenCard = this.discardPile[0];
      }
    }

    if (chosenCard) {
      const idx = this.discardPile.findIndex(c => c.id === chosenCard.id);
      if (idx !== -1) {
        this.discardPile.splice(idx, 1);
      }
      bot.addCard(chosenCard);
      const cardName = CARD_INFO[chosenCard.type]?.name || chosenCard.type;
      this.addLog(`🤖 ${bot.name} đã lấy lá ${cardName} từ xấp bài bỏ!`);
    }

    this.isProcessing = false;
    UI.renderAll();
  },

  async resolveCardEffect(card, player, target) {
    switch (card.type) {
      case CardType.SKIP:
        this.addLog(`⏭️ ${player.name} bỏ lượt!`);
        Sounds.skip();
        player.turnsToPlay--;
        if (player.turnsToPlay <= 0) {
          player.turnsToPlay = 1;
          await delay(300);
          this.advanceToNextPlayer();
        } else {
          this.addLog(`⚠️ ${player.name} còn ${player.turnsToPlay} lượt phải chơi!`);
          await delay(300);
          this.startTurn();
        }
        break;

      case CardType.ATTACK:
        this.addLog(`⚔️ ${player.name} tấn công! Người tiếp theo phải chơi 2 lượt!`);
        Sounds.attack();
        const nextIdx = this.getNextAlivePlayer(player.index);
        if (nextIdx >= 0) {
          // If they already have turns, add 2 more; otherwise set to 2
          const nextP = this.players[nextIdx];
          nextP.turnsToPlay = (nextP.turnsToPlay > 1 ? nextP.turnsToPlay : 0) + 2;
        }
        player.turnsToPlay = 1; // Reset attacker's turns
        await delay(500);
        this.advanceToNextPlayer();
        break;

      case CardType.SEE_FUTURE:
        this.addLog(`🔮 ${player.name} nhìn trộm 3 lá trên cùng!`);
        Sounds.seeFuture();
        
        // Mystic stardust particles effect
        if (typeof UI !== 'undefined' && UI.animateSeeFutureMystic) {
          UI.animateSeeFutureMystic();
        }

        const topCards = this.deck.slice(-3).reverse();
        this.knownTopCards = [...topCards];
        this.knownTopCardsPlayer = player.index;
        if (player.isHuman) {
          await UI.showSeeFuture(topCards);
        } else {
          await delay(800);
          // AI knows the top cards now (stored in gameState)
          const names = topCards.map(c => c.emoji).join(' ');
          if (topCards.some(c => c.type === CardType.EXPLODING_KITTEN)) {
            this.addLog(`😰 ${player.name} trông có vẻ lo lắng...`);
          } else {
            this.addLog(`😌 ${player.name} trông có vẻ nhẹ nhõm.`);
          }
        }
        break;
 
      case CardType.SHUFFLE:
        this.addLog(`🔀 ${player.name} xáo bộ bài!`);
        Sounds.shuffle();
        shuffleDeck(this.deck);
        this.knownTopCards = null;
        this.knownTopCardsPlayer = -1;
        UI.animateShuffle();
        await delay(600);
        break;
 
      case CardType.FAVOR:
        if (!target) break;
        this.addLog(`🎁 ${player.name} xin bài từ ${target.name}!`);
        Sounds.favor();
 
        // Dynamic Paper Plane Animation
        if (typeof UI !== 'undefined' && UI.animateFavorFlight) {
          UI.animateFavorFlight(player, target);
          await delay(800); // Sync with paper plane flight duration
        }
 
        if (target.hand.length === 0) {
          this.addLog(`❌ ${target.name} không có bài!`);
          break;
        }
 
        let givenCard;
        if (target.isHuman) {
          // Human chooses which card to give
          givenCard = await UI.showFavorChoice(target, player);
        } else {
          // AI chooses
          givenCard = AI.chooseCardToGive(target);
          target.removeCard(givenCard.id);
        }
 
        if (givenCard) {
          player.addCard(givenCard);
          
          // Dynamic returning card flight animation!
          if (typeof UI !== 'undefined' && UI._flyCard) {
            const fromEl = target.isHuman ? UI.els.playerInfo : document.querySelector(`.opponent[data-player-index="${target.index}"]`);
            const toEl = player.isHuman ? UI.els.handCards : document.querySelector(`.opponent[data-player-index="${player.index}"]`);
            UI._flyCard(true, givenCard, fromEl, toEl);
            await delay(650); // Sync with card flight duration
          }
 
          if (player.isHuman) {
            this.addLog(`✅ Bạn nhận được: ${givenCard.emoji} ${givenCard.name}!`);
          } else if (target.isHuman) {
            this.addLog(`😢 Bạn phải cho ${player.name}: ${givenCard.emoji} ${givenCard.name}`);
          } else {
            this.addLog(`✅ ${target.name} cho ${player.name} 1 lá bài`);
          }
        }
        break;
    }
  },

  // ===== Card Drawing =====

  async drawCard() {
    if (this.isProcessing) return;

    // Online mode: delegate to server
    if (this.gameMode === 'online') {
      this.isProcessing = true;
      Network.drawCard();
      return;
    }

    this.isProcessing = true;

    const player = this.currentPlayer;
    if (this.deck.length === 0) {
      this.addLog('⚠️ Bộ bài đã hết! Bỏ qua lượt bốc bài.');
      this.isProcessing = false;
      player.turnsToPlay--;
      if (player.turnsToPlay <= 0) {
        player.turnsToPlay = 1;
        this.advanceToNextPlayer();
      } else {
        this.startTurn();
      }
      return;
    }

    const card = this.deck.pop();
    this.selectedCards = [];

    // Invalidate known top cards
    if (this.knownTopCards) {
      this.knownTopCards.shift();
      if (this.knownTopCards.length === 0) {
        this.knownTopCards = null;
        this.knownTopCardsPlayer = -1;
      }
    }

    Sounds.cardDraw();

    if (card.type === CardType.EXPLODING_KITTEN) {
      // BOOM!
      await this.handleExplodingKitten(player, card);
    } else {
      // Normal card
      player.addCard(card);
      
      // Animate card draw for BOTH human and AI players!
      UI.animateCardDraw(card, player);
      
      if (player.isHuman) {
        this.addLog(`📥 Bạn bốc được: ${card.emoji} ${card.name}`);
      } else {
        this.addLog(`📥 ${player.name} bốc 1 lá bài`);
      }
      await delay(600);

      // End turn
      player.turnsToPlay--;
      if (player.turnsToPlay <= 0) {
        player.turnsToPlay = 1;
        this.isProcessing = false;
        this.advanceToNextPlayer();
      } else {
        this.addLog(`⚠️ ${player.name} còn ${player.turnsToPlay} lượt phải chơi!`);
        this.isProcessing = false;
        this.startTurn();
      }
    }
  },

  async handleExplodingKitten(player, card) {
    this.addLog(`💣💥 ${player.name} bốc phải MÈO NỔ!!!`);
    Sounds.explosion();
    Sounds.vibrateExplosion();

    await UI.showExplosion(player);
    await delay(800);

    if (player.hasCardType(CardType.DEFUSE)) {
      // Has Defuse - saved!
      const defuse = player.removeCardByType(CardType.DEFUSE);
      this.discardPile.push(defuse);

      this.addLog(`🔧 ${player.name} dùng Tháo Ngòi!`);
      Sounds.defuse();
      await delay(500);

      // Place Exploding Kitten back in deck
      let position;
      if (player.isHuman) {
        position = await UI.showDefusePlacement(this.deck.length);
      } else {
        position = AI.chooseEKPlacement(this.deck.length, this, player);
        this.addLog(`🐱 ${player.name} đặt Mèo Nổ lại vào bộ bài...`);
        await delay(600);
      }

      // Insert at position (0 = top, deck.length = bottom)
      // deck array: index 0 is bottom, last index is top
      // position 0 = top = deck.length, position deck.length = bottom = 0
      const insertIdx = this.deck.length - position;
      this.deck.splice(Math.max(0, Math.min(insertIdx, this.deck.length)), 0, card);

      // Invalidate known top cards after insertion
      this.knownTopCards = null;
      this.knownTopCardsPlayer = -1;

      UI.hideExplosion();

      // Continue turn
      player.turnsToPlay--;
      if (player.turnsToPlay <= 0) {
        player.turnsToPlay = 1;
        this.isProcessing = false;
        this.advanceToNextPlayer();
      } else {
        this.addLog(`⚠️ ${player.name} còn ${player.turnsToPlay} lượt!`);
        this.isProcessing = false;
        this.startTurn();
      }
    } else {
      // No Defuse - eliminated!
      player.isAlive = false;
      this.addLog(`💀 ${player.name} đã bị loại!`);
      Sounds.eliminated();

      // Discard all their cards
      while (player.hand.length > 0) {
        this.discardPile.push(player.hand.pop());
      }

      await delay(800);
      UI.hideExplosion();

      // Check win condition
      const alive = this.getAlivePlayers();
      if (alive.length <= 1) {
        this.endGame(alive[0]);
        return;
      }

      // Continue to next player
      player.turnsToPlay = 1;
      this.isProcessing = false;
      this.advanceToNextPlayer();
    }
  },

  // ===== Nope System =====

  async checkForNope(card, playedBy, target) {
    // Cards that can't be Noped
    if (card.type === CardType.DEFUSE || card.type === CardType.EXPLODING_KITTEN) {
      return false;
    }

    let nopeCount = 0;

    // Check each player for Nope
    for (const player of this.players) {
      if (!player.isAlive) continue;
      if (player.index === playedBy.index) continue;

      if (player.hasCardType(CardType.NOPE)) {
        let wantsToNope = false;

        if (player.isHuman) {
          wantsToNope = await UI.showNopePrompt(card, playedBy, 4000);
        } else {
          // AI decision
          await delay(500);
          wantsToNope = AI.shouldNope(player, card, playedBy, target, this);
        }

        if (wantsToNope) {
          const nope = player.removeCardByType(CardType.NOPE);
          this.discardPile.push(nope);
          nopeCount++;

          this.addLog(`🚫 ${player.name} đánh Phản Đối!`);
          Sounds.nope();
          UI.animateCardPlay(nope, player);
          await delay(500);

          // Check for counter-Nope
          const counterNoped = await this.checkForCounterNope(player, nopeCount);
          if (counterNoped) {
            nopeCount++;
          }

          break; // Only one Nope per action (then counter-Nopes)
        }
      }
    }

    // Odd number of Nopes = action cancelled
    return nopeCount % 2 === 1;
  },

  async checkForCounterNope(nopedBy, currentNopeCount) {
    for (const player of this.players) {
      if (!player.isAlive) continue;
      if (player.index === nopedBy.index) continue;

      if (player.hasCardType(CardType.NOPE)) {
        let wantsToNope = false;

        if (player.isHuman) {
          wantsToNope = await UI.showNopePrompt(
            { type: CardType.NOPE, name: 'Phản Đối', emoji: '🚫' },
            nopedBy,
            3000
          );
        } else {
          await delay(400);
          // AI is less likely to counter-nope
          wantsToNope = player.hasCardType(CardType.NOPE) && Math.random() < 0.3;
        }

        if (wantsToNope) {
          const nope = player.removeCardByType(CardType.NOPE);
          this.discardPile.push(nope);

          this.addLog(`🚫 ${player.name} Phản Đối lại!`);
          Sounds.nope();
          await delay(500);
          return true;
        }
      }
    }
    return false;
  },

  // ===== AI Turn =====

  async aiPlayTurn(player) {
    await delay(1000 + Math.random() * 800);

    let actionsPlayed = 0;
    const maxActions = 3; // AI won't play more than 3 cards per turn

    while (actionsPlayed < maxActions && player.isAlive) {
      const decision = AI.decideTurn(player, this);

      if (decision.type === 'draw') {
        break; // Go to drawing phase
      }

      if (decision.type === 'play') {
        const success = await this.executeCard(player, decision.card, decision.target);
        actionsPlayed++;
        await delay(600 + Math.random() * 400);

        if (success) {
          // Check if turn ended (Skip/Attack resolve handles this)
          if (!player.isAlive || player.turnsToPlay <= 0) return;

          // If the card was Skip or Attack, turn is already handled
          if (decision.card.type === CardType.SKIP || decision.card.type === CardType.ATTACK) {
            return;
          }
        }
      }

      if (decision.type === 'play_pair') {
        await this.executeCatPair(player, decision.cards, decision.target);
        actionsPlayed++;
        await delay(600 + Math.random() * 400);
      }

      UI.renderAll();
    }

    // Draw card
    if (player.isAlive) {
      await this.drawCard();
    }
  },

  // ===== Turn Flow =====

  advanceToNextPlayer() {
    const nextIdx = this.getNextAlivePlayer(this.currentPlayerIndex);
    if (nextIdx < 0) {
      // No alive players? Shouldn't happen
      return;
    }
    this.currentPlayerIndex = nextIdx;
    this.isProcessing = false;

    UI.renderAll();
    setTimeout(() => this.startTurn(), 500);
  },

  // ===== Game End =====

  endGame(winner) {
    this.phase = GamePhase.GAME_OVER;

    if (winner) {
      if (winner.isHuman) {
        this.addLog('🎉🎊 CHÚC MỪNG! BẠN ĐÃ THẮNG! 🎊🎉');
        Sounds.victory();
      } else {
        this.addLog(`😿 ${winner.name} đã thắng! Bạn thua rồi...`);
      }
    }

    UI.showGameOver(winner);
  },

  // ===== Logging =====

  addLog(message) {
    this.log.push({
      text: message,
      time: Date.now()
    });
    // Keep last 50 messages
    if (this.log.length > 50) {
      this.log.shift();
    }
    UI.updateLog();
  }
};
