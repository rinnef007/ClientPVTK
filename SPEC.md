# SPEC — Phong Vân Truyền Kỳ 2: Web Client (bản học tập)

> Trạng thái: **Draft v0.1** · Ngày: 2026-10-21
> Nguồn phân tích: bản decompile APK `vn.cmn.bokinhvan` (jadx + apktool) và 2 gói ảnh `assets/` do người dùng cung cấp.

## 0. Bối cảnh & ràng buộc pháp lý

- Game gốc là sản phẩm thương mại của bên thứ ba (CMN). Người dùng xác nhận mục đích **học tập / offline**,
  **không có quyền** với server chính thức.
- Vì vậy:
  - Client web **không** trỏ tới server chính thức; mặc định chỉ kết nối `ws://localhost` (mock server trong repo
    hoặc server riêng của người dùng qua proxy WebSocket→TCP).
  - **Không commit** ảnh gốc, code decompile hay IP server gốc vào repo. Ảnh được nạp cục bộ bằng
    `npm run import-assets` (thư mục `public/assets/` nằm trong `.gitignore`).
  - Không port SDK đăng nhập / thanh toán / quảng cáo / tracking (CMN SDK, Facebook, Adjust, OneSignal, Billing).

## 1. Mục tiêu

| # | Mục tiêu | Đo bằng |
|---|----------|---------|
| G1 | Chạy được client trong trình duyệt hiện đại (Chrome/Edge/Firefox/Safari bản mới), không plugin | `npm run dev` mở được, không lỗi console |
| G2 | Port đúng giao thức mạng gốc (đóng gói khung tin + kiểu dữ liệu) | Unit test round‑trip khớp byte‑for‑byte với cách Java `Message` mã hoá |
| G3 | Lớp tương thích MIDP (`Graphics`, `Image`, phím, chạm) trên HTML5 Canvas để port dần logic game | Test anchor/clip; màn demo vẽ đúng |
| G4 | Port dần các hệ thống game (bản đồ, nhân vật, UI, chiến đấu…) theo lộ trình ở §6 | Tiêu chí nghiệm thu từng giai đoạn |

### Ngoài phạm vi (non‑goals)
- Kết nối server chính thức, đăng nhập tài khoản CMN, nạp tiền, quảng cáo, push notification.
- Chống cheat / bảo mật phía server.
- Viết lại server game đầy đủ (chỉ có **mock server** tối thiểu để test client).

## 2. Kết quả phân tích bản gốc (đã xác minh từ code decompile)

### 2.1 Kiến trúc gốc
- APK là game **J2ME (MIDlet)** chạy trên lớp giả lập `javax.microedition.*` cho Android.
- Entry: `com.hz.GameMIDlet` → `GameCanvas` (một `Runnable`, vòng lặp vẽ/tick riêng).
- Logic chính nằm trong `com.hz.*` (~219 file). Các file lớn nhất:
  `ui/UIHandler` (~934 KB), `ui/UIAction`, `main/MsgHandler`, `main/GameWorld`, `main/GameText`,
  `core/*` (Item, Skill, Mission, Country…), `actor/*`, `battle/*`, `map/*`, `sprite/*`, `gui/*`.
- Màn hình logic: ảnh logo có kích thước **320×480**, nên mình *ước đoán* độ phân giải gốc là 320×480 dọc
  và Android phóng to bằng `ZoomHandler`. Điều này **chưa được xác nhận** từ code `AndroidZoom`.

### 2.2 Giao thức mạng (xác minh từ `net/Message`, `net/Input`, `net/OutPut`)
- Vận chuyển: TCP socket thuần (`socket://<ip>:30000`), có fallback HTTP (`:8079`, `HttpConnector`).
- Khung tin (big‑endian):

  ```
  +--------+--------+-------------------+
  | u16 len| i16 type| payload (len-4 B) |
  +--------+--------+-------------------+
  len = tổng độ dài khung, tính cả 4 byte header. len == 0xFFFF (-1) → bỏ qua.
  ```
- Kiểu dữ liệu trong payload:
  - `byte`/`boolean` 1B; `short`/`char` 2B; `int` 4B; `long` 8B (big‑endian)
  - `length` = **u24** (3 byte)
  - `String` = `length(u24)` + N × `char` (**UTF‑16BE**, mỗi ký tự 2 byte)
  - `bytes` = `length(u24)` + N byte
- Gói gửi tối đa 32767 byte; buffer mặc định 1024 byte.
- Heartbeat: type **16001**, payload `short mapId`, gửi mỗi **15 s**.
- `ProtocolDefine` có ~589 hằng số `short` (CG_* client→server, GC_* server→client). Repo sinh lại tự động
  file `src/net/ProtocolDefine.ts` từ Java (chỉ là bảng số hiệu, không chứa logic).
- GZIP: có lớp `GZIP.inflate`, nhưng danh sách `zipMsgType` trong `Input` đang **rỗng**, tức là
  không có loại tin nào bị nén ở tầng khung tin.

### 2.3 Tài nguyên
- Code nạp tài nguyên từ `assets/` với các đuôi: `.png`, `.fr` (fragment), `.spr` (sprite), `.m` (map),
  `.ui`, `.pd`/`.pn` (page data/name), `.mss`/`.txt` (nhiệm vụ), `.t` (font), `.n` (event), `.pl`.
- Người dùng đã gửi thêm `assets.rar` (toàn bộ `assets/` của APK, 8.662 file). Thống kê sau khi giải nén:

  | Thư mục | Nội dung |
  |---------|----------|
  | `ani/ani2/` | 2.966 `.spr`, 1.816 `.pl`, 1.439 `.fr`, 1.444 `.png` (nhân vật, quái, hiệu ứng) |
  | `ani/` | 81 `.pd` + `3.pn` (gói ảnh nén), 44 `.png` |
  | `ui/` | 165 `.ui` (layout giao diện) |
  | `common/` | 331 `.png`, 176 `.fr`, 5 font bitmap `.t` (12/14/16/18/20) |
  | `map/` | `1.pd` + `1.pn`: gói ảnh tile bản đồ |
  | gốc | `jad.properties` (MIDlet `com.hz.GameMIDlet`, "WorldOL", v1.4), `p.ini` (chuỗi nạp tiền), `demo.html` |

- Định dạng (đọc từ `ResourceHandler`, `ImageSet`, `Utilities`):
  - `.pn` = danh sách ID ảnh; `.pd` = các ảnh PNG đóng gói tương ứng (`formBytesPackData`).
  - `.pl` = bảng màu; `loadColorImage` tìm chunk `PLTE` trong PNG và thay bằng bảng màu này. Đây là cách game
    tạo nhiều biến thể màu từ một sprite.
  - `.fr` = toạ độ/kích thước từng khung trong ảnh (`ImageSet.fromBytes`).
- **Không có file `.m` (bố cục bản đồ) trong APK.** `GameMap.loadMap` được gọi trong `MsgHandler` khi nhận dữ liệu
  **từ server**. Vì vậy, khi chạy offline, bố cục bản đồ phải tự dựng (ghép tile thủ công hoặc sinh bằng script);
  ảnh tile thì có sẵn trong `map/1.pd`.
- `classes*.dex` do người dùng gửi: `classes2.dex` chứa package `com/hz` (code game). Đây là bản biên dịch của code đã
  decompile; mình *chưa* đối chiếu từng byte để chắc là cùng một build.

## 3. Kiến trúc web

```
Browser ─────────────────────────────────────────────┐
  index.html  →  src/main.ts                          │
    ├─ engine/   GameLoop (rAF, tick cố định 50ms)    │
    ├─ midp/     Graphics, ImageStore, Input (shim)   │   ws://  (binary frames)
    ├─ net/      Message, FrameDecoder, SocketClient ─┼──────────────┐
    ├─ scenes/   Splash, Menu, AssetViewer, NetTest   │              │
    └─ game/     (port dần từ com.hz.* — giai đoạn 3+)│              ▼
──────────────────────────────────────────────────────┘   server/mock-server.mjs (Node, ws)
                                                           hoặc websockify → TCP server riêng
```

Quyết định kỹ thuật:
- **TypeScript + HTML5 Canvas 2D**, build bằng **Vite**, test bằng **Vitest**.
- Port gần 1:1 API MIDP để code Java dịch sang TS mà ít phải sửa logic (`g.drawImage(img,x,y,anchor)`…).
- Canvas logic 320×480, scale nguyên/lẻ theo cửa sổ, `imageSmoothingEnabled = false` để giữ nét pixel.
- Mạng: WebSocket nhị phân; **một WS message có thể chứa 0..n khung tin hoặc một phần khung tin**.
  `FrameDecoder` gom stream và tách khung giống `Input.run()`, nên client dùng được cả proxy kiểu
  websockify (stream TCP thô) lẫn mock server.
- Phím: bàn phím PC → mã phím J2ME (`2/4/6/8/5`, soft key `-6/-7`, `*`, `#`); chạm/chuột → toạ độ logic
  được đóng gói như gốc: `x | (y << 15)`.

## 4. Cấu trúc thư mục

```
SPEC.md              – tài liệu này
README.md            – hướng dẫn chạy
index.html
src/
  main.ts
  engine/GameLoop.ts
  midp/{Graphics,ImageStore,Input,anchor}.ts
  net/{Message,FrameDecoder,SocketClient,ProtocolDefine}.ts
  scenes/*.ts
server/mock-server.mjs
scripts/{import-assets,gen-protocol}.mjs
tests/*.test.ts
public/assets/       – (gitignored) ảnh nạp bằng import-assets
```

## 5. Hợp đồng module (giai đoạn 1)

- `Message` – API trùng tên với Java: `putByte/putBoolean/putShort/putChar/putInt/putLong/putLength/putString/putBytes`
  và `get*` tương ứng; `toFrame(): Uint8Array`; `Message.fromFrame(type, payload)`.
  `long` dùng `bigint`.
- `FrameDecoder.push(chunk): Message[]` – nhận bytes tuỳ ý, trả các khung hoàn chỉnh.
- `SocketClient` – `connect(url)`, `send(msg)`, `onMessage`, `onState`, tự gửi heartbeat 15 s.
- `Graphics` – `setColor(rgb)`, `fillRect`, `drawRect`, `drawLine`, `fillRoundRect`, `drawString(s,x,y,anchor)`,
  `drawImage(img,x,y,anchor)`, `drawRegion(img,sx,sy,w,h,transform,x,y,anchor)`, `setClip/clipRect`, `translate`.
  Anchor theo hằng MIDP: `HCENTER=1, VCENTER=2, LEFT=4, RIGHT=8, TOP=16, BOTTOM=32, BASELINE=64`.
- `ImageStore` – nạp ảnh lười theo đường dẫn `assets/...`, cache, trả `null` khi chưa sẵn sàng (giống MIDP không chặn).

## 6. Lộ trình & tiêu chí nghiệm thu

| Giai đoạn | Nội dung | Nghiệm thu | Trạng thái |
|-----------|----------|------------|------------|
| **P1 – Nền tảng** | Vite/TS, shim MIDP, Message/FrameDecoder/SocketClient, mock server, import ảnh, các màn Splash, Menu, Asset Viewer, Net Test | `npm test` pass; `npm run dev` + `npm run mock` → Net Test kết nối, gửi/nhận heartbeat; Asset Viewer duyệt được ảnh | ✅ làm trong commit này |
| P2 – Luồng đăng nhập offline | Port `ServerInfo`, màn chọn server/nhân vật (`CG_LOGIN_*`), mock trả danh sách nhân vật giả | Tạo/chọn nhân vật giả và vào được "world" trống | ⏳ |
| **P3 – Sprite & bản đồ** | Port `.pd/.pn`, `.pl`, `.fr`, `.spr`, `sprite/*`, `map/*` | Xem được animation nhân vật đúng màu; vẽ được 1 bản đồ dựng tay + nhân vật đi lại | ✅ (xem §9) |
| P4 – UI hệ thống | Port `.ui`, font `.t`, `gui/*`, `ui/UIObject`, một phần `UIHandler` (túi đồ, chat, nhiệm vụ) | Mở được túi đồ, chat với dữ liệu mock | ⏳ đã có dữ liệu |
| P5 – Chiến đấu | `battle/*` theo lượt | Chơi một trận với quái mock | ⏳ |
| P6 – Hoàn thiện | Âm thanh, lưu cài đặt (`localStorage` thay RMS), mobile touch, PWA | Lighthouse PWA, chơi được trên điện thoại | ⏳ |

Ước lượng thô (*chỉ là ước đoán*): khoảng 30.000 dòng Java cần port. Giai đoạn 3–5 là phần nặng nhất,
mỗi giai đoạn có thể cần nhiều phiên làm việc.

## 7. Kiểm thử
- Unit (Vitest): Message round‑trip mọi kiểu, chuỗi tiếng Việt UTF‑16, khung bị chia nhỏ/dính liền,
  khung `0xFFFF`, anchor → toạ độ.
- Tích hợp: script Node mở WS tới mock server, gửi heartbeat, nhận ACK.
- Thủ công: chạy dev server, kiểm tra các màn.

## 8. Rủi ro & câu hỏi mở
1. ~~Thiếu file dữ liệu nhị phân~~. Đã có từ `assets.rar`. Riêng **bố cục bản đồ (`.m`) do server gửi**, không có
   trong APK, nên khi chạy offline phải tự dựng map.
2. **Không có server**. Mock server chỉ trả lời vài loại tin. Hành vi thật của server phải suy ra từ
   `MsgHandler` (bên nhận), nên có thể sai ở nhiều chỗ.
3. Code jadx có đoạn decompile lỗi (ví dụ vòng lặp `while(true)` trong `Input.run`). Khi port phải đọc theo ý đồ,
   không chép máy móc.
4. Bản quyền ảnh/âm thanh: chỉ dùng cục bộ cho học tập; không đưa lên repo công khai hay host public.
5. Độ phân giải gốc 320×480 là suy luận từ kích thước logo, cần xác minh thêm ở `AndroidZoom`/`PipActivity`.

## 9. Giai đoạn 3: sprite & bản đồ (đã làm)

### 9.1 Code đã port (thư mục `src/game/`, giữ tên lớp/hàm như Java)
| Java | TypeScript | Ghi chú |
|------|------------|---------|
| `common/Tool` (một phần) | `common/Tool.ts` | `byte2short`, `setKeyXY`, `binarySearch`, `getOffsetValue`… |
| `common/Utilities` (một phần) | `common/Utilities.ts` | `getTranslate`, `getTransfromAfterMirror`, `loadColorImage`, `parsePalette`, `applyPalette`, `drawGameRegion` |
| `main/ResourceHandler` | `main/ResourceHandler.ts` | Đủ bảng tra gói (`getAni*PakIDByIndex`), `getAniData`, gói map/fr |
| `image/GameImage` | `image/GameImage.ts` | |
| `sprite/FragmentFile`, `Frame`, `Animation` | cùng tên | Port đủ |
| `sprite/GameSprite` | `sprite/GameSprite.ts` | Nạp, animation, vẽ, cờ trạng thái. **Chưa**: ghép trang bị (`createSpriteByIcon`, `doChangeSpriteIcon`), VIP/QQ, sprite nhà 2 người |
| `map/GameMap` | `map/GameMap.ts` | Đọc map, va chạm, camera, bộ đệm cuộn vòng (`initMapBuffer`, `updateMapBuffer`, `fillCol/Row`, `drawMapBuffer`). **Chưa**: tìm đường, bản đồ nhỏ, escort, mũi tên chỉ đường |
| `map/TileLayer`, `PixelLayer`, `PlayerLayer` | cùng tên | `PlayerLayer` vẽ nhân vật qua interface `MapModel` vì `Player/NPC/Model` chưa port |

### 9.2 Chỗ khác bản gốc (có chủ đích)
1. **Tải tài nguyên**: Java đọc file đồng bộ. Trên web, `AssetFS` tải trước (`preloadSprite`, `initGameResources`) rồi trả dữ liệu đồng bộ cho code đã port.
2. **Giải mã ảnh**: bất đồng bộ (`Image.ready`). Kích thước ảnh lấy ngay từ header PNG, nên code tính bố cục vẫn chạy đồng bộ.
3. **Bảng màu `.pl`**: chép đè giống Java, rồi *tính lại CRC* chunk `PLTE` (có 3/400 file `.pl` mẫu bị ngắn hơn chunk, trình duyệt sẽ từ chối PNG lỗi CRC).
4. **`getSpriteByName/getFragmentByName`**: Java dò trong danh sách model đang sống. Web dùng một registry chung, kết quả tương đương (dùng lại thay vì nạp lại).
5. **Đoạn decompile lỗi** (`createFragmentFile`, `drawGameImage` 5 tham số, `PixelLayer.drawColObject/drawRowObject`): viết lại theo ý đồ đọc được từ code, có chú thích tại chỗ.
6. `fillCol/fillRow` xoá cột/hàng về đen trước khi vẽ lại. Bản gốc dựa vào tile nền phủ kín; với tile nền đục thì kết quả như nhau.
7. **Bản đồ thử** (`map/TestMap.ts`): do bố cục map đến từ server, file này *tự sinh* byte theo đúng định dạng `GameMap.fromBytes`, dùng ảnh trong `map/1.pd`.
8. **Nhân vật đi lại** (`MapScene.WalkingPlayer`): bản đơn giản (4 px/tick, chặn theo ô va chạm). Lớp `Player` gốc (đi theo đường tìm được và xác nhận với server) chưa port.

### 9.3 Đã kiểm chứng
- 2.966/2.966 file `.spr` đọc khớp từng byte (script Python độc lập).
- 2.964/2.966 sprite nạp đủ mảnh và ảnh qua code TS. Sprite 1132, 1133 tham chiếu mảnh không có trong APK.
- Chạy trên Chromium: so sánh ảnh sau 8 đoạn đường đi (cuộn từng phần) với ảnh vẽ lại toàn bộ (`TAG_FORCE_PAINT`) thì nền bản đồ khớp từng pixel. Chỗ khác chỉ nằm ở các sprite đang chạy animation.
