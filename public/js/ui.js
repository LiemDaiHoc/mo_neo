/**
 * ui.js - DOM rendering, interactions, animations, modals
 * Mèo Nổ (Exploding Kittens) Browser Game
 */

const UI = {
  // Cache DOM elements
  els: {},
  isDealingIntro: false,
  previousHandCardIds: [],
  dealTimeout: null,
  _lastTouchTime: 0,

  initElements() {
    this.els = {
      app: document.getElementById('app'),
      menuScreen: document.getElementById('menu-screen'),
      gameScreen: document.getElementById('game-screen'),
      gameOverScreen: document.getElementById('game-over-screen'),
      playerCountSlider: document.getElementById('player-count'),
      playerCountLabel: document.getElementById('player-count-label'),
      startBtn: document.getElementById('start-btn'),
      rulesBtn: document.getElementById('rules-btn'),
      rulesModal: document.getElementById('rules-modal'),
      opponentsArea: document.getElementById('opponents-area'),
      deckArea: document.getElementById('deck-pile'),
      deckCount: document.getElementById('deck-count'),
      discardArea: document.getElementById('discard-pile'),
      handArea: document.getElementById('hand-area'),
      handCards: document.getElementById('hand-cards'),
      drawBtn: document.getElementById('draw-btn'),
      playBtn: document.getElementById('play-btn'),
      playerInfo: document.getElementById('player-info'),
      gameLog: document.getElementById('game-log'),
      logMessages: document.getElementById('log-messages'),
      modalOverlay: document.getElementById('modal-overlay'),
      modalContent: document.getElementById('modal-content'),
      explosionOverlay: document.getElementById('explosion-overlay'),
      particles: document.getElementById('particles'),
      turnIndicator: document.getElementById('turn-indicator'),
      soundToggle: document.getElementById('sound-toggle'),
      goLabel: document.getElementById('go-label'),
      // Online elements
      modeSelect: document.getElementById('mode-select'),
      modeOfflineBtn: document.getElementById('mode-offline-btn'),
      modeOnlineBtn: document.getElementById('mode-online-btn'),
      offlinePanel: document.getElementById('offline-panel'),
      backToMode: document.getElementById('back-to-mode'),
      lobbyScreen: document.getElementById('lobby-screen'),
      waitingScreen: document.getElementById('waiting-screen'),
      backToMenu: document.getElementById('back-to-menu'),
      playerNameInput: document.getElementById('player-name-input'),
      avatarPicker: document.getElementById('avatar-picker'),
      tabCreate: document.getElementById('tab-create'),
      tabJoin: document.getElementById('tab-join'),
      createPanel: document.getElementById('create-panel'),
      joinPanel: document.getElementById('join-panel'),
      createRoomBtn: document.getElementById('create-room-btn'),
      joinRoomBtn: document.getElementById('join-room-btn'),
      roomCodeInput: document.getElementById('room-code-input'),
      leaveRoomBtn: document.getElementById('leave-room-btn'),
      roomCodeText: document.getElementById('room-code-text'),
      copyCodeBtn: document.getElementById('copy-code-btn'),
      waitingPlayerList: document.getElementById('waiting-player-list'),
      readyBtn: document.getElementById('ready-btn'),
      startOnlineBtn: document.getElementById('start-online-btn'),
      connectionStatus: document.getElementById('connection-status'),
      // B1-B8 new elements
      fullscreenBtn: document.getElementById('fullscreen-btn'),
      turnFlash: document.getElementById('turn-flash'),
    };
  },

  // Helper to find the local player
  getMyPlayer() {
    return Game.players.find(p => p.isHuman) || Game.players[0];
  },

  // ===== Screen Management =====

  showMenu() {
    this.initElements();
    this._hideAllScreens();
    this.els.menuScreen.classList.add('active');
    // Show mode select, hide offline panel
    if (this.els.modeSelect) this.els.modeSelect.style.display = '';
    if (this.els.offlinePanel) this.els.offlinePanel.style.display = 'none';
    this.setupMenuEvents();
    this.setupModeSelectEvents();
    this.setupFullscreen();
  },

  _hideAllScreens() {
    this.els.menuScreen.classList.remove('active');
    this.els.gameScreen.classList.remove('active');
    this.els.gameOverScreen.classList.remove('active');
    if (this.els.lobbyScreen) this.els.lobbyScreen.classList.remove('active');
    if (this.els.waitingScreen) this.els.waitingScreen.classList.remove('active');
  },

  showGame() {
    this._hideAllScreens();
    this.els.gameScreen.classList.add('active');
    this.setupGameEvents();
    
    // Set card dealing intro flags
    this.isDealingIntro = true;
    this.previousHandCardIds = [];
  },

  showGameOver(winner) {
    const screen = this.els.gameOverScreen;
    screen.classList.add('active');

    const title = screen.querySelector('.game-over-title');
    const avatar = screen.querySelector('.game-over-avatar');
    const subtitle = screen.querySelector('.game-over-subtitle');
    const stats = screen.querySelector('.game-over-stats');

    if (winner && winner.isHuman) {
      title.textContent = '🎉 CHIẾN THẮNG!';
      title.style.color = '#00ff88';
      avatar.textContent = '😺';
      subtitle.textContent = 'Bạn là người sống sót cuối cùng!';
      this.createConfetti();
    } else {
      title.textContent = '💀 THUA RỒI!';
      title.style.color = '#ff2e63';
      avatar.textContent = '😿';
      subtitle.textContent = winner ? `${winner.name} đã thắng!` : 'Game Over!';
    }

    // Stats
    stats.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Tổng lượt chơi</span>
        <span class="stat-value">${Game.turnCount}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Bài đã đánh</span>
        <span class="stat-value">${Game.discardPile.length}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Người sống sót</span>
        <span class="stat-value">${Game.getAlivePlayers().length}/${Game.numPlayers}</span>
      </div>
    `;

    const restartBtn = screen.querySelector('.restart-btn');
    restartBtn.onclick = () => {
      screen.classList.remove('active');
      this.stopConfetti();
      Game.startGame(Game.numPlayers);
    };

    const menuBtn = screen.querySelector('.menu-btn');
    menuBtn.onclick = () => {
      screen.classList.remove('active');
      this.stopConfetti();
      Game.init();
    };
  },

  // ===== Menu Events =====

  setupMenuEvents() {
    const slider = this.els.playerCountSlider;
    const label = this.els.playerCountLabel;

    if (slider) {
      const updateEmojis = () => {
        label.textContent = slider.value;
        const emojis = document.querySelector('.player-emojis');
        if (emojis) {
          const count = parseInt(slider.value);
          emojis.innerHTML = PLAYER_AVATARS.slice(0, count)
            .map((a, i) => `<span style="opacity:${i === 0 ? '1' : '0.6'}">${a}</span>`)
            .join('');
        }
      };
      slider.oninput = updateEmojis;
      updateEmojis();
    }

    this.els.startBtn.onclick = () => {
      Sounds.click();
      const numPlayers = parseInt(slider.value);
      Game.startGame(numPlayers);
    };

    this.els.rulesBtn.onclick = () => {
      Sounds.click();
      this.els.rulesModal.classList.add('active');
    };

    const closeRules = this.els.rulesModal.querySelector('.close-modal');
    if (closeRules) {
      closeRules.onclick = () => {
        this.els.rulesModal.classList.remove('active');
      };
    }

    this.els.rulesModal.onclick = (e) => {
      if (e.target === this.els.rulesModal) {
        this.els.rulesModal.classList.remove('active');
      }
    };

    // Sound toggle
    if (this.els.soundToggle) {
      this.els.soundToggle.onclick = () => {
        Sounds.enabled = !Sounds.enabled;
        this.els.soundToggle.textContent = Sounds.enabled ? '🔊' : '🔇';
        this.els.soundToggle.title = Sounds.enabled ? 'Tắt âm thanh' : 'Bật âm thanh';
      };
    }
  },

  // ===== Game Events =====

  setupGameEvents() {
    this.els.drawBtn.onclick = () => {
      if (Game.currentPlayer.isHuman && !Game.isProcessing) {
        Sounds.click();
        Game.drawCard();
      }
    };

    this.els.playBtn.onclick = () => {
      if (Game.currentPlayer.isHuman && !Game.isProcessing) {
        Sounds.click();
        Game.playSelectedCards();
      }
    };

    // Deck click also draws
    this.els.deckArea.onclick = () => {
      if (Game.currentPlayer.isHuman && !Game.isProcessing) {
        Sounds.click();
        Game.drawCard();
      }
    };
  },

  // ===== Rendering =====

  renderAll() {
    if (Game.gameMode === 'online') {
      this.renderOpponentsOnline();
    } else {
      this.renderOpponents();
    }
    this.renderHand();
    this.renderDeck();
    this.renderDiscard();
    this.renderPlayerInfo();
    this.updateActionButtons();
    this.highlightCurrentPlayer();
  },

  getOpponentPositionClass(playerIndex) {
    const myPlayer = this.getMyPlayer();
    const myIndex = myPlayer ? myPlayer.index : 0;
    const numPlayers = Game.players.length;
    const relIdx = (playerIndex - myIndex + numPlayers) % numPlayers;

    if (numPlayers === 2) {
      return 'pos-top-center';
    }
    if (numPlayers === 3) {
      if (relIdx === 1) return 'pos-top-left';
      if (relIdx === 2) return 'pos-top-right';
    }
    if (numPlayers === 4) {
      if (relIdx === 1) return 'pos-top-left';
      if (relIdx === 2) return 'pos-top-right';
      if (relIdx === 3) return 'pos-bottom-right';
    }
    if (numPlayers === 5) {
      if (relIdx === 1) return 'pos-top-left';
      if (relIdx === 2) return 'pos-top-middle';
      if (relIdx === 3) return 'pos-top-right';
      if (relIdx === 4) return 'pos-bottom-right';
    }
    return `pos-${relIdx}`;
  },

  renderOpponents() {
    const area = this.els.opponentsArea;
    area.innerHTML = '';

    for (const player of Game.players) {
      if (player.isHuman) continue;

      const div = document.createElement('div');
      const posClass = this.getOpponentPositionClass(player.index);
      div.className = `opponent ${posClass} ${player.isAlive ? '' : 'dead'} ${
        Game.currentPlayerIndex === player.index ? 'active-turn' : ''
      }`;
      div.dataset.playerIndex = player.index;

      const avatar = document.createElement('div');
      avatar.className = 'opponent-avatar';
      avatar.textContent = player.isAlive ? player.avatar : '💀';
      avatar.style.borderColor = player.color;

      const info = document.createElement('div');
      info.className = 'opponent-info';

      const name = document.createElement('div');
      name.className = 'opponent-name';
      name.textContent = player.name;
      name.style.color = player.color;

      const cards = document.createElement('div');
      cards.className = 'opponent-cards';
      cards.textContent = player.isAlive ? `🃏 ${player.cardCountDisplay}` : 'Bị loại';

      info.appendChild(name);
      info.appendChild(cards);
      div.appendChild(avatar);
      div.appendChild(info);

      // Show card backs
      if (player.isAlive && player.cardCountDisplay > 0) {
        const cardBacks = document.createElement('div');
        cardBacks.className = 'opponent-card-backs';
        const displayCount = Math.min(player.cardCountDisplay, 8);
        for (let i = 0; i < displayCount; i++) {
          const cardBack = document.createElement('div');
          cardBack.className = 'mini-card-back';
          cardBack.style.transform = `translateX(${i * 5}px)`;
          cardBacks.appendChild(cardBack);
        }
        if (player.cardCountDisplay > 8) {
          const more = document.createElement('span');
          more.className = 'more-cards';
          more.textContent = `+${player.cardCountDisplay - 8}`;
          cardBacks.appendChild(more);
        }
        div.appendChild(cardBacks);
      }

      area.appendChild(div);
    }
  },

  renderHand() {
    const container = this.els.handCards;
    container.innerHTML = '';

    const player = this.getMyPlayer();
    if (!player) return;

    if (!player.isAlive) {
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;width:100%;color:var(--text-muted);font-size:14px;font-weight:700;gap:8px;">
          <span style="font-size:28px">💀</span>
          <span>Bạn đã bị loại! Đang xem game tiếp...</span>
        </div>
      `;
      return;
    }

    // Sort hand: Defuse first, then action cards, then cat cards
    const sortOrder = {
      [CardType.DEFUSE]: 0,
      [CardType.NOPE]: 1,
      [CardType.SKIP]: 2,
      [CardType.ATTACK]: 3,
      [CardType.SEE_FUTURE]: 4,
      [CardType.SHUFFLE]: 5,
      [CardType.FAVOR]: 6,
      [CardType.CAT_TACO]: 7,
      [CardType.CAT_MELON]: 8,
      [CardType.CAT_BEARD]: 9,
      [CardType.CAT_RAINBOW]: 10,
      [CardType.EXPLODING_KITTEN]: 11
    };

    const sorted = [...player.hand].sort((a, b) =>
      (sortOrder[a.type] || 99) - (sortOrder[b.type] || 99)
    );

    sorted.forEach((card, i) => {
      const el = this.createCardElement(card, true);
      const isSelected = Game.selectedCards.map(String).includes(String(card.id));
      if (isSelected) {
        el.classList.add('selected');
      }

      // B5: Combo hint - highlight matching cat cards
      if (Game.selectedCards.length === 1 && !isSelected) {
        const selectedCard = player.hand.find(c => String(c.id) === String(Game.selectedCards[0]));
        if (selectedCard && isCatCard(selectedCard.type) && card.type === selectedCard.type) {
          el.classList.add('combo-hint');
        }
      }

      // Gesture state variables
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let currentX = 0;
      let currentY = 0;
      let dragThreshold = 8; // min drag to lock drag state
      let playThreshold = -80; // drag 80px upwards to play

      // Drag action handlers
      const onDragStart = (clientX, clientY) => {
        if (!Game.currentPlayer || !Game.currentPlayer.isHuman || Game.isProcessing) return;
        startX = clientX;
        startY = clientY;
        currentX = 0;
        currentY = 0;
        isDragging = false;
        UI._longPressTriggered = false;

        // Start 500ms long press timer
        clearTimeout(UI._longPressTimer);
        UI._longPressTimer = setTimeout(() => {
          UI._longPressTriggered = true;
          UI.haptic(40); // Haptic vibration indicator
          UI.showCardPreview(card);
          isDragging = false;
        }, 500);
      };

      const onDragMove = (clientX, clientY, event) => {
        const dx = clientX - startX;
        const dy = clientY - startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Cancel long press timer if drag exceeds threshold
        if (dist > dragThreshold) {
          clearTimeout(UI._longPressTimer);
        }

        // If long press occurred, block drag movement
        if (UI._longPressTriggered) {
          if (event && event.cancelable) event.preventDefault();
          return;
        }

        // Lock drag state if swiped vertically past threshold
        if (!isDragging && dist > dragThreshold && Math.abs(dy) > Math.abs(dx) * 0.4) {
          isDragging = true;

          // Smart selection integration:
          // If the card being dragged is NOT selected, select ONLY this card!
          const isSelected = Game.selectedCards.map(String).includes(String(card.id));
          if (!isSelected) {
            Game.selectedCards = [card.id];
            UI.updateCardSelectionStates();
          }

          // Set transition and z-index for all selected cards
          const selectedCards = container.querySelectorAll('.card.selected');
          selectedCards.forEach(cardEl => {
            cardEl.style.transition = 'none';
            cardEl.style.setProperty('z-index', '1000', 'important');
          });
          // Elevate parent stacking context so dragged cards float above all layers
          document.querySelector('.hand-section')?.classList.add('dragging-active');

          // DYNAMIC OVERLAY DROP ZONE CREATION & ACTIVATION
          let tableArea = document.querySelector('.table-area');
          let dropOverlay = document.getElementById('drop-zone-overlay');
          if (tableArea && !dropOverlay) {
            dropOverlay = document.createElement('div');
            dropOverlay.id = 'drop-zone-overlay';
            dropOverlay.className = 'drop-zone-overlay';
            dropOverlay.innerHTML = `
              <div class="drop-zone-icon">📥</div>
              <div class="drop-zone-text">Thả vào đây để đánh</div>
            `;
            tableArea.appendChild(dropOverlay);
          }
          if (dropOverlay) {
            dropOverlay.classList.add('active');
            const canPlay = Game.canPlaySelected();
            dropOverlay.className = `drop-zone-overlay active ${canPlay ? 'valid' : 'invalid'}`;
            dropOverlay.querySelector('.drop-zone-text').textContent = canPlay ? 'THẢ ĐỂ ĐÁNH BÀI!' : 'KHÔNG THỂ ĐÁNH LÁ NÀY!';
            dropOverlay.querySelector('.drop-zone-icon').textContent = canPlay ? '📥' : '⚠️';
          }
        }

        if (isDragging) {
          currentX = dx;
          currentY = dy;
          
          // Damp down pull offsets
          if (currentY > 0) currentY = currentY * 0.2; 
          
          // Animate ALL selected cards following cursor/finger together
          const selectedCards = container.querySelectorAll('.card.selected');
          selectedCards.forEach(cardEl => {
            cardEl.style.setProperty('transform', `translate(${currentX}px, ${currentY}px) scale(1.08) rotate(${currentX * 0.05}deg)`, 'important');
          });

          // Proactive dragging validation: check if combo is playable
          const canPlay = Game.canPlaySelected();
          const dropOverlay = document.getElementById('drop-zone-overlay');

          // Visual drop indicator (only if playable!)
          if (currentY < playThreshold && canPlay) {
            selectedCards.forEach(cardEl => cardEl.classList.add('ready-to-drop'));
            this.els.discardArea.classList.add('drop-zone-highlight');
            if (dropOverlay) {
              dropOverlay.classList.add('valid');
              dropOverlay.classList.remove('invalid');
            }
          } else {
            selectedCards.forEach(cardEl => cardEl.classList.remove('ready-to-drop'));
            this.els.discardArea.classList.remove('drop-zone-highlight');
            if (dropOverlay) {
              const canPlaySelected = Game.canPlaySelected();
              dropOverlay.className = `drop-zone-overlay active ${canPlaySelected ? 'valid' : 'invalid'}`;
            }
          }

          if (event && event.cancelable) event.preventDefault();
        }
      };

      const onDragEnd = () => {
        clearTimeout(UI._longPressTimer);

        // Hide active drop zone overlay
        let dropOverlay = document.getElementById('drop-zone-overlay');
        if (dropOverlay) {
          dropOverlay.classList.remove('active', 'valid', 'invalid');
        }

        if (UI._longPressTriggered) {
          UI._longPressTriggered = false;
          return;
        }

        if (isDragging) {
          isDragging = false;
          
          const selectedCards = container.querySelectorAll('.card.selected');
          selectedCards.forEach(cardEl => cardEl.classList.remove('ready-to-drop'));
          this.els.discardArea.classList.remove('drop-zone-highlight');

          // Reset parent stacking context
          document.querySelector('.hand-section')?.classList.remove('dragging-active');

          const canPlay = Game.canPlaySelected();
          if (currentY < playThreshold && canPlay) {
            // Play selected cards
            this.haptic(30);
            Game.playSelectedCards();
          } else {
            // Snap back ALL selected cards
            selectedCards.forEach(cardEl => {
              cardEl.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.4, 1)';
              cardEl.style.removeProperty('transform');
              cardEl.style.removeProperty('z-index');
            });

            // If they tried to play an invalid play, shake them!
            if (currentY < playThreshold && !canPlay) {
              this.haptic([50, 30, 50]);
              selectedCards.forEach(cardEl => {
                cardEl.classList.add('shake-invalid');
                setTimeout(() => cardEl.classList.remove('shake-invalid'), 400);
              });
            }
          }
        } else {
          // SINGLE-TAP ONLY (No double tap)
          this.haptic(10);
          Sounds.click();
          Game.selectCard(card.id);
        }
      };

      // Bind Mouse Events
      el.addEventListener('mousedown', (e) => {
        if (Date.now() - (UI._lastTouchTime || 0) < 600) return;
        onDragStart(e.clientX, e.clientY);
        
        const onMouseMove = (moveEvent) => onDragMove(moveEvent.clientX, moveEvent.clientY, moveEvent);
        const onMouseUp = () => {
          onDragEnd();
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        
        window.addEventListener('mousemove', onMouseMove, { passive: false });
        window.addEventListener('mouseup', onMouseUp);
      });

      // Bind Touch Events
      el.addEventListener('touchstart', (e) => {
        UI._lastTouchTime = Date.now();
        onDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      el.addEventListener('touchmove', (e) => {
        UI._lastTouchTime = Date.now();
        onDragMove(e.touches[0].clientX, e.touches[0].clientY, e);
      }, { passive: false });

      el.addEventListener('touchend', () => {
        UI._lastTouchTime = Date.now();
        onDragEnd();
      });

      el.addEventListener('touchcancel', () => {
        UI._lastTouchTime = Date.now();
        onDragEnd();
      });

      // Entrance / dealing animation and sound stagger
      if (this.isDealingIntro) {
        el.classList.add('card-dealing-entrance');
        el.style.animationDelay = `${i * 0.12}s`;
        setTimeout(() => {
          if (this.isDealingIntro) {
            Sounds.cardDraw();
          }
        }, i * 120);
      } else {
        // Prevent existing cards from re-animating on redraws, only animate new cards
        if (this.previousHandCardIds && this.previousHandCardIds.includes(card.id)) {
          el.style.animation = 'none';
        } else {
          el.style.animationDelay = '0s';
        }
      }

      container.appendChild(el);
    });

    // If in dealing intro, schedule transition back to stable state
    if (this.isDealingIntro) {
      const dealDuration = sorted.length * 120 + 500;
      if (this.dealTimeout) clearTimeout(this.dealTimeout);
      this.dealTimeout = setTimeout(() => {
        this.isDealingIntro = false;
        const elements = container.querySelectorAll('.card-dealing-entrance');
        elements.forEach(cardEl => {
          cardEl.classList.remove('card-dealing-entrance');
          cardEl.style.animation = 'none';
        });
      }, dealDuration);
    }

    // Save current cards IDs to prevent re-triggering deal animation on redraws
    this.previousHandCardIds = sorted.map(c => c.id);

    // Tap outside cards to deselect all
    container.onclick = (e) => {
      if (e.target === container && Game.selectedCards.length > 0) {
        Game.selectedCards = [];
        UI.updateCardSelectionStates();
      }
    };
  },

  updateCardSelectionStates() {
    const player = this.getMyPlayer();
    if (!player || !player.isAlive) return;

    const cardElements = this.els.handCards.querySelectorAll('.card');
    cardElements.forEach(el => {
      const cardId = el.dataset.cardId;
      const isSelected = Game.selectedCards.map(String).includes(String(cardId));
      
      // Update selected class
      if (isSelected) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }

      // Combo hint - highlight matching cat cards
      el.classList.remove('combo-hint');
      if (Game.selectedCards.length === 1 && !isSelected) {
        const selectedCard = player.hand.find(c => String(c.id) === String(Game.selectedCards[0]));
        const card = player.hand.find(c => String(c.id) === String(cardId));
        if (selectedCard && card && isCatCard(selectedCard.type) && card.type === selectedCard.type) {
          el.classList.add('combo-hint');
        }
      }
    });

    this.updateActionButtons();
  },

  createCardElement(card, faceUp = true) {
    const el = document.createElement('div');
    el.className = `card ${faceUp ? 'face-up' : 'face-down'}`;
    el.dataset.cardId = card.id;
    el.dataset.cardType = card.type;

    if (faceUp) {
      const [c1, c2] = card.gradient;
      el.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;

      el.innerHTML = `
        <div class="card-pattern">${card.bgPattern || ''}</div>
        <div class="card-emoji">${card.emoji}</div>
        <div class="card-name">${card.name}</div>
        <div class="card-desc">${card.description}</div>
      `;
    } else {
      el.innerHTML = `
        <div class="card-back-pattern">
          <span>🐱</span>
          <span>💣</span>
        </div>
      `;
    }

    return el;
  },

  renderDeck() {
    const count = Game.deck.length;
    this.els.deckCount.textContent = count;

    // Visual stack effect
    const deckEl = this.els.deckArea;
    deckEl.className = `deck-pile ${count === 0 ? 'empty' : ''}`;

    // Remove old danger text
    const oldDanger = deckEl.parentElement?.querySelector('.danger-text');
    if (oldDanger) oldDanger.remove();

    // B8: Enhanced danger indicator (only in offline mode where we know deck contents)
    if (Game.gameMode !== 'online') {
      const ekCount = Game.deck.filter(c => c.type === CardType.EXPLODING_KITTEN).length;
      const dangerLevel = count > 0 ? ekCount / count : 0;

      // Refined thresholds: Only show warnings if the deck is thin (<= 4 cards)
      if (count <= 4) {
        if (dangerLevel > 0.5) {
          deckEl.classList.add('danger-high', 'danger-extreme');
          const dt = document.createElement('div');
          dt.className = 'danger-text high';
          dt.textContent = '⚠️ Rất nguy hiểm!';
          deckEl.parentElement?.appendChild(dt);
        } else if (dangerLevel > 0.35) {
          deckEl.classList.add('danger-high');
          const dt = document.createElement('div');
          dt.className = 'danger-text high';
          dt.textContent = '⚠️ Nguy hiểm!';
          deckEl.parentElement?.appendChild(dt);
        } else if (dangerLevel > 0.22) {
          deckEl.classList.add('danger-medium');
          const dt = document.createElement('div');
          dt.className = 'danger-text medium';
          dt.textContent = '⚠ Cẩn thận...';
          deckEl.parentElement?.appendChild(dt);
        }
      }
    }
  },

  renderDiscard() {
    const pile = this.els.discardArea;
    pile.innerHTML = '';

    const discardSize = Game.discardPile.length;
    if (discardSize > 0) {
      // Render up to 4 cards stacked together with realistic translations and rotations
      const startIdx = Math.max(0, discardSize - 4);
      for (let i = startIdx; i < discardSize; i++) {
        const card = Game.discardPile[i];
        const cardEl = this.createCardElement(card, true);
        cardEl.classList.add('discard-card');
        
        // Deterministic offset and rotation based on index so it is stable when rendered
        const rot = ((i * 37) % 25) - 12; // Between -12deg and 12deg
        const tx = ((i * 13) % 10) - 5;    // Between -5px and 5px
        const ty = ((i * 23) % 10) - 5;    // Between -5px and 5px
        
        cardEl.style.transform = `rotate(${rot}deg) translate(${tx}px, ${ty}px)`;
        cardEl.style.zIndex = i - startIdx + 1; // Correct layering
        
        pile.appendChild(cardEl);
      }

      // Discard count badge on top
      const count = document.createElement('div');
      count.className = 'discard-count';
      count.textContent = discardSize;
      count.style.zIndex = 100;
      pile.appendChild(count);
    } else {
      pile.innerHTML = '<div class="empty-pile">Bài bỏ</div>';
    }
  },

  renderPlayerInfo() {
    const player = this.getMyPlayer();
    if (!player) return;

    const info = this.els.playerInfo;
    const isActive = Game.currentPlayerIndex === player.index ? 'active-turn' : '';
    info.className = `player-info-corner ${player.isAlive ? '' : 'dead'} ${isActive}`;
    
    info.innerHTML = `
      <div class="opponent-avatar" style="border-color: ${player.color}">${player.isAlive ? player.avatar : '💀'}</div>
      <div class="opponent-info">
        <div class="opponent-name" style="color: ${player.color}">${player.name}</div>
        <div class="opponent-cards">🃏 ${player.cardCountDisplay} lá</div>
      </div>
    `;
  },

  highlightCurrentPlayer() {
    // Remove all highlights
    document.querySelectorAll('.opponent').forEach(el => {
      el.classList.remove('active-turn');
    });

    const current = Game.currentPlayer;
    if (!current) return;

    if (!current.isHuman) {
      const opEl = document.querySelector(`.opponent[data-player-index="${current.index}"]`);
      if (opEl) opEl.classList.add('active-turn');
    }

    // Turn indicator
    if (this.els.turnIndicator) {
      if (current.isHuman) {
        let text = '🎯 Lượt của bạn';
        if (current.turnsToPlay > 1) {
          text += ` (còn ${current.turnsToPlay} lượt!)`;
        }
        this.els.turnIndicator.textContent = text;
        this.els.turnIndicator.className = 'turn-indicator your-turn';
      } else {
        this.els.turnIndicator.textContent = `⏳ ${current.name} đang chơi...`;
        this.els.turnIndicator.className = 'turn-indicator ai-turn';
        this.showTurnGlow(false);
      }
    }
  },

  updateActionButtons() {
    const isMyTurn = Game.currentPlayer.isHuman && !Game.isProcessing;
    const canPlay = Game.canPlaySelected();

    this.els.drawBtn.disabled = !isMyTurn;
    this.els.playBtn.disabled = !isMyTurn || !canPlay;

    // Update play button text based on selection
    if (Game.selectedCards.length === 2) {
      this.els.playBtn.textContent = '🐱 ĐÁNH CẶP';
    } else if (Game.selectedCards.length === 5) {
      this.els.playBtn.textContent = '✨ ĐÁNH COMBO 5 LÁ';
    } else if (Game.selectedCards.length === 1) {
      const card = this.getMyPlayer()?.hand.find(c => String(c.id) === String(Game.selectedCards[0]));
      if (card) {
        this.els.playBtn.textContent = `${card.emoji} ĐÁNH ${card.name}`;
      } else {
        this.els.playBtn.textContent = '🃏 ĐÁNH BÀI';
      }
    } else {
      this.els.playBtn.textContent = '🃏 Chọn bài...';
    }

    // Always show play button, but visually distinguish enabled/disabled states
    if (Game.selectedCards.length > 0 && canPlay) {
      this.els.playBtn.classList.add('visible');
      this.els.playBtn.classList.add('ready-pulse');
    } else {
      this.els.playBtn.classList.remove('visible');
      this.els.playBtn.classList.remove('ready-pulse');
    }
  },

  enablePlayerActions() {
    this.els.drawBtn.disabled = false;
    this.updateActionButtons();
    // Add turn border glow
    this.showTurnGlow(true);
    // Reset double-tap state between turns
    this._lastTapCardId = null;
    this._lastTapTime = 0;
    // B6: Turn flash - only on new turn start (not after each card play)
    if (!this._turnFlashShown) {
      this._turnFlashShown = true;
      const cp = Game.currentPlayer;
      if (cp && cp.isHuman) {
        if (cp.turnsToPlay > 1) {
          this.showTurnFlash(`⚔️ PHẢI CHƠI ${cp.turnsToPlay} LƯỢT!`, 'attack');
        } else {
          this.showTurnFlash('🎯 LƯỢT CỦA BẠN!', 'your-turn');
        }
      }
    }
  },

  _turnFlashShown: false,

  // ===== Turn Border Glow =====
  showTurnGlow(show) {
    const app = this.els.app;
    if (!app) return;
    if (show) {
      app.classList.add('your-turn-glow');
    } else {
      app.classList.remove('your-turn-glow');
    }
  },

  // ===== Card Preview (Long Press) =====
  _longPressTimer: null,
  _longPressTriggered: false,

  showCardPreview(card) {
    // Remove any existing preview overlay
    const existing = document.getElementById('card-preview-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'card-preview-overlay';
    overlay.id = 'card-preview-overlay';

    const previewCard = document.createElement('div');
    previewCard.className = 'card-preview-large';
    const [c1, c2] = card.gradient;
    previewCard.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
    previewCard.innerHTML = `
      <div class="card-preview-emoji">${card.emoji}</div>
      <div class="card-preview-name">${card.name}</div>
      <div class="card-preview-desc">${card.description}</div>
    `;

    overlay.appendChild(previewCard);
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);

    // Auto-close after 3s
    setTimeout(() => {
      if (document.body.contains(overlay)) overlay.remove();
    }, 3000);
  },

  // ===== Game Log =====

  updateLog() {
    const container = this.els.logMessages;
    if (!container) return;

    container.innerHTML = '';
    const recent = Game.log.slice(-5);

    recent.forEach((entry, i) => {
      const msg = document.createElement('div');
      msg.className = 'log-message';
      msg.textContent = entry.text;
      if (i === recent.length - 1) {
        msg.classList.add('latest');
      }
      container.appendChild(msg);
    });

    container.scrollTop = container.scrollHeight;
  },

  // ===== Animations =====

  _flyCard(faceUp, card, fromEl, toEl, callback) {
    if (!fromEl || !toEl) {
      if (callback) callback();
      return;
    }

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    // Create floating element
    const floater = document.createElement('div');
    floater.className = 'floating-card';
    
    // Detect if we should Y-flip (drawing for human player)
    const shouldFlip = (toEl === this.els.handCards);
    
    // Construct 3D rotating inner card
    floater.innerHTML = `
      <div class="floating-card-inner" style="transform: rotateY(${shouldFlip ? 0 : (faceUp ? 180 : 0)}deg) scale(0.5);">
        <div class="floating-card-front" style="background: linear-gradient(135deg, ${card?.gradient ? card.gradient[0] : '#ff2e63'}, ${card?.gradient ? card.gradient[1] : '#ff6b35'})">
          <div class="floating-card-emoji">${card ? card.emoji : '🃏'}</div>
          <div class="floating-card-name">${card ? card.name : 'Mèo Nổ'}</div>
        </div>
        <div class="floating-card-back">
          <div class="card-back-pattern">
            <span>🐱</span>
            <span>💣</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(floater);

    // Get actual width and height of the floater dynamically
    const floaterWidth = floater.offsetWidth || 85;
    const floaterHeight = floater.offsetHeight || 120;

    const startX = fromRect.left + fromRect.width / 2 - floaterWidth / 2;
    const startY = fromRect.top + fromRect.height / 2 - floaterHeight / 2;
    
    floater.style.left = `${startX}px`;
    floater.style.top = `${startY}px`;

    // Force reflow
    floater.offsetHeight;

    // Trigger flight
    floater.style.transition = 'all 0.65s cubic-bezier(0.25, 1, 0.4, 1)';
    const inner = floater.querySelector('.floating-card-inner');
    if (inner) {
      inner.style.transition = 'transform 0.65s cubic-bezier(0.25, 1, 0.4, 1)';
    }
    
    requestAnimationFrame(() => {
      const destX = toRect.left + toRect.width / 2 - floaterWidth / 2;
      const destY = toRect.top + toRect.height / 2 - floaterHeight / 2;
      
      floater.style.left = `${destX}px`;
      floater.style.top = `${destY}px`;
      floater.style.opacity = '1';
      
      if (inner) {
        // If drawing: Y-flip to face-up (180deg). If playing: Y-spin from 180deg to 540deg.
        const rotY = shouldFlip ? 180 : (faceUp ? 540 : 0);
        inner.style.transform = `rotateY(${rotY}deg) scale(1) rotate(${Math.random() * 20 - 10}deg)`;
      }
    });

    // Clean up
    setTimeout(() => {
      floater.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      floater.style.opacity = '0';
      if (inner) {
        inner.style.transition = 'transform 0.25s ease';
        inner.style.transform = `scale(0.85) rotate(${Math.random() * 30 - 15}deg)`;
      }
      
      setTimeout(() => {
        floater.remove();
        
        // Discard Pile Impact effect when card lands
        if (toEl === this.els.discardArea) {
          this.playDiscardImpact(card);
        }
        
        if (callback) callback();
      }, 250);
    }, 650);
  },

  animateCardPlay(card, player) {
    let fromEl;
    const myPlayer = this.getMyPlayer();
    if (player.index === myPlayer.index) {
      const cardEl = document.querySelector(`.card[data-card-id="${card.id}"]`);
      fromEl = cardEl || this.els.playerInfo;
    } else {
      fromEl = document.querySelector(`.opponent[data-player-index="${player.index}"]`);
    }
    
    const toEl = this.els.discardArea;
    this._flyCard(true, card, fromEl, toEl);

    // Trigger Nope screen effect!
    if (card.type === CardType.NOPE) {
      setTimeout(() => {
        this.triggerNopeGlitchEffect(player.name);
      }, 350); // Sync with flight mid-way
    }

    // Trigger Defuse screen effect!
    if (card.type === CardType.DEFUSE) {
      setTimeout(() => {
        this.triggerDefuseSavedEffect(player.name);
      }, 350);
    }
  },

  animateCardDraw(card, player) {
    const fromEl = this.els.deckArea;
    let toEl;
    
    const targetPlayer = player || this.getMyPlayer();
    const myPlayer = this.getMyPlayer();
    
    if (targetPlayer.index === myPlayer.index) {
      toEl = this.els.handCards;
    } else {
      toEl = document.querySelector(`.opponent[data-player-index="${targetPlayer.index}"]`);
    }
    
    this._flyCard(false, card, fromEl, toEl, () => {
      if (targetPlayer.index === myPlayer.index) {
        const handContainer = this.els.handCards;
        setTimeout(() => {
          const cards = handContainer.querySelectorAll('.card');
          if (cards.length > 0) {
            const last = cards[cards.length - 1];
            last.classList.add('new-card');
            setTimeout(() => last.classList.remove('new-card'), 600);
          }
          this.renderHand();
        }, 50);
      } else {
        if (Game.gameMode === 'online') {
          this.renderOpponentsOnline();
        } else {
          this.renderOpponents();
        }
      }
    });
  },

  animateShuffle() {
    const deck = this.els.deckArea;
    if (!deck) return;

    deck.classList.add('shuffling-base');
    setTimeout(() => deck.classList.remove('shuffling-base'), 1200);

    const rect = deck.getBoundingClientRect();
    const startX = rect.left;
    const startY = rect.top;

    const cards = [];
    const count = 3;

    // Create 3 temporary shuffling card elements fanning out in 3D
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'shuffling-card-fan';
      el.innerHTML = `
        <div class="card-back-pattern">
          <span>🐱</span>
          <span>💣</span>
        </div>
      `;
      el.style.left = `${startX}px`;
      el.style.top = `${startY}px`;
      el.style.zIndex = 1000 + i;
      
      let dir = 'center';
      if (i === 0) dir = 'left';
      if (i === 2) dir = 'right';
      
      el.classList.add(`fan-${dir}`);
      document.body.appendChild(el);
      cards.push(el);
    }

    // Play tactile vibration and sounds
    this.haptic([30, 20, 30, 20, 30, 20, 50]);

    // Clean up cards after shuffling
    setTimeout(() => {
      cards.forEach(el => {
        el.style.transition = 'all 0.3s ease';
        el.style.opacity = '0';
        el.style.transform = 'scale(0.5)';
        setTimeout(() => el.remove(), 300);
      });
    }, 1100);
  },

  // ===== Explosion Effect =====

  async showExplosion(player) {
    const overlay = this.els.explosionOverlay;
    overlay.classList.add('active');

    // Create particles
    const particles = this.els.particles;
    particles.innerHTML = '';

    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.textContent = ['💣', '🔥', '💥', '☠️', '🐱'][Math.floor(Math.random() * 5)];
      p.style.left = '50%';
      p.style.top = '50%';
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 150;
      p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
      p.style.setProperty('--delay', `${Math.random() * 0.3}s`);
      p.style.animationDelay = `${Math.random() * 0.3}s`;
      particles.appendChild(p);
    }

    // Explosion text
    const text = overlay.querySelector('.explosion-text');
    if (text) {
      text.textContent = `💣 ${player.name} BỐC PHẢI MÈO NỔ! 💣`;
    }

    return new Promise(resolve => setTimeout(resolve, 1200));
  },

  hideExplosion() {
    this.els.explosionOverlay.classList.remove('active');
  },

  // ===== Modals =====

  showModal(content, options = {}) {
    return new Promise((resolve) => {
      const overlay = this.els.modalOverlay;
      const contentEl = this.els.modalContent;

      contentEl.innerHTML = '';
      if (typeof content === 'string') {
        contentEl.innerHTML = content;
      } else {
        contentEl.appendChild(content);
      }

      overlay.classList.add('active');

      if (options.autoClose) {
        setTimeout(() => {
          overlay.classList.remove('active');
          resolve();
        }, options.autoClose);
      }

      // If there's a close button in the content
      const closeBtn = contentEl.querySelector('.modal-close-btn');
      if (closeBtn) {
        closeBtn.onclick = () => {
          overlay.classList.remove('active');
          resolve();
        };
      }

      // Store resolve for external use
      this._modalResolve = resolve;
    });
  },

  closeModal(value) {
    this.els.modalOverlay.classList.remove('active');
    if (this._modalResolve) {
      this._modalResolve(value);
      this._modalResolve = null;
    }
  },

  // ===== See the Future =====

  async showSeeFuture(topCards) {
    const container = document.createElement('div');
    container.className = 'modal-inner see-future-modal';

    const title = document.createElement('h3');
    title.className = 'modal-title';
    title.textContent = '🔮 3 Lá Trên Cùng';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'modal-subtitle';
    subtitle.textContent = 'Từ trái sang phải: trên cùng → dưới';
    container.appendChild(subtitle);

    const cardsRow = document.createElement('div');
    cardsRow.className = 'modal-cards-row';

    topCards.forEach((card, i) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'future-card-wrapper';

      const label = document.createElement('div');
      label.className = 'future-label';
      label.textContent = i === 0 ? 'Trên cùng' : i === 1 ? 'Thứ 2' : 'Thứ 3';

      const cardEl = this.createCardElement(card, true);
      cardEl.classList.add('future-card');
      cardEl.style.animationDelay = `${i * 0.15}s`;

      wrapper.appendChild(label);
      wrapper.appendChild(cardEl);
      cardsRow.appendChild(wrapper);
    });

    container.appendChild(cardsRow);

    const btn = document.createElement('button');
    btn.className = 'modal-btn modal-close-btn';
    btn.textContent = 'Đã hiểu!';
    container.appendChild(btn);

    await this.showModal(container);
  },

  // ===== Favor Choice =====

  showFavorChoice(targetPlayer, fromPlayer) {
    return new Promise((resolve) => {
      const container = document.createElement('div');
      container.className = 'modal-inner favor-modal';

      const title = document.createElement('h3');
      title.className = 'modal-title';
      title.textContent = `🎁 ${fromPlayer.name} xin bài!`;
      container.appendChild(title);

      const subtitle = document.createElement('p');
      subtitle.className = 'modal-subtitle';
      subtitle.textContent = 'Chọn 1 lá bài để cho:';
      container.appendChild(subtitle);

      const cardsRow = document.createElement('div');
      cardsRow.className = 'modal-cards-row favor-cards';

      targetPlayer.hand.forEach(card => {
        const cardEl = this.createCardElement(card, true);
        cardEl.classList.add('favor-card');
        cardEl.onclick = () => {
          targetPlayer.removeCard(card.id);
          this.closeModal();
          resolve(card);
        };
        cardsRow.appendChild(cardEl);
      });

      container.appendChild(cardsRow);
      this.showModal(container);
    });
  },

  // ===== Target Picker =====

  showTargetPicker(opponents, callback) {
    const container = document.createElement('div');
    container.className = 'modal-inner target-modal';

    const title = document.createElement('h3');
    title.className = 'modal-title';
    title.textContent = '🎯 Chọn mục tiêu';
    container.appendChild(title);

    const list = document.createElement('div');
    list.className = 'target-list';

    opponents.forEach(player => {
      const btn = document.createElement('button');
      btn.className = 'target-btn';
      btn.style.borderColor = player.color;
      btn.innerHTML = `
        <span class="target-avatar">${player.avatar}</span>
        <span class="target-name">${player.name}</span>
        <span class="target-cards">🃏 ${player.cardCountDisplay}</span>
      `;
      btn.onclick = () => {
        this.closeModal();
        Game.isProcessing = true;
        callback(player);
      };
      list.appendChild(btn);
    });

    container.appendChild(list);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-btn cancel-btn';
    cancelBtn.textContent = 'Hủy';
    cancelBtn.onclick = () => {
      this.closeModal();
      Game.isProcessing = false;
      Game.selectedCards = [];
      // Return the cards to hand (they weren't removed yet)
      UI.renderAll();
      UI.enablePlayerActions();
    };
    container.appendChild(cancelBtn);

    this.showModal(container);
  },

  // ===== Discard Pile Picker (Combo 5 lá) =====

  showDiscardPicker(discardPile, callback) {
    const container = document.createElement('div');
    container.className = 'modal-inner discard-picker-modal';
    container.style.maxWidth = '500px';
    container.style.width = '90%';

    const title = document.createElement('h3');
    title.className = 'modal-title';
    title.textContent = '🎁 Chọn 1 lá từ xấp bài bỏ';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'modal-subtitle';
    subtitle.textContent = 'Combo 5 lá thành công! Hãy chọn 1 lá bài bạn muốn lấy:';
    container.appendChild(subtitle);

    const list = document.createElement('div');
    list.className = 'discard-picker-list';
    list.style.display = 'grid';
    list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(75px, 1fr))';
    list.style.gap = '8px';
    list.style.maxHeight = '250px';
    list.style.overflowY = 'auto';
    list.style.padding = '8px';
    list.style.margin = '12px 0';
    list.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    list.style.borderRadius = '8px';
    list.style.background = 'rgba(0, 0, 0, 0.2)';

    const candidates = discardPile.filter(c => c.type !== 'exploding_kitten');

    if (candidates.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.gridColumn = '1 / -1';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.padding = '20px';
      emptyMsg.style.color = 'var(--text-muted)';
      emptyMsg.textContent = 'Không có lá bài nào hợp lệ trong xấp bài bỏ!';
      list.appendChild(emptyMsg);
    } else {
      candidates.forEach(card => {
        const cardBtn = document.createElement('button');
        cardBtn.className = 'card-picker-item';
        cardBtn.style.display = 'flex';
        cardBtn.style.flexDirection = 'column';
        cardBtn.style.alignItems = 'center';
        cardBtn.style.justifyContent = 'center';
        cardBtn.style.aspectRatio = '2/3';
        cardBtn.style.borderRadius = '8px';
        cardBtn.style.border = '1px solid rgba(255, 255, 255, 0.15)';
        const [c1, c2] = card.gradient || ['#3a3a3a', '#1a1a1a'];
        cardBtn.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
        cardBtn.style.cursor = 'pointer';
        cardBtn.style.padding = '8px';
        cardBtn.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';

        cardBtn.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 4px;">${card.emoji}</div>
          <div style="font-size: 8px; font-weight: 800; color: white; text-align: center; word-break: break-word; line-height: 1.1;">${card.name}</div>
        `;

        cardBtn.onmouseenter = () => {
          cardBtn.style.transform = 'scale(1.08)';
          cardBtn.style.boxShadow = '0 0 12px rgba(255, 255, 255, 0.2)';
        };
        cardBtn.onmouseleave = () => {
          cardBtn.style.transform = '';
          cardBtn.style.boxShadow = '';
        };

        cardBtn.onclick = () => {
          this.closeModal();
          callback(card);
        };
        list.appendChild(cardBtn);
      });
    }

    container.appendChild(list);

    if (discardPile.length === 0) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'modal-btn cancel-btn';
      closeBtn.textContent = 'Đóng';
      closeBtn.onclick = () => {
        this.closeModal();
        Game.isProcessing = false;
        Game.selectedCards = [];
        UI.renderAll();
      };
      container.appendChild(closeBtn);
    }

    this.showModal(container);
  },

  showOnlineDiscardPicker(discardPile) {
    const container = document.createElement('div');
    container.className = 'modal-inner discard-picker-modal';
    container.style.maxWidth = '500px';
    container.style.width = '90%';

    const title = document.createElement('h3');
    title.className = 'modal-title';
    title.textContent = '🎁 Chọn 1 lá từ xấp bài bỏ';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'modal-subtitle';
    subtitle.textContent = 'Combo 5 lá thành công! Hãy chọn 1 lá bài bạn muốn lấy:';
    container.appendChild(subtitle);

    const list = document.createElement('div');
    list.className = 'discard-picker-list';
    list.style.display = 'grid';
    list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(75px, 1fr))';
    list.style.gap = '8px';
    list.style.maxHeight = '250px';
    list.style.overflowY = 'auto';
    list.style.padding = '8px';
    list.style.margin = '12px 0';
    list.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    list.style.borderRadius = '8px';
    list.style.background = 'rgba(0, 0, 0, 0.2)';

    const candidates = discardPile.filter(c => c.type !== 'exploding_kitten');

    if (candidates.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.gridColumn = '1 / -1';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.padding = '20px';
      emptyMsg.style.color = 'var(--text-muted)';
      emptyMsg.textContent = 'Không có lá bài nào hợp lệ trong xấp bài bỏ!';
      list.appendChild(emptyMsg);
    } else {
      candidates.forEach(card => {
        const info = CARD_INFO[card.type] || { name: card.type, emoji: '🃏', gradient: ['#3a3a3a', '#1a1a1a'] };
        const cardBtn = document.createElement('button');
        cardBtn.className = 'card-picker-item';
        cardBtn.style.display = 'flex';
        cardBtn.style.flexDirection = 'column';
        cardBtn.style.alignItems = 'center';
        cardBtn.style.justifyContent = 'center';
        cardBtn.style.aspectRatio = '2/3';
        cardBtn.style.borderRadius = '8px';
        cardBtn.style.border = '1px solid rgba(255, 255, 255, 0.15)';
        const [c1, c2] = info.gradient || ['#3a3a3a', '#1a1a1a'];
        cardBtn.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
        cardBtn.style.cursor = 'pointer';
        cardBtn.style.padding = '8px';
        cardBtn.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';

        cardBtn.innerHTML = `
          <div style="font-size: 24px; margin-bottom: 4px;">${info.emoji}</div>
          <div style="font-size: 8px; font-weight: 800; color: white; text-align: center; word-break: break-word; line-height: 1.1;">${info.name}</div>
        `;

        cardBtn.onmouseenter = () => {
          cardBtn.style.transform = 'scale(1.08)';
          cardBtn.style.boxShadow = '0 0 12px rgba(255, 255, 255, 0.2)';
        };
        cardBtn.onmouseleave = () => {
          cardBtn.style.transform = '';
          cardBtn.style.boxShadow = '';
        };

        cardBtn.onclick = () => {
          this.closeModal();
          Network.discardPickerPick(card.id);
        };
        list.appendChild(cardBtn);
      });
    }

    container.appendChild(list);

    if (discardPile.length === 0) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'modal-btn cancel-btn';
      closeBtn.textContent = 'Đóng';
      closeBtn.onclick = () => {
        this.closeModal();
      };
      container.appendChild(closeBtn);
    }

    this.showModal(container);
  },

  // ===== Defuse Placement =====

  showDefusePlacement(deckSize) {
    return new Promise((resolve) => {
      const container = document.createElement('div');
      container.className = 'modal-inner defuse-modal';

      const title = document.createElement('h3');
      title.className = 'modal-title';
      title.textContent = '🔧 Tháo Ngòi Thành Công!';
      container.appendChild(title);

      const subtitle = document.createElement('p');
      subtitle.className = 'modal-subtitle';
      subtitle.textContent = 'Đặt Mèo Nổ vào vị trí nào trong bộ bài?';
      container.appendChild(subtitle);

      // Position slider
      const sliderContainer = document.createElement('div');
      sliderContainer.className = 'defuse-slider-container';

      const topLabel = document.createElement('div');
      topLabel.className = 'defuse-label';
      topLabel.textContent = '⬆️ Trên cùng (nguy hiểm cho người tiếp!)';

      const bottomLabel = document.createElement('div');
      bottomLabel.className = 'defuse-label';
      bottomLabel.textContent = '⬇️ Dưới cùng (an toàn hơn)';

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'defuse-slider';
      slider.min = 0;
      slider.max = deckSize;
      slider.value = Math.floor(deckSize / 2);

      const posLabel = document.createElement('div');
      posLabel.className = 'defuse-position';
      posLabel.textContent = `Vị trí: ${slider.value} / ${deckSize}`;

      slider.oninput = () => {
        posLabel.textContent = `Vị trí: ${slider.value} / ${deckSize}`;
        if (parseInt(slider.value) <= 2) {
          posLabel.style.color = '#ff2e63';
        } else if (parseInt(slider.value) >= deckSize - 2) {
          posLabel.style.color = '#00ff88';
        } else {
          posLabel.style.color = '#fff';
        }
      };

      sliderContainer.appendChild(topLabel);
      sliderContainer.appendChild(slider);
      sliderContainer.appendChild(posLabel);
      sliderContainer.appendChild(bottomLabel);
      container.appendChild(sliderContainer);

      // Quick position buttons
      const quickBtns = document.createElement('div');
      quickBtns.className = 'defuse-quick-btns';

      const positions = [
        { label: '⬆️ Trên cùng', value: 0 },
        { label: '🎲 Ngẫu nhiên', value: Math.floor(Math.random() * (deckSize + 1)) },
        { label: '⬇️ Dưới cùng', value: deckSize }
      ];

      positions.forEach(pos => {
        const btn = document.createElement('button');
        btn.className = 'quick-pos-btn';
        btn.textContent = pos.label;
        btn.onclick = () => {
          slider.value = pos.value;
          slider.dispatchEvent(new Event('input'));
        };
        quickBtns.appendChild(btn);
      });

      container.appendChild(quickBtns);

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'modal-btn confirm-btn';
      confirmBtn.textContent = '✅ Xác Nhận';
      confirmBtn.onclick = () => {
        this.closeModal();
        resolve(parseInt(slider.value));
      };
      container.appendChild(confirmBtn);

      this.showModal(container);
    });
  },

  // ===== Nope Prompt =====

  showNopePrompt(card, playedBy, timeoutMs) {
    return new Promise((resolve) => {
      const player = this.getMyPlayer();
      if (!player.isAlive || !player.hasCardType(CardType.NOPE)) {
        resolve(false);
        return;
      }

      const container = document.createElement('div');
      container.className = 'modal-inner nope-modal';

      const title = document.createElement('h3');
      title.className = 'modal-title nope-title';
      title.textContent = `${playedBy.name} đánh ${card.emoji} ${card.name}!`;
      container.appendChild(title);

      const subtitle = document.createElement('p');
      subtitle.className = 'modal-subtitle';
      subtitle.textContent = 'Bạn muốn Phản Đối không?';
      container.appendChild(subtitle);

      // Countdown bar
      const countdownBar = document.createElement('div');
      countdownBar.className = 'countdown-bar';
      const fill = document.createElement('div');
      fill.className = 'countdown-fill';
      fill.style.animationDuration = `${timeoutMs}ms`;
      countdownBar.appendChild(fill);
      container.appendChild(countdownBar);

      const btnsRow = document.createElement('div');
      btnsRow.className = 'nope-btns';

      const nopeBtn = document.createElement('button');
      nopeBtn.className = 'modal-btn nope-btn';
      nopeBtn.textContent = '🚫 PHẢN ĐỐI!';
      nopeBtn.onclick = () => {
        clearTimeout(timeout);
        this.closeModal();
        resolve(true);
      };

      const skipBtn = document.createElement('button');
      skipBtn.className = 'modal-btn skip-nope-btn';
      skipBtn.textContent = 'Bỏ qua';
      skipBtn.onclick = () => {
        clearTimeout(timeout);
        this.closeModal();
        resolve(false);
      };

      btnsRow.appendChild(nopeBtn);
      btnsRow.appendChild(skipBtn);
      container.appendChild(btnsRow);

      this.showModal(container);

      const timeout = setTimeout(() => {
        this.closeModal();
        resolve(false);
      }, timeoutMs);
    });
  },

  // ===== Confetti Effect =====

  confettiInterval: null,

  createConfetti() {
    const colors = ['#ff2e63', '#00d4ff', '#00ff88', '#fbbf24', '#c084fc', '#ff6b35'];
    const container = document.getElementById('confetti-container');
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'block';

    this.confettiInterval = setInterval(() => {
      for (let i = 0; i < 3; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = `${6 + Math.random() * 8}px`;
        confetti.style.height = `${6 + Math.random() * 8}px`;
        confetti.style.animationDuration = `${2 + Math.random() * 3}s`;
        confetti.style.animationDelay = `${Math.random() * 0.5}s`;
        container.appendChild(confetti);

        setTimeout(() => confetti.remove(), 5000);
      }
    }, 100);
  },

  stopConfetti() {
    if (this.confettiInterval) {
      clearInterval(this.confettiInterval);
      this.confettiInterval = null;
    }
    const container = document.getElementById('confetti-container');
    if (container) {
      container.innerHTML = '';
      container.style.display = 'none';
    }
  },

  // ===== Mode Select Events =====

  setupModeSelectEvents() {
    if (!this.els.modeOfflineBtn) return;

    this.els.modeOfflineBtn.onclick = () => {
      Sounds.click();
      this.showOfflineMenu();
    };

    this.els.modeOnlineBtn.onclick = () => {
      Sounds.click();
      this.showOnlineLobby();
    };

    if (this.els.backToMode) {
      this.els.backToMode.onclick = () => {
        Sounds.click();
        this.showModeSelect();
      };
    }
  },

  showModeSelect() {
    if (this.els.modeSelect) this.els.modeSelect.style.display = '';
    if (this.els.offlinePanel) this.els.offlinePanel.style.display = 'none';
  },

  showOfflineMenu() {
    Game.initOffline();
    if (this.els.modeSelect) this.els.modeSelect.style.display = 'none';
    if (this.els.offlinePanel) this.els.offlinePanel.style.display = '';
  },

  // ===== Online Lobby =====

  showOnlineLobby() {
    this._hideAllScreens();
    this.els.lobbyScreen.classList.add('active');
    this.setupOnlineLobbyEvents();

    // Connect to server
    Network.connect();
  },

  _selectedAvatar: '😺',
  _selectedMaxPlayers: 4,

  setupOnlineLobbyEvents() {
    // Back button
    if (this.els.backToMenu) {
      this.els.backToMenu.onclick = () => {
        Sounds.click();
        Network.disconnect();
        this._hideAllScreens();
        this.els.menuScreen.classList.add('active');
        this.showModeSelect();
      };
    }

    // Avatar picker
    if (this.els.avatarPicker) {
      const avatarBtns = this.els.avatarPicker.querySelectorAll('.avatar-option');
      avatarBtns.forEach(btn => {
        btn.onclick = () => {
          avatarBtns.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          this._selectedAvatar = btn.dataset.avatar;
        };
      });
    }

    // Tabs
    if (this.els.tabCreate && this.els.tabJoin) {
      this.els.tabCreate.onclick = () => {
        this.els.tabCreate.classList.add('active');
        this.els.tabJoin.classList.remove('active');
        this.els.createPanel.style.display = '';
        this.els.joinPanel.style.display = 'none';
      };
      this.els.tabJoin.onclick = () => {
        this.els.tabJoin.classList.add('active');
        this.els.tabCreate.classList.remove('active');
        this.els.joinPanel.style.display = '';
        this.els.createPanel.style.display = 'none';
      };
    }

    // Max players buttons
    const maxPBtns = document.querySelectorAll('.max-p-btn');
    maxPBtns.forEach(btn => {
      btn.onclick = () => {
        maxPBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._selectedMaxPlayers = parseInt(btn.dataset.val);
      };
    });

    // Create Room
    if (this.els.createRoomBtn) {
      this.els.createRoomBtn.onclick = () => {
        const name = (this.els.playerNameInput.value || '').trim();
        if (!name) {
          this.els.playerNameInput.classList.add('input-error');
          setTimeout(() => this.els.playerNameInput.classList.remove('input-error'), 600);
          return;
        }
        Sounds.click();
        Network.createRoom(name, this._selectedAvatar, this._selectedMaxPlayers);
      };
    }

    // Join Room
    if (this.els.joinRoomBtn) {
      this.els.joinRoomBtn.onclick = () => {
        const name = (this.els.playerNameInput.value || '').trim();
        const code = (this.els.roomCodeInput.value || '').trim().toUpperCase();
        if (!name) {
          this.els.playerNameInput.classList.add('input-error');
          setTimeout(() => this.els.playerNameInput.classList.remove('input-error'), 600);
          return;
        }
        if (!code) {
          this.els.roomCodeInput.classList.add('input-error');
          setTimeout(() => this.els.roomCodeInput.classList.remove('input-error'), 600);
          return;
        }
        Sounds.click();
        Network.joinRoom(code, name, this._selectedAvatar);
      };
    }
  },

  // ===== Waiting Room =====

  showWaitingRoom(data) {
    this._hideAllScreens();
    this.els.waitingScreen.classList.add('active');

    if (this.els.roomCodeText) {
      this.els.roomCodeText.textContent = data.roomCode || '----';
    }

    this.updateWaitingRoom(data);
    this.setupWaitingRoomEvents();
  },

  updateWaitingRoom(data) {
    const list = this.els.waitingPlayerList;
    if (!list || !data) return;

    // Resolve room and players from nested or flat payload
    const room = data.room || data;
    const players = data.players || (room && room.players);
    const hostId = room ? room.hostId : null;
    if (!players) return;

    // Dynamically synchronize host status before rendering
    if (hostId && typeof Network !== 'undefined') {
      Network.isHost = (hostId === Network.myPlayerId);
    }

    list.innerHTML = '';
    players.forEach(p => {
      const item = document.createElement('div');
      const isMe = p.id === Network.myPlayerId;
      const isReady = p.ready !== undefined ? p.ready : p.isReady;
      const isHost = p.id === hostId || p.isHost;

      item.className = `player-item ${isReady ? 'ready' : ''} ${isMe ? 'is-me' : ''} ${isHost ? 'is-host' : ''}`;
      item.innerHTML = `
        <span class="pi-avatar">${p.avatar || '😺'}</span>
        <span class="pi-name">${p.name}${isHost ? ' <span class="host-crown">👑</span>' : ''}${isMe ? ' (Bạn)' : ''}</span>
        <span class="pi-status">${isHost ? '👑 Chủ phòng' : (isReady ? '✅ Sẵn sàng' : '⏳ Chưa sẵn sàng')}</span>
      `;
      list.appendChild(item);
    });

    // Check game start conditions:
    // 1. All guest players (non-hosts) must be ready
    // 2. Minimum 2 players required to begin
    const guests = players.filter(p => p.id !== hostId);
    const allGuestsReady = guests.every(p => p.ready || p.isReady);
    const enoughPlayers = players.length >= 2;

    if (this.els.startOnlineBtn) {
      this.els.startOnlineBtn.style.display = Network.isHost ? '' : 'none';
      this.els.startOnlineBtn.disabled = !(allGuestsReady && enoughPlayers);
    }

    // Update ready button display logic for host (host doesn't need to ready up)
    if (this.els.readyBtn) {
      this.els.readyBtn.style.display = Network.isHost ? 'none' : '';
    }
  },

  _isReady: false,

  setupWaitingRoomEvents() {
    this._isReady = false;

    // Ready button
    if (this.els.readyBtn) {
      this.els.readyBtn.onclick = () => {
        Sounds.click();
        this._isReady = !this._isReady;
        this.els.readyBtn.classList.toggle('is-ready', this._isReady);
        this.els.readyBtn.textContent = this._isReady ? '✅ ĐÃ SẴN SÀNG' : '✅ SẴN SÀNG';
        Network.toggleReady();
      };
    }

    // Start Game (host)
    if (this.els.startOnlineBtn) {
      this.els.startOnlineBtn.onclick = () => {
        Sounds.click();
        Network.startGame();
      };
    }

    // Leave Room
    if (this.els.leaveRoomBtn) {
      this.els.leaveRoomBtn.onclick = () => {
        Sounds.click();
        Network.leaveRoom();
        this.showOnlineLobby();
      };
    }

    // Copy Code
    if (this.els.copyCodeBtn) {
      this.els.copyCodeBtn.onclick = () => {
        const code = this.els.roomCodeText.textContent;
        navigator.clipboard.writeText(code).then(() => {
          this.els.copyCodeBtn.textContent = '✅';
          setTimeout(() => { this.els.copyCodeBtn.textContent = '📋'; }, 1500);
        }).catch(() => {});
      };
    }
  },

  // ===== Connection Status =====

  updateConnectionStatus(connected) {
    const statusEl = this.els.connectionStatus || document.getElementById('connection-status');
    if (!statusEl) return;
    const dot = statusEl.querySelector('.status-dot');
    const text = statusEl.querySelector('.status-text');
    if (dot) {
      dot.classList.toggle('connected', connected);
      dot.classList.toggle('disconnected', !connected);
    }
    if (text) {
      text.textContent = connected ? 'Đã kết nối' : 'Mất kết nối...';
    }
  },

  showDisconnectMessage() {
    this.showModal(`
      <div class="modal-inner">
        <h3 class="modal-title">⚠️ Mất kết nối</h3>
        <p class="modal-subtitle">Đang cố kết nối lại với máy chủ...</p>
        <button class="modal-btn modal-close-btn" onclick="UI.closeModal(); Game.init();">🏠 Về Menu</button>
      </div>
    `);
  },

  showRoomError(message) {
    this.showModal(`
      <div class="modal-inner">
        <h3 class="modal-title">❌ Lỗi</h3>
        <p class="modal-subtitle">${message}</p>
        <button class="modal-btn modal-close-btn">Đã hiểu</button>
      </div>
    `);
  },

  // ===== Online Game Modals =====

  showOnlineNopePrompt(data) {
    // data: { card, playedBy, timeoutMs }
    const player = Game.players.find(p => p.isHuman);
    if (!player || !player.isAlive) return;
    if (!player.hand.some(c => c.type === CardType.NOPE)) return;

    const container = document.createElement('div');
    container.className = 'modal-inner nope-modal';

    const title = document.createElement('h3');
    title.className = 'modal-title nope-title';
    title.textContent = `${data.playedByName} đánh ${data.card.emoji} ${data.card.name}!`;
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'modal-subtitle';
    subtitle.textContent = 'Bạn muốn Phản Đối không?';
    container.appendChild(subtitle);

    const countdownBar = document.createElement('div');
    countdownBar.className = 'countdown-bar';
    const fill = document.createElement('div');
    fill.className = 'countdown-fill';
    fill.style.animationDuration = `${data.timeoutMs || 4000}ms`;
    countdownBar.appendChild(fill);
    container.appendChild(countdownBar);

    const btnsRow = document.createElement('div');
    btnsRow.className = 'nope-btns';

    const nopeBtn = document.createElement('button');
    nopeBtn.className = 'modal-btn nope-btn';
    nopeBtn.textContent = '🚫 PHẢN ĐỐI!';
    nopeBtn.onclick = () => {
      clearTimeout(timeout);
      this.closeModal();
      Network.nopeResponse(true);
    };

    const skipBtn = document.createElement('button');
    skipBtn.className = 'modal-btn skip-nope-btn';
    skipBtn.textContent = 'Bỏ qua';
    skipBtn.onclick = () => {
      clearTimeout(timeout);
      this.closeModal();
      Network.nopeResponse(false);
    };

    btnsRow.appendChild(nopeBtn);
    btnsRow.appendChild(skipBtn);
    container.appendChild(btnsRow);

    this.showModal(container);

    const timeout = setTimeout(() => {
      this.closeModal();
      Network.nopeResponse(false);
    }, data.timeoutMs || 4000);
  },

  showOnlineFavorChoice(data) {
    // data: { fromPlayerName, myHand }
    const container = document.createElement('div');
    container.className = 'modal-inner favor-modal';

    const title = document.createElement('h3');
    title.className = 'modal-title';
    title.textContent = `🎁 ${data.fromPlayerName} xin bài!`;
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'modal-subtitle';
    subtitle.textContent = 'Chọn 1 lá bài để cho:';
    container.appendChild(subtitle);

    const cardsRow = document.createElement('div');
    cardsRow.className = 'modal-cards-row favor-cards';

    data.myHand.forEach(card => {
      const cardEl = this.createCardElement(card, true);
      cardEl.classList.add('favor-card');
      cardEl.onclick = () => {
        this.closeModal();
        Network.favorGive(card.id);
      };
      cardsRow.appendChild(cardEl);
    });

    container.appendChild(cardsRow);
    this.showModal(container);
  },

  showOnlineDefusePlacement(deckSize) {
    const container = document.createElement('div');
    container.className = 'modal-inner defuse-modal';

    const title = document.createElement('h3');
    title.className = 'modal-title';
    title.textContent = '🔧 Tháo Ngòi Thành Công!';
    container.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'modal-subtitle';
    subtitle.textContent = 'Đặt Mèo Nổ vào vị trí nào trong bộ bài?';
    container.appendChild(subtitle);

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'defuse-slider-container';

    const topLabel = document.createElement('div');
    topLabel.className = 'defuse-label';
    topLabel.textContent = '⬆️ Trên cùng (nguy hiểm cho người tiếp!)';

    const bottomLabel = document.createElement('div');
    bottomLabel.className = 'defuse-label';
    bottomLabel.textContent = '⬇️ Dưới cùng (an toàn hơn)';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'defuse-slider';
    slider.min = 0;
    slider.max = deckSize;
    slider.value = Math.floor(deckSize / 2);

    const posLabel = document.createElement('div');
    posLabel.className = 'defuse-position';
    posLabel.textContent = `Vị trí: ${slider.value} / ${deckSize}`;

    slider.oninput = () => {
      posLabel.textContent = `Vị trí: ${slider.value} / ${deckSize}`;
      if (parseInt(slider.value) <= 2) {
        posLabel.style.color = '#ff2e63';
      } else if (parseInt(slider.value) >= deckSize - 2) {
        posLabel.style.color = '#00ff88';
      } else {
        posLabel.style.color = '#fff';
      }
    };

    sliderContainer.appendChild(topLabel);
    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(posLabel);
    sliderContainer.appendChild(bottomLabel);
    container.appendChild(sliderContainer);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'modal-btn confirm-btn';
    confirmBtn.textContent = '✅ Xác Nhận';
    confirmBtn.onclick = () => {
      this.closeModal();
      Network.defusePlace(parseInt(slider.value));
    };
    container.appendChild(confirmBtn);

    this.showModal(container);
  },

  // ===== Online Opponents Rendering =====
  // Override for online: show card count only, no card backs
  renderOpponentsOnline() {
    const area = this.els.opponentsArea;
    area.innerHTML = '';

    for (const player of Game.players) {
      if (player.isHuman) continue;

      const div = document.createElement('div');
      const posClass = this.getOpponentPositionClass(player.index);
      div.className = `opponent ${posClass} ${player.isAlive ? '' : 'dead'} ${
        Game.currentPlayerIndex === player.index ? 'active-turn' : ''
      }`;
      div.dataset.playerIndex = player.index;

      const avatar = document.createElement('div');
      avatar.className = 'opponent-avatar';
      avatar.textContent = player.isAlive ? player.avatar : '💀';
      avatar.style.borderColor = player.color;

      const info = document.createElement('div');
      info.className = 'opponent-info';

      const name = document.createElement('div');
      name.className = 'opponent-name';
      name.textContent = player.name;
      name.style.color = player.color;

      const cards = document.createElement('div');
      cards.className = 'opponent-cards';
      cards.textContent = player.isAlive ? `🃏 ${player.cardCountDisplay}` : 'Bị loại';

      info.appendChild(name);
      info.appendChild(cards);
      div.appendChild(avatar);
      div.appendChild(info);
      area.appendChild(div);
    }
  },

  // ===== B4: Double-Tap State =====
  _lastTapCardId: null,
  _lastTapTime: 0,

  // ===== B6: Turn Flash Overlay =====
  showTurnFlash(text, type) {
    const el = this.els.turnFlash;
    if (!el) return;

    // Reset animation
    el.className = 'turn-flash-overlay';
    el.textContent = text;
    el.offsetHeight; // Force reflow

    el.classList.add(type === 'attack' ? 'flash-attack' : 'flash-your-turn');

    // Clean up after animation
    setTimeout(() => {
      el.className = 'turn-flash-overlay';
      el.textContent = '';
    }, 1500);
  },

  // ===== B7: Haptic Feedback =====
  haptic(pattern) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) { /* ignore */ }
    }
  },

  // ===== Custom Animation Visual Effects =====

  triggerNopeGlitchEffect(playerName) {
    // Create glitched shield overlay
    const overlay = document.createElement('div');
    overlay.className = 'nope-glitch-overlay';
    overlay.innerHTML = `
      <div class="nope-glitch-content">
        <div class="nope-glitch-shield">🚫</div>
        <div class="nope-glitch-title">NOPE!</div>
        <div class="nope-glitch-subtitle">${playerName} đã Phản Đối!</div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Shake the whole app screen container
    const app = this.els.app || document.getElementById('app');
    if (app) {
      app.classList.add('screen-shake-intense');
      setTimeout(() => app.classList.remove('screen-shake-intense'), 600);
    }

    // Heavy glitch vibration pattern
    this.haptic([80, 50, 80, 50, 150]);

    // Fade out and remove
    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 400);
    }, 1200);
  },

  triggerDefuseSavedEffect(playerName) {
    const overlay = document.createElement('div');
    overlay.className = 'defuse-saved-overlay';
    overlay.innerHTML = `
      <div class="defuse-saved-content">
        <div class="defuse-saved-shield">🔧</div>
        <div class="defuse-saved-title">SAVED!</div>
        <div class="defuse-saved-subtitle">${playerName} đã Tháo Ngòi thành công!</div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Dynamic positive vibration
    this.haptic([100, 30, 200]);

    // Fade out and remove
    setTimeout(() => {
      overlay.classList.add('fade-out');
      setTimeout(() => overlay.remove(), 400);
    }, 1500);
  },

  animateFavorFlight(fromPlayer, toPlayer, callback) {
    const fromEl = fromPlayer.isHuman ? this.els.playerInfo : document.querySelector(`.opponent[data-player-index="${fromPlayer.index}"]`);
    const toEl = toPlayer.isHuman ? this.els.playerInfo : document.querySelector(`.opponent[data-player-index="${toPlayer.index}"]`);
    
    if (!fromEl || !toEl) {
      if (callback) callback();
      return;
    }

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    const startX = fromRect.left + fromRect.width / 2;
    const startY = fromRect.top + fromRect.height / 2;
    const destX = toRect.left + toRect.width / 2;
    const destY = toRect.top + toRect.height / 2;

    const plane = document.createElement('div');
    plane.className = 'floating-favor-plane';
    plane.textContent = '✈️';
    plane.style.left = `${startX}px`;
    plane.style.top = `${startY}px`;
    document.body.appendChild(plane);

    plane.offsetHeight; // Force reflow
    plane.style.transition = 'all 0.8s cubic-bezier(0.25, 1, 0.4, 1)';
    
    requestAnimationFrame(() => {
      plane.style.left = `${destX}px`;
      plane.style.top = `${destY}px`;
      plane.style.transform = `scale(1.5) rotate(${Math.atan2(destY - startY, destX - startX) * 180 / Math.PI}deg)`;
      plane.style.opacity = '1';
    });

    setTimeout(() => {
      this.haptic(25);
      plane.style.transition = 'opacity 0.2s ease';
      plane.style.opacity = '0';
      setTimeout(() => {
        plane.remove();
        if (callback) callback();
      }, 200);
    }, 800);
  },

  animateSeeFutureMystic() {
    const deck = this.els.deckArea;
    if (!deck) return;

    const rect = deck.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Spawn magical purple/blue sparkles
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'mystic-spark';
      p.style.backgroundColor = i % 2 === 0 ? '#7c3aed' : '#00d4ff';
      p.style.left = `${centerX}px`;
      p.style.top = `${centerY}px`;

      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 45;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;

      p.style.setProperty('--tx', `${tx}px`);
      p.style.setProperty('--ty', `${ty}px`);
      p.style.animation = 'mysticSpark 1.2s cubic-bezier(0.1, 0.8, 0.3, 1) forwards';
      p.style.animationDelay = `${Math.random() * 0.35}s`;

      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }
  },

  playDiscardImpact(card) {
    const discardPile = this.els.discardArea;
    if (!discardPile) return;

    // Trigger squash and stretch animation
    discardPile.classList.add('discard-impact-bounce');
    setTimeout(() => discardPile.classList.remove('discard-impact-bounce'), 450);

    // Gently vibrate screen
    this.haptic(15);

    // Setup spark colors based on card's design gradient
    const colors = card?.gradient || ['#00d4ff', '#7c3aed'];
    const rect = discardPile.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Spawn 15 colorful sparks fanning outward
    for (let i = 0; i < 15; i++) {
      const p = document.createElement('div');
      p.className = 'play-spark';
      p.style.color = colors[Math.floor(Math.random() * colors.length)];
      p.style.left = `${centerX}px`;
      p.style.top = `${centerY}px`;

      const angle = Math.random() * Math.PI * 2;
      const distance = 40 + Math.random() * 70;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;

      p.style.setProperty('--tx', `${tx}px`);
      p.style.setProperty('--ty', `${ty}px`);
      p.style.animation = 'sparkOut 0.60s cubic-bezier(0.1, 0.8, 0.3, 1) forwards';

      document.body.appendChild(p);
      setTimeout(() => p.remove(), 600);
    }
  },

  setupFullscreen() {
    const btn = this.els.fullscreenBtn || document.getElementById('fullscreen-btn');
    if (!btn) return;

    const updateIcon = () => {
      const isFS = !!document.fullscreenElement;
      btn.textContent = isFS ? '✕' : '⛶';
      btn.title = isFS ? 'Thoát toàn màn hình' : 'Toàn màn hình';

      // Auto orientation lock to landscape when entering fullscreen
      if (isFS) {
        if (screen.orientation && typeof screen.orientation.lock === 'function') {
          try {
            screen.orientation.lock('landscape').catch(err => {
              console.log('[Fullscreen] Orientation lock not supported or rejected:', err);
            });
          } catch (e) {
            console.warn('[Fullscreen] Orientation lock error caught:', e);
          }
        }
      } else {
        // Unlock orientation on exiting fullscreen
        if (screen.orientation && typeof screen.orientation.unlock === 'function') {
          try {
            screen.orientation.unlock();
          } catch (e) {
            console.warn('[Fullscreen] Orientation unlock error caught:', e);
          }
        }
      }
    };

    btn.onclick = () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };

    document.addEventListener('fullscreenchange', updateIcon);
    updateIcon();
  }
};
