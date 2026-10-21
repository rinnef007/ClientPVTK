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
- **Gói upload chỉ có `.png` (~2.350 file)**. Thiếu toàn bộ file dữ liệu nhị phân nói trên, nên chưa
  dựng được bản đồ, ghép sprite hay layout UI giống bản gốc. → **Blocker cho giai đoạn 3–4** (xem §8).

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
| P3 – Sprite & bản đồ | Port `sprite/*`, `image/ImageSet`, `map/*` | Vẽ đúng 1 bản đồ + nhân vật đi lại | ⛔ cần file `.fr/.spr/.m` |
| P4 – UI hệ thống | Port `gui/*`, `ui/UIObject`, một phần `UIHandler` (túi đồ, chat, nhiệm vụ) | Mở được túi đồ, chat với dữ liệu mock | ⛔ cần `.ui/.pd/.pn` |
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
1. **Thiếu file dữ liệu nhị phân** (`.fr/.spr/.m/.ui/.pd/.pn/.mss/.t/.n/.pl`). Cần toàn bộ thư mục `assets/`
   trong APK (giải nén APK như file zip). Nếu không có, P3–P4 chỉ làm được bằng dữ liệu tự chế.
2. **Không có server**. Mock server chỉ trả lời vài loại tin. Hành vi thật của server phải suy ra từ
   `MsgHandler` (bên nhận), nên có thể sai ở nhiều chỗ.
3. Code jadx có đoạn decompile lỗi (ví dụ vòng lặp `while(true)` trong `Input.run`). Khi port phải đọc theo ý đồ,
   không chép máy móc.
4. Bản quyền ảnh/âm thanh: chỉ dùng cục bộ cho học tập; không đưa lên repo công khai hay host public.
5. Độ phân giải gốc 320×480 là suy luận từ kích thước logo, cần xác minh thêm ở `AndroidZoom`/`PipActivity`.
