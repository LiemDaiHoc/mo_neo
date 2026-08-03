# [AUDIT] Kiểm Toán Ban Đầu — Mèo Nổ Online

**Tác giả:** Antigravity | Claude Sonnet 4.6 (Thinking) | Chat: 8a9c97aa  
**Ngày:** 2026-08-01  
**Phạm vi:** Toàn bộ dự án (tiếp quản lần đầu)

---

## 1. Tổng quan dự án

**Tên game:** Mèo Nổ Online (Exploding Kittens)  
**Stack:** Node.js + Express + Socket.io (backend), Vanilla HTML/CSS/JS (frontend)  
**Cấu trúc:**
```
mo_neo/
├── server.js              # Entry point, Socket.io event routing
├── server/
│   ├── RoomManager.js     # Quản lý phòng, kết nối lại, host migration
│   └── ServerGame.js      # Game engine phía server (1451 dòng)
└── public/
    ├── index.html         # UI markup (313 dòng)
    ├── css/style.css      # Styling (95KB)
    └── js/
        ├── cards.js       # Định nghĩa bài phía client
        ├── sounds.js      # Âm thanh
        ├── player.js      # AI Bot logic
        ├── network.js     # Socket.io client
        ├── ui.js          # DOM rendering + interactions (2743 dòng)
        └── game.js        # Client game engine (982 dòng)
```

---

## 2. Tính năng đã hoàn thiện

- [x] Menu chính với lựa chọn Offline / Online
- [x] Chế độ Offline: đấu với Bot AI (2-5 người)
- [x] Chế độ Online: tạo phòng, vào phòng, sẵn sàng, bắt đầu game
- [x] Hệ thống phòng: mã phòng tùy chọn (2-6 ký tự), chủ phòng tự động chọn
- [x] Host Migration: khi chủ phòng rời đi, quyền chủ được chuyển tự động
- [x] Grace Period: khi mất kết nối, chờ 60 giây để kết nối lại
- [x] Bộ bài đầy đủ: Skip, Attack, See Future, Shuffle, Nope, Favor, Cat pairs, 5-card combo
- [x] Cơ chế Nope với timer đếm ngược
- [x] Cơ chế Defuse: đặt Mèo Nổ trở lại vị trí tùy chọn
- [x] Cơ chế Favor: yêu cầu người khác cho bài
- [x] Combo Cat (2 lá giống): ăn cắp ngẫu nhiên từ người khác
- [x] Combo 5 lá khác nhau: chọn bài từ discard pile
- [x] Toggle tự động từ chối Nope
- [x] Toàn màn hình, âm thanh bật/tắt
- [x] Responsive cho mobile

---

## 3. Kiểm toán kỹ thuật

### 3.1 Server — RoomManager.js
- **Điểm mạnh:** Cấu trúc rõ ràng, handle reconnect tốt, host migration logic hợp lý
- **Lưu ý:** Hàm `leaveRoom` ở dòng 395 gọi với fake socket object `{id: socket.id, leave: () => {}}` — có thể gây bug nếu `leaveRoom` cố gọi `socket.leave()` trong các trường hợp khác

### 3.2 Server — ServerGame.js (1451 dòng)
- **File lớn** nhưng cấu trúc phân vùng tốt với comment phân tách
- Xử lý `broadcastState()` — cá nhân hóa trạng thái cho từng người chơi: tốt (bảo mật, không lộ bài người khác)
- Có `pendingAction` state machine cho Nope/Favor/Defuse/DiscardPicker

### 3.3 Client — ui.js (2743 dòng)
- File **rất lớn** — là điểm nguy cơ cho bảo trì
- Tích hợp cả offline và online UI trong cùng một module

### 3.4 Client — network.js
- Xử lý tất cả Socket.io events, clean reconnect logic

---

## 4. Vấn đề tiềm ẩn cần theo dõi

### [ISSUE-001] Fake socket object trong reconnect timeout
- **Vị trí:** `RoomManager.js`, dòng 395
- **Mô tả:** `this.leaveRoom({ id: socket.id, leave: () => {} })` dùng object giả, không có đầy đủ method của socket thật
- **Rủi ro:** Thấp — chỉ ảnh hưởng nếu `leaveRoom` gọi thêm method socket nào khác trong tương lai
- **Khuyến nghị:** Refactor để tách phần xử lý room khỏi socket object

### [ISSUE-002] `nextCardId` là biến global module-level
- **Vị trí:** `ServerGame.js`, dòng 44
- **Mô tả:** `let nextCardId = 1;` — counter này không reset giữa các game instance, tiếp tục tăng
- **Rủi ro:** Rất thấp — chỉ là ID string, không có va chạm thực tế trong lifetime server

### [ISSUE-003] File ui.js quá lớn (2743 dòng)
- **Rủi ro:** Khó bảo trì, khó debug, dễ conflict khi nhiều người chỉnh sửa
- **Khuyến nghị:** Tách thành các module nhỏ hơn (lobby-ui, game-ui, modal-ui...)

---

## 5. Kết luận

Dự án ở trạng thái **hoàn thiện cơ bản**, tất cả tính năng cốt lõi đã được triển khai. Code chất lượng tốt, có comment rõ ràng bằng tiếng Việt. Sẵn sàng để tiếp tục phát triển tính năng mới hoặc sửa lỗi theo yêu cầu người dùng.

**Điểm số tổng quan:** 7.5/10 — Cần refactor ui.js và tối ưu một số edge case.
