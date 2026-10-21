# PVTK Web Client (bản học tập)

Port client J2ME/Android của **Phong Vân Truyền Kỳ 2** sang web (TypeScript + HTML5 Canvas).
Dự án phục vụ học tập / chạy offline. Client **không** kết nối server chính thức, chỉ kết nối mock
server trong repo hoặc server riêng của bạn.

Đặc tả, kết quả phân tích bản gốc và lộ trình xem ở **[SPEC.md](SPEC.md)**.

## Yêu cầu
- Node.js ≥ 18 (đã thử trên Node 22)

## Chạy nhanh

```bash
npm install

# 1) Nạp ảnh gốc vào public/assets (không commit, đã có trong .gitignore)
#    Truyền thư mục đã giải nén images_part1.zip / images_part2.zip, hoặc APK đã unzip.
npm run import-assets -- ../images_part1 ../images_part2

# 2) Mock server (WebSocket, cổng 8080)
npm run mock

# 3) Client (http://localhost:5173)
npm run dev
```

Đổi địa chỉ server: `http://localhost:5173/?ws=ws://host:port`

### Nối vào server TCP riêng
Trình duyệt không mở được TCP socket trực tiếp, nên cần đặt một proxy WebSocket→TCP trước server, ví dụ:

```bash
websockify 8080 127.0.0.1:30000
```

`FrameDecoder` tự ghép lại stream, nên dùng được với proxy kiểu này.

## Điều khiển
| Phím | Tương ứng J2ME |
|------|----------------|
| ↑ ↓ ← → / WASD | 2 / 8 / 4 / 6 |
| Enter / Space | 5 (Fire) |
| Q | Soft trái (-6) |
| Esc / E / Backspace | Soft phải (-7) |
| 0–9 | Phím số |

Có thể chạm hoặc bấm chuột; bấm vào thanh dưới cùng để dùng soft key.

## Lệnh
| Lệnh | Việc |
|------|------|
| `npm test` | Unit test (Vitest) |
| `npm run typecheck` | Kiểm tra kiểu TS |
| `npm run build` | Build production vào `dist/` |
| `npm run gen-protocol -- <ProtocolDefine.java>` | Sinh lại `src/net/ProtocolDefine.ts` |

## Trạng thái
- Giai đoạn 1: lớp tương thích MIDP, giao thức mạng, mock server, xem tài nguyên.
- Giai đoạn 3: port sprite/animation (`GameSprite`, `Frame`, `Animation`, `FragmentFile`) và bản đồ
  (`GameMap` + các layer) từ Java; màn **Xem sprite** và **Bản đồ thử** (xem SPEC §9).
- Ghép trang bị (`createSpriteByIcon`/`doChangeSpriteIcon`) và màn **Thay trang phục** (SPEC §10).
- Di chuyển gốc: `Model`/`Control`/`WorldPanel`, tìm đường A* và BFS, NPC đi lang thang (SPEC §11).
- Giao diện (P4, đang làm): đọc 165 file `.ui`, layout, khung/nút/thanh HP, font `.t`; màn **Xem giao diện (.ui)** (SPEC §12).

Dữ liệu cần nạp là toàn bộ thư mục `assets/` của APK (`assets.rar`):
`npm run import-assets -- <thư mục giải nén rar>`. Bố cục bản đồ do server gửi nên không có trong
APK; bản đồ thử được tự sinh (`src/game/map/TestMap.ts`).

### Phím trong các màn mới
| Màn | Phím |
|-----|------|
| Xem giao diện (.ui) | ←/→ đổi giao diện, Enter ẩn/hiện chú thích (chỉ hiển thị, chưa tương tác) |
| Thay trang phục | ↑/↓ chọn bộ phận, ←/→ đổi kiểu/màu, Enter đi/đứng, Q lật. Bản đồ thử dùng bộ đồ này |
| Xem sprite | ←/→ đổi sprite, 1/3 nhảy ±10, ↑/↓ đổi animation, Enter lật trái/phải, Q zoom |
| Bản đồ thử | Có HUD của game (ui/211, số liệu giả) và bản đồ nhỏ. Giữ mũi tên để đi (trượt dọc tường), click/chạm để tìm đường, chạm nút HUD để xem mã sự kiện, - bật/tắt HUD, Enter hiện lưới va chạm, Q bật/tắt ảnh bản đồ, = vẽ lại toàn bộ |
