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
| P4 – UI hệ thống | Port `.ui`, font `.t`, `gui/*`, `ui/UIObject`, một phần `UIHandler` (túi đồ, chat, nhiệm vụ) | Mở được túi đồ, chat với dữ liệu mock | 🔄 đang làm (xem §12) |
| P5 – Chiến đấu | `battle/*` theo lượt | Chơi một trận với quái mock | 🔄 trận đánh bản địa với BE chạy được (xem §11.3 online) |
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
| `sprite/GameSprite` | `sprite/GameSprite.ts` + `sprite/SpriteIcon.ts` | Nạp, animation, vẽ, cờ trạng thái; ghép trang bị (§10). **Chưa**: VIP/QQ, chế độ sprite giản lược (`createMiniSpriteByIcon`) |
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
8. ~~Nhân vật đi lại bản đơn giản~~: đã thay bằng code di chuyển gốc (xem §11).

### 9.3 Đã kiểm chứng
- 2.966/2.966 file `.spr` đọc khớp từng byte (script Python độc lập).
- 2.964/2.966 sprite nạp đủ mảnh và ảnh qua code TS. Sprite 1132, 1133 tham chiếu mảnh không có trong APK.
- Chạy trên Chromium: so sánh ảnh sau 8 đoạn đường đi (cuộn từng phần) với ảnh vẽ lại toàn bộ (`TAG_FORCE_PAINT`) thì nền bản đồ khớp từng pixel. Chỗ khác chỉ nằm ở các sprite đang chạy animation.

## 10. Ghép trang bị (`createSpriteByIcon` / `doChangeSpriteIcon`)

### 10.1 Nguồn để dịch
- jadx đánh dấu `doChangeSpriteIcon` là *"decompiled incorrectly"*. Ngoài ra jadx còn **sai** ở
  `getHorseSpriteNameIDByWeapon`: với vũ khí loại 17 và 24, bytecode trả về sprite thú cưỡi thường
  (700/900 + n), nhưng jadx lại ra `base + 15` và `base + 24`.
- Để có nguồn đáng tin hơn, mình chuyển `classes2.dex` sang jar (dex2jar 2.4.38) rồi decompile bằng
  **Vineflower 1.10.1**. Sau đó dùng androguard disassemble bytecode Dalvik để đối chiếu từng nhánh
  khác nhau. Bản port bám theo Vineflower, vì ở mọi điểm đã đối chiếu thì Vineflower khớp với bytecode.
- Các công cụ trên chỉ chạy trong thư mục tạm, không đưa vào repo.

### 10.2 Cách game mã hoá ngoại hình
- Mỗi nhân vật có 3 số `long` (icon1..3) do server gửi. Bố cục bit ghi ở đầu `SpriteIcon.ts`.
- Mỗi mảnh ghép thuộc một bộ phận, xác định bằng `nameID / 1000`: 0 tóc, 1 mặt, 2 tay, 3 chân, 4 vai,
  5 lưng, 6 áo, 7 quần, 8/9 vũ khí, 10 mũ, 12 màu pet, 14 màu thú cưỡi, 15 hào quang vũ khí, 16 thân
  giản lược.
- ID ảnh = `(kiểu << 3) + gốc − 7 + (giới tính << 2) + màu`, nghĩa là mỗi kiểu chiếm 8 ô (2 giới × 4 màu).
  Màu 1..3 dùng lại PNG của màu 0, kèm bảng màu `.pl` riêng.
- Sprite gốc được chọn theo vũ khí (`getSpriteNameIDByWeapon`) và thú cưỡi
  (`getHorseSpriteNameIDByWeapon`). Áo choàng là sprite riêng `1100 + kiểu`, gắn vào vị trí mảnh lưng.

### 10.3 Phần thêm cho web
- `encodeIcons()`: làm ngược quá trình giải mã. Trong game thật việc này do server làm; ở đây dùng cho
  màn **Thay trang phục**.
- `AssetFS.resolve()`: chạy lại code nạp cho tới khi không còn file nào bị thiếu, vì danh sách mảnh
  trang bị cần dùng chỉ biết được khi đang chạy. Giữa các lần chạy, cache sprite bị xoá để không giữ lại
  ảnh dựng khi thiếu bảng màu.
- Mảnh ghép lấy từ cache luôn là **bản sao** (`cloneFragmentFile`) như Java, nên `clearImage()` trên
  một nhân vật không ảnh hưởng nhân vật khác.

### 10.4 Đã kiểm chứng
- Test với các giá trị lấy từ bytecode: `getSpriteNameIDByWeapon`, `getHorseSpriteNameIDByWeapon`
  (gồm trường hợp 17/24), `getWeaponIcon`.
- Test trên dữ liệu thật: nhân vật nam/nữ mặc định, đổi kiểu và màu tóc (ảnh dùng bảng màu), cầm vũ khí
  (sprite 113 + mảnh 8001), ẩn bộ phận khi kiểu bằng 0.
- Các ID sprite vũ khí có trong APK (113–124, 134, 136, 137, 144, 163, 165, 171–174) đúng bằng những
  giá trị công thức sinh ra, và APK không có `sprite_117`.
- Chạy trên Chromium: tóc, áo, mũ, vũ khí, áo choàng, nhân vật nữ, thú cưỡi 701/703/706, và cưỡi thú kèm
  vũ khí (sprite 2513) đều hiển thị. Nhân vật trên bản đồ thử mặc đúng bộ đồ đã chọn.

## 11. Di chuyển (Model / Control / WorldPanel / tìm đường)

### 11.1 Đã port (Vineflower decompile của `classes2.dex`)
| Java | TypeScript | Nội dung |
|------|------------|----------|
| `actor/Model` (phần di chuyển) | `game/actor/Model.ts` | Toạ độ pixel, hướng, hàng đợi `Control`, `move`, `setAnimationByDir`, `setSpriteRotateByDir`, `getNextMovePos` |
| `actor/Player`, `actor/NPC` (phần đi lang thang) | `game/actor/Player.ts`, `NPC.ts` | NPC cứ mỗi 2–5 giây đi 1 ô (2 px/tick) theo 8 hướng, trong phạm vi quanh vị trí gốc |
| `main/Control` (phần thế giới) | `game/main/Control.ts` | `Move` (1 ô, 24/speed tick), `MoveTo` (BFS + chuỗi `Move`), `PixelMove`, `JumpMap`, `ChangeStage` |
| `main/WorldPanel` | `game/main/WorldPanel.ts` | Phím giữ → `PixelMove` mỗi tick; `correctMoveDis`/`findMoveDis` trượt dọc tường; chạm → `findPath` + `changeDirMoveVectorToPixelMove` (gồm đi chéo, căn lưới trước) |
| `main/GameWorld` (một phần) | `game/main/GameWorld.ts` | Tra model/NPC, `getSpeed` (6 px/tick), `searchPath` (BFS), `logicNPCs`, `logicOtherModels` |
| `map/GameMap.findPath` | `game/map/GameMap.ts` | Tìm đường kiểu A* đơn giản (chi phí = khoảng cách tới điểm đầu + tới đích), cho phép đích là ô có NPC |
| `common/Tool` | `sqrt`, `getCost`, `isColliding`, `rand` | |

Thứ tự trong một tick giống `GameCanvas`: `logicOtherModels` → `myPlayer.logicPlayer` → `logicNPCs`
→ `WorldPanel.handleKey` → `setCameraToPlayer`. Lệnh chạm được xử lý lúc nhả (`pointReleasedFlag`).

### 11.2 Chưa port / thay thế
- `NPC.doNpc` port phần nhiệm vụ và NPC bán hàng (xem §12); NPC đặc biệt khác (dạy kỹ năng, vào trận,
  dịch chuyển) báo cần server; việc tải dữ liệu nhiệm vụ của NPC (`doGetMissionData`) chưa port.
- Đi theo đội, pet và lính đánh thuê đi theo,
  tự động tìm đường tới nhiệm vụ (`autoMoveControlList`), chế độ hộ tống.
- Chạm vào NPC: Java dùng `getPointCheckNPC` với vùng chạm theo pixel; web dùng ô lưới.
- Các lệnh `MoveTo` của "người chơi khác" trên bản đồ thử do `MapScene` giả lập server phát ra.

### 11.3 Đã kiểm chứng (`tests/movement.test.ts`, không cần ảnh)
- `Tool.sqrt` khớp `floor(sqrt)`; BFS ra đường ngắn nhất và đi được, trả rỗng khi bị vây.
- `findPath` tới được đích, trả null khi đích kín.
- Giữ phím: 6 px/tick, dừng trước vật cản. **Trượt góc**: kết quả khớp với tính tay từ code Java
  (dịch phải 6 px về khe hở gần nhất rồi đi tiếp).
- Chạm để đi tới đúng ô và căn lưới. `MoveTo` đi 12 ô trong đúng 49 tick (12 × 4 + 1).
- NPC đi lang thang 3.000 tick không ra khỏi phạm vi.
- Trên Chromium: chạm để đi (có hiệu ứng điểm chạm 1216), phím, người chơi khác đi `MoveTo`, NPC đi lang
  thang, không lỗi console.

## 12. Giao diện game (P4) – tiến độ

### 12.1 Đã làm
| Phần | File | Ghi chú |
|------|------|---------|
| Đọc `.ui` (`XmlParse`) | `game/ui/XmlParse.ts` | Đã đối chiếu từng mã thuộc tính với hằng `ATTR_SET_*`. Giữ cả lỗi gốc "đọc trước 1 int rồi mới ép kiểu". **165/165 file đọc khớp tới byte cuối, 3.955 widget.** |
| Mô hình widget | `game/gui/GWidget.ts` | `GWidget`, `GContainer`, `GLinePanel`, `GTextArea`, `GWindow`, `GLabel`, `GPixelLabel`, `GIcon`, `GGameIcon`, `GGameBar`, `GImageNumer`, `GScrollBar`, `GSpinner` |
| Layout | `GContainer` | V (113 lần dùng), Grid2 (18), Grid (11), H (6) và các kiểu align. `layoutV` lấy từ CFR (Vineflower lỗi). Không file nào dùng border layout nên chưa port. |
| Dựng UI | `game/ui/UIBuilder.ts` | Áp các lệnh gọi như `parseMethod`, nhân bản `batchAdd`, `UIHandler.show()` (setAbs → layout → căn giữa) |
| Vẽ khung | `game/main/GameView.ts` | `drawFrameBox`, `drawImageBox`, `drawBackGround`, `drawShadeBox`, `drawBoxCorner`, `drawImageNumber`… |
| Font bitmap | `game/string/PixelFont.ts` | `.t` 12/14/16/18/20, đọc khớp byte. Chỉ có chữ Hán + ASCII. Chỉ `GPixelLabel`/`GIcon` dùng, giống bản gốc; `GLabel` dùng font hệ thống như bản Android. |
| Màu ARGB | `midp/Graphics.ts` | Byte alpha = 0 nghĩa là màu đặc, khác 0 thì giữ độ trong suốt, giống lớp giả lập Android |
| Màn xem | `scenes/UIViewerScene.ts` | Duyệt cả 165 giao diện |

### 12.2 Chưa làm / khác bản gốc
- `GGameIcon` đã vẽ được: sprite id > 0 tạo từ `.spr`, id 0 = bản sao nhân vật của người chơi (trong trình xem lấy từ phòng thay đồ, thay cho `GameWorld.myPlayer`).
- `GTextArea` + `PowerString` (`game/string/PowerString.ts`): đã port tách dòng `Utilities.splitString`, mã màu `/cRRGGBB…/p` (lồng nhau, `{}` gạch chân), icon `/i`, phân trang và thanh cuộn. Icon mặt cười `/f` (`GameView.faceImage`) và nền ô vật phẩm (`GameView.backIcons`) chưa nạp nên chưa hiện.
- `GScrollBar` chỉ hiện khi nội dung tràn (như Java); phần lớn danh sách được UIHandler điền lúc chạy nên trong trình xem thường chưa thấy thanh cuộn.
- Chữ chạy ngang của `GLabel` (marquee, bit 2/8/16) đã port. Theo đúng Java, chỉ chạy khi chữ dài hơn ô **lúc `setText`/`setBounds`**. Trong file `.ui`, kích thước thường được đặt trước chữ nên các nhãn dịch sang tiếng Việt bị dài hơn vẫn bị cắt cho đến khi UIHandler gọi `setText` lúc chạy (chưa port).
- Icon đứng trước chữ (`iconValue`: VIP, tiền, GM…) chỉ được UIHandler đặt lúc chạy; chưa port.
- **Tương tác chung (đã port):** focus của `GWindow` (phím mũi tên theo bit 256/512/1024/2048, đi vòng, di chuyển theo hàng/cột với layout lưới, phím tắt 1 3 7 9 * 0 #), tự cuộn tới ô được chọn (`setSrollBar`), cuộn danh sách/ô chữ bằng phím, kéo và chạm thanh cuộn, chạm để chọn widget (bit 32), cắt vùng vẽ khi cha đang cuộn (`getIntersect`). Phần điều phối nằm trong `game/ui/UIInput.ts` (phần chung của `UIHandler.handleKey`/`handlerMouse*`).
- **Chưa port:** hành vi riêng từng màn (`UIHandler`, `UIAction`: 45k + 12k dòng); trình xem chỉ báo "sự kiện N" khi bấm. Lặp phím/chạm giữ, đóng khi chạm ra ngoài (cờ 16), các ngoại lệ riêng trong `handlerMouseReleased`. Màn thật tự chọn ô focus đầu tiên; trình xem tạm focus cửa sổ đầu tiên nhận phím.
- **HUD trong thế giới (bước 3):** `ui/211` (`WorldPanel.gameworldPanelUI`) vẽ đè lên **Bản đồ thử** (`game/ui/WorldHud.ts`). Đã port `updateWorldPlayerInfoUI` (không pet), `updateWorldIconPoint` (mọi cờ từ server = tắt), `initAgeIconTip`, `handleWorldPanelMouse` (chạm nút HUD = hành động, không đổi focus; chạm chỗ khác = đi tới) và bản đồ nhỏ của `GameMap` (`initSmallMapWidth`, `createSimpleSamllMap`, `drawSmallMap`: ô đi được, NPC, mũi tên người chơi, tọa độ, tên map).
  - **Số liệu HUD là giả** (cấp 25, HP 820/1000, MP 310/500, EXP 42%, lực chiến 12345; pet cấp 18 với chân dung `common/PetIcon/tx_501.png`) vì không có server. Ô cạnh cấp hiển thị `player.get(118)`, chưa rõ ý nghĩa nên để 0.
  - **Bảng pet** (`updateWorldPlayerInfoUI` nhánh có pet; `MyPet.getPetIcon` lấy ảnh có sẵn trong APK, bản tải về qua `AniResourceSave` không có khi offline) và **icon cấp** (`GameView.levelSet` = set 216, khung theo `doGetLevelImageSetIndex`) đã port. `GIcon` được port đầy đủ hơn (trans/anchor, số đếm, mặt nạ, nhấp nháy theo `GameCanvas.isMotion` với bit 256); `GGameIcon.setImage` và nhánh focus đã port.
  - **Dấu nhiệm vụ trên bản đồ nhỏ** (`Mission.newRadarMapID/Gx/Gy`, frame 6 nhấp nháy) và dấu NPC (`icon2`, `status` bit 32) đã port; nhiệm vụ trong bản đồ thử là giả.
  - **Tin nhắn thế giới** (`WorldMessage`, `ChatMsg.getFullText/parse`, `PowerMsg`): dòng chat hiện 3 giây ở vùng 948, thông báo chạy chữ, hộp nhắc ở vùng 951, tin "điểm" ở vùng 950. Tin trong bản đồ thử là giả; chưa port: lịch sử theo kênh, cửa sổ chat, lì xì, kiểm tra đấu trường/ẩn chat, VIP QQ.
  - Chưa port: quảng cáo, các chế độ ẩn bản đồ nhỏ/hiện quái, và hành động của từng nút.
- **Vẽ nhân vật trên bản đồ** (`main/MapModels.ts`, phần model của `PlayerLayer.draw`): theo từng hàng vẽ người chơi khác (lọc theo cài đặt, tối đa 20, đồng đội luôn hiện), NPC (tên, dấu nhiệm vụ set 11 nhấp nhô), rồi bản thân; pet vẽ trước/sau chủ theo y; tên người chơi khác theo cài đặt "Tên"; biểu tượng bày bán/chiến đấu. Chưa port: lính đánh thuê, pet cưỡi (tab 256), bong bóng chào của NPC, NPC ẩn người chơi.
- **Hiệu ứng của nhân vật** (`main/MyPlayerEffect.ts`, `GameView.drawMyPlayerEffect`): dấu vị trí trên đầu (sprite 1231) và hiệu ứng lên cấp (sprite 1217, chạy một lần), bước theo tick 50 ms. **Lên cấp** (`main/LevelUp.ts`, `MsgHandler.processUpLevelMsg`): áp số liệu server gửi (exp, cấp, exp mới, điểm kĩ năng / thuộc tính), hồi đầy HP/MP, hiện dòng thưởng. Offline phím **0** giả lập một tin lên cấp với số liệu bịa.
- **Pet đi theo chủ** (`Model.setPet` / `checkFollowMove` / `initFollowPos`, `logicPlayer` chạy cả pet): khi cách chủ quá 48 px (x + y), mỗi tick pet đi 6 px theo trục nào cách quá 24 px; `Control` loại 4 tìm pet theo id chủ. Hai người chơi demo cũng có pet giả đi theo (tên hiện theo cài đặt "Tên").
- **Chạm ra ngoài khung** (`UIHandler.handlerMouseReleased`, cờ 16 bật mặc định): đóng UI như nút quay lại, trừ khung toàn màn hình.
- **Đóng màn:** như `UIHandler.handleSpecificUIKey`, các loại UI 2, 3, 7, 14, 21, 37, 44, 52, 54, 62, 63, 66, 67, 74, 79, 88, 92, 94–98, 101, 103, 104, 106, 117, 130, 151, 160, 173, 205, 213–217 nhận nút đóng dưới dạng hành động 1 (màn tự quyết định đóng/lưu); màn nhân vật offline hoàn tác điểm cộng chưa xác nhận rồi đóng.
- **Chồng màn và nút HUD (bước 4):** `game/ui/UIHandler.ts` (danh sách UI mở, bảng widget theo mã sự kiện kể cả thư viện và bản sao ADDLIB, `drawAll`, hộp thoại `alertMessage` ui/7), `game/ui/UIAction.ts` (điều phối theo loại UI, `processWorldPanelLayer`: thu gọn thanh nút 18/19, `doMenuButton` cho mọi nút HUD), `game/ui/UIObject.ts` (phân trang dữ liệu trên máy). Mỗi màn nằm trong `game/ui/screens/`:

  | Nút HUD | Màn | Trạng thái |
  |---|---|---|
  | Item (11208) | ui/2 trang bị | Ô trang bị 0–17, túi 30 ô/trang, nền theo phẩm chất, số lượng, tên vật phẩm, tiền, nhân vật. Chạm vật phẩm mở menu ui/4: tên, số lượng, giá, mô tả và các nút theo loại (trang bị/tháo, khóa, so sánh, bán, dùng, pet…); mọi thao tác cần server, "So sánh" chưa port; pet đang dùng mở màn thông tin pet. Tab bán/phân giải/phụ ma chưa port |
  | Thuốc (11201) | ui/35 dùng vật phẩm | Danh sách vật phẩm dùng được + "Hồi phục hết", chọn để xem mô tả. Dùng vật phẩm cần server |
  | N.vật (11209) | ui/3 nhân vật | Tab C.Bản đầy đủ, cộng/trừ điểm thuộc tính (xác nhận cần server). Tab T.Tính (ui/31): danh sách chỉ số chiến đấu, "G.Thích" hiện mô tả có số liệu (các trường hợp `Battle.calc` cần cho mô tả đã port, mục tiêu cùng cấp). Tab Skill (ui/32): nhóm Bị động/Chủ động/Từ động phóng/Trận, ô tự động và tự phóng, điểm skill, số skill đã học; "Xem" hiện mô tả (`Skill.getDesc`, `Define.getPowerDesc` port 118/197 trường hợp dạng "Tên+giá trị"); "Bỏ" và cài tự động cần server. Tab X.Hội: tiền, vinh dự, điểm thi đấu/khiêu chiến, lực chiến, phụ ma, EXP Thần Kì, địa vị, ô kho, PK, quan hệ; "G.Thích" hiện giải thích (danh hiệu và hạn VIP chưa port). Tab T.Phú (ui/315): số thiên phú đã học, nhóm Công kích/Phòng thủ/Thông dụng (sắp theo rank), "Xem" hiện mô tả. Tab Ảnh cần server |
  | X.Quanh (11210) | ui/73 người xung quanh | Tab Quanh (phân trang 8 dòng) và Đội (trống offline) |
  | Chat (11205) | ui/64 lịch sử chat | Tab kênh, lịch sử theo kênh, tin mới chèn trực tiếp. Gõ tin cần server |
  | H.Thống (11202) | ui/87 menu hệ thống | Đủ mục; "Rời game" về menu chính |
  | Cài đặt (11256, trong H.Thống) | ui/88 (+ widget của ui/108) | Các hàng nút theo bit `Model.setting` (xin vào đội, mời đội, bái sư, tăng tốc, trợ thủ, số dòng chat, tên, bản đồ nhỏ, người chơi), nút "?" giải thích. Java xác nhận rồi gửi server; offline áp dụng ngay và lưu vào localStorage (`main/GameStore.ts`, thay cho RMS của Java), nạp lại khi vào bản đồ. Có tác dụng: "Tên" (đơn giản / chi tiết kèm danh hiệu / ẩn), "Map nhỏ" (không quái / có quái / ẩn), "Người chơi" (trong 72 px / tất cả / ẩn, tối đa 20 người) |
  | Pet (11203) | ui/61 danh sách pet | Pet lấy từ vật phẩm pet trong túi/ô trang bị (`MyPet.doGetBagPetItem`): ảnh, tên theo màu phẩm chất, cấp, dấu "Đang chiến", các nút. Tab dung binh trống (cần server). "C.Tiết" của pet đang chiến mở ui/52; pet khác và các nút Chiến/Nghỉ/P.sinh/Sửa/P.Ấn cần server |
  | Chân dung pet trên HUD (946) | ui/52 thông tin pet | Tab Pet: tên, cấp, cấp trưởng thành, thanh điểm, HP/MP/EXP, thuộc tính, phẩm, tuổi, sao trưởng thành/lĩnh ngộ, hàng nút; "G.Thích" hiện giải thích. Tab Th.Tính và Skill dùng chung với màn nhân vật (trạng thái bẩm sinh hiện "Không"). Các nút thao tác cần server |
  | N.vụ (11207) | ui/37 danh sách nhiệm vụ, ui/46 chi tiết | Tab N.Vụ: tiêu đề "Nhiệm vụ chính", tên nhiệm vụ kèm "[Xong]" khi đạt mục tiêu; chọn dòng hiện khung mục tiêu (`MessageFrame`, tự ẩn sau 120 tick); "Chi tiết" mở ui/46 (mô tả, mục tiêu, phần thưởng exp/Lá/Bạc/Cống hiến). Chỉ port điều kiện "Hủy diệt" (2) và "Nhận được" (7). Tab H.Động/Tăng/Sôi Nổi, nhiệm vụ khiêu chiến, "Dò đường" cần server; "Hủy" chạy qua giả lập cục bộ (bên dưới) |
  | Hội thoại NPC nhiệm vụ (chạm/đi vào NPC) | ui/46 | Port `NPC.doNpc` / `doMissionNpc` / `handleChoiceMissionAction` / `doMissionInfoView` (case 5, 6, 7, 8, 9, 10) và `Mission.doMenuButton`: danh sách nhiệm vụ của NPC kèm biểu tượng trạng thái (bộ ảnh 3: ? cam = trả được, ? xám = đang làm, ! cam = nhận được, ! xám = chưa đủ điều kiện) và "Rời đi"; một mục duy nhất (hoặc một nhiệm vụ trả được) mở thẳng. Nhận / Xong nhiệm vụ / Hủy dùng **giả lập server cục bộ** (`main/MissionServer.ts`, xem dưới). Hộp xác nhận "Hủy" dùng ui/14 (`waitForTwiceSureUI`, xem dưới). Chưa port: hộ tống, nhiệm vụ offline/hướng dẫn/one-key, chọn vật phẩm thưởng, ảnh NPC trong hộp thoại |
  | Shop NPC (NPC demo 3, `npcType` 2) | ui/42 cửa hàng, ui/14 hộp xác nhận | Port `doSpecialNpc` (chủ đề + "Rời đi"), `doBrowseShop` → `ShopItem.openItemShop`, `createShopItemUI` / `updateDataToShopItemUI` / `updateDataToShopItemInfo`, `processShopItemLayer` / `processShopItemMenu`, `doItemShopBuyMsg` / `doItemshopSellMsg`. Tab "Mua" (hàng của shop) và "Bán" (túi đồ), 10 ô một trang, ô chọn hiện icon/tên/giá và nút Mua99/Mua30/Mua1 (hoặc Mua) / BánHết/Bán1 (hoặc Bán) theo `stackNum`; chạm ô hiện mô tả. Mua lớn và bán luôn hỏi lại qua ui/14 (`waitForTwiceSureUI`, Java chặn vòng lặp; ở đây dùng callback). Thiếu tiền báo theo `Model.checkEnoughMoney` (bản rút gọn: không đề nghị nạp, không cho KNB bù Lá). Chưa port: các loại shop khác (lính, ghép, đấu trường, pet, cường hóa, VIP…), hình xem trước trang bị (4228), "Bán thông minh". Dấu hot/new (4230/4231) không hiện: chúng vẽ bằng FRAGMENTTABLE không kèm COLORTABLE, và theo `GLabel.paint` trong Java có vẻ cũng không vẽ — chưa xác nhận |
  | Map (11281) | Bản đồ thế giới (stage 60, `main/WorldMap.ts`, panel ui/110) | Ảnh `common/wm.png`, chấm vàng mỗi vùng, vùng chọn nhấp nháy xanh, kéo/phím 2-4-6-8/chạm để chọn, ✕ về thế giới. Danh sách vùng do server gửi: offline đặt 14 vùng theo tên in trên ảnh (vị trí ước lượng). Chọn vùng → danh sách bản đồ con (ui/109) cần server |
  | X.Giao, T.Tựu, L.Địa, Thư, Nạp, cửa hàng, sự kiện… | — | Báo "cần kết nối server" (Java gửi yêu cầu lên server trước) |

  **Giả lập server nhiệm vụ** (`main/MissionServer.ts`): thay cho trả lời của server (14502/14503/14504, `processMissionReward`, `processMissionNPCStatus`). Kiểm tra cấp, điều kiện, NPC/bản đồ; khi trả: trừ vật phẩm của mục tiêu "Nhận được", cộng Lá/Bạc/Exp ghi trên nhiệm vụ (Cống hiến chưa cộng), bật bit hoàn thành (`Player.missionStatus`). **Phần tự đặt (không phải dữ liệu game):** đường exp khi lên cấp (max ×1.2 mỗi cấp, +5 điểm kỹ năng/+5 điểm thuộc tính), luật dấu NPC = trạng thái tốt nhất + 1 (suy ra từ thứ tự frame của bộ 3 và 11, server thật tự gửi dấu). Nhiệm vụ nối tiếp dùng điều kiện nhận loại 9 "đã xong nhiệm vụ" (đã kiểm tra trong `Condition.isConditionOfSatisfy`). NPC demo 2 giao/nhận các nhiệm vụ giả; chuỗi "Thư cho trưởng thôn" → NPC demo 1 → "Hồi âm" thử `submitNextMissionID`; nhiệm vụ cấp 50 bị ẩn (trạng thái 3).

  **Giả lập server shop** (`main/ShopServer.ts`): thay cho danh sách hàng (`getShopItemList`) và trả lời mua/bán. Mua: kiểm tra kho/giới hạn/tiền/chỗ trong túi, trừ giá × số lượng, thêm vào túi (gộp theo `stackNum`, túi 2 trang = 60 ô), giảm giới hạn/kho. Bán: trừ vật phẩm, **cộng giá của vật phẩm × số lượng vào Bạc — giá bán thật do server quyết định, đây là tự đặt**. Tên, giá, giới hạn, tồn kho của hàng demo và giá bán của đồ trong túi demo đều là dữ liệu giả.

  **Kết nối BE riêng của người dùng** (`server/ws-tcp-bridge.mjs`, `npm run bridge`): trình duyệt không mở được TCP thô, nên cầu nối Node chuyển nguyên byte giữa WebSocket `ws://localhost:8081` và TCP `127.0.0.1:30100` (cổng mặc định của BE Python `python -m backend.pvtk.server`). Menu **"Vào server riêng (BE)"** (`scenes/OnlineLoginScene.ts`, địa chỉ cầu nối đổi bằng `?be=`) chạy luồng đăng nhập của client 1.2.0 mà BE dùng (`net/online/`): 5000 kiểm tra phiên bản → 5002 đăng nhập (token giả `web-local`, mã thiết bị ngẫu nhiên lưu trong trình duyệt; không gửi IP test của bản Android) → 5007 danh sách khu → 1 vào server (giữ nguyên kết nối thay vì mở socket mới tới `sockUrl` như Android) → 10001 danh sách nhân vật, chưa có thì 10002 tạo nhân vật (trang phục của phòng thay đồ, tên `Web####`) → 2 vào game → 10503 chỉ khối NPC (1024, gzip). Gói 2 được đọc theo `processDataBlockFlagMsg` bản 1.2.0 (`net/online/EnterGame.ts`: `Player.fromBytes` — bản 1.2.0 đọc danh sách danh hiệu thay cho titlePower1/2 —, `MyPet.fromBytesDetail`, `Item.fromBytes`, `Skill.fromBytes`, khối trạng thái/nhiệm vụ) tới hết khối bản đồ 512; các khối sau (trận pháp, thiên phú) chưa đọc. `MapScene` chế độ online (`game/main/OnlineWorld.ts`) dựng bản đồ, nhân vật (cấp, exp, HP/MP, tiền, chỉ số, túi, kỹ năng) và NPC (`NPC.fromBytes` 1.2.0, `net/online/WorldData.ts`) từ BE; không có người chơi khác, chat giả hay dữ liệu demo. Đã thử trên trình duyệt với BE Python: vào Tân Thủ Thôn, 34 NPC/quái, đi lại được.

  Đã nối với BE ở chế độ online (gói theo client 1.2.0, `net/online/`):
  - **Di chuyển** (`MoveSync.ts`, `MsgHandler.doSoftSync` / `syncMoveTo`): mỗi 5 giây gửi 10504 (gx, gy) nếu ô đã đổi; trước khi hỏi nhiệm vụ của NPC cũng gửi ngay.
  - **Nhiệm vụ** (`MissionMessages.ts`, `Mission.fromBytes` / `Condition.fromBytes` 1.2.0): nói chuyện với NPC loại 0/5 gửi 14501 (`NPC.doGetMissionData`, một lần trừ khi NPC có bit 16), nhiệm vụ đang làm lấy từ gói vào game; nhận 14502, trả 14503 (đọc `processMissionReward`: tiền, lên cấp, vật phẩm thêm/bớt, cống hiến), bỏ 14504; dấu NPC theo `processMissionNPCStatus` của từng trả lời. Điều kiện loại 12 (ở bản đồ) đã thêm. Đã thử với BE: nhận, bỏ, trả "Dẹp Loạn Mèo Hoang" (lên cấp, +3 Bình Máu Nhỏ).
  - **Trận đánh bản địa** (`game/battle/`, `scenes/BattleScene.ts`, `BattleMessages.ts`): 10503 xin thêm khối 2048 (nhóm quái, `MonsterGroup.fromBytes`) và 4096 (quái + AI, `Monster.fromBytes`, `MonsterAI.fromBytes`). Đi tới trong 24 px của NPC loại 1 (`GameWorld.logicNPCs` → `toBattle`, cách nhau 5 giây, NPC ẩn `comeOutTime` giây) gửi 12501 rồi mở trận. Luật trận port từ `Battle`: 34 vị trí, lượt theo tốc độ, `java.util.Random` có seed (`common/JavaRandom.ts`), công thức `calc` (trúng, sát thương, chí mạng, đỡ, phản đòn, hút máu, thấu rõ, khiên ma lực), buffer/trạng thái (`core/Buffer.ts`, `battle/BattlePower.ts` = `Define.processBattlePower`), AI quái, kỹ năng chủ động, dùng thuốc, bỏ chạy, tự đánh (Auto), pet (pet đang mang từ gói vào game, `MyPet.fromBytesDetail` + công thức `MyPet.get`; pet nhận lệnh riêng sau người chơi hoặc tự đánh), bảo vệ của pet. Thuộc tính trận lấy từ công thức `Player.get` (trang bị, kỹ năng bị động, bộ đồ, danh hiệu). Màn hình trận port `BattleAniEngine`, `AnimationControl` (chạy tới, đòn đánh, hiệu ứng, số bay, "Né", chết), `BattlePanel` (thanh lệnh ui/100, danh sách kỹ năng/vật phẩm ui/15, con trỏ mục tiêu) trên nền bản đồ làm tối. Kết thúc gửi 12502 (HP/MP đầu-cuối, seed, nhóm, các lệnh) và đọc thưởng (`parseBattleNormalReward`: tiền, lên cấp, tiến độ diệt quái của nhiệm vụ, vật phẩm, dấu NPC). Đã thử trên trình duyệt với BE Python: đánh thắng Mèo Hoang (EXP, Đồng về đúng), dùng Bình Máu Nhỏ, bỏ chạy, kỹ năng Trảm Kích (học ở Võ Sư qua 14002 bằng script), pet Manh Hệ Nữ Bộc cùng đánh và lên cấp sau trận. Chưa port: trận từ xa/PK/đấu trường/xem trận, lính đánh thuê, NPC đồng minh trong nhóm quái chưa thử, phần thưởng pet và hộ tống (gặp thì báo lỗi), chat trong trận, hướng dẫn tân thủ. Lưu ý BE: BE coi `endHP > 0` là thắng nên bỏ chạy vẫn nhận thưởng; HP pet BE gửi (160) lớn hơn HP tối đa theo công thức client (152) nên vào trận bị cắt về 152.
  - **Shop** (`ShopMessages.ts`): 12004 danh sách (`ShopItem.fromBytesShopItem`), 12005 mua (`doItemShopBuyMsg`: thêm vào túi, `Model.setPlayerMoney`), 12006 bán (tổng Bạc mới). Shop quốc gia (22000–23999) và đổi vật phẩm (30000–30199) chưa hỗ trợ.

  Chưa làm ở chế độ online: người chơi khác và các gói server tự đẩy (đang bỏ qua, kể cả 11004 hồi máu),  đổi bản đồ, chọn/tạo nhân vật bằng giao diện gốc, chọn phần thưởng nhiệm vụ, dò đường.

  Dữ liệu người chơi, pet, nhiệm vụ, kỹ năng, túi đồ, vật phẩm và người chơi khác đều là **dữ liệu giả** (`game/demo/DemoData.ts`); icon vật phẩm chọn tuỳ ý từ `common/1`, không khớp loại vật phẩm thật. `getClone` dựng lại widget từ dữ liệu `.ui` (Java chép trạng thái lúc chạy; các màn chỉ nhân bản mẫu chưa bị đổi nên kết quả như nhau).
- Font hệ thống: dùng Roboto/Arial để gần với Android, nhưng độ rộng chữ vẫn có thể lệch vài pixel.
- `GameView.initImage` (các bộ ảnh đặc biệt như tiền, icon VIP) chưa port; mọi id đều nạp từ `common/<id>`.
