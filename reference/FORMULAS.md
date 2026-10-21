# Đối chiếu công thức: world-online và mã Java dịch ngược

"Java" là `com.hz.battle.Battle` (bản dịch ngược jadx) và `PlayerInfoUIAction` của client Phong Vân Truyền Kỳ 2. "world-online" là các ghi chú và công cụ trong `reference/world-online`:
- `部分文档收录/世界OL基础知识篇.md`;
- `第一代/世界ol(源)/*.cpp`;
- `第二代/伤害计算`.

Đây là công thức **phía client**. Server có thể tính khác; client không cho biết điều đó.

| Mục | Java (client) | world-online | Kết quả |
|---|---|---|---|
| Số lần tấn công | `get(35)` + số lần của kỹ năng, kẹp 1..99 | `z = … <= 99 ? … : 99` | Khớp |
| Sát thương vật lý mỗi đòn | `get(36 hoặc 37) / số lần + rand(get(33)..get(34))` → tổng ≈ lực chém/đâm + sát thương vũ khí trung bình × số lần | `e = (min+max)/2 × số lần + lực chém/đâm` | Khớp |
| Giảm theo phòng thủ | `× (100 − giảm%) × rand(95..105) / 10000`, với giảm% = `((phòng×80/100) / (cấp mục tiêu + 12))`, kẹp 0..75 (calc 8/9/10) | Không ghi | Chỉ có trong Java |
| Chí mạng | ×1,5 (`iCalc * 15 / 10`) | "暴击伤害是1.5倍并非2倍" | Khớp |
| Tỉ lệ chí mạng | `get(45) × 15 / cấp` (%) (calc 14) | Không ghi | Chỉ có trong Java |
| Chuẩn xác ma pháp | `get(44) × 10 / cấp mục tiêu` (%) (calc 3) | "魔法命中/(目标等级*10)" (tỉ lệ) | Khớp (cùng công thức, một bên %, một bên tỉ lệ) |
| Miễn sát thương | Mỗi điểm `get(49)` giảm 0,1% (`/1000`), tối đa 70% | "每点伤害减免效果…0.1" | Khớp |
| Miễn sát thương khi có 1 / 2 trạng thái bất lợi | Buff bit 3 và bit 10, mỗi cái chia đôi `get(49)` → 0,05% / 0,025% | Lưu huyết hoặc suy nhược 0,05; cả hai 0,025 | Khớp |
| Sát thương nhận thêm khi có trạng thái bất lợi | Bit 10 +20, bit 3 +10, **cộng dồn**: cả hai = +30% | Lưu huyết +10%, suy nhược +20%, cả hai **+32%** | **Lệch** (xem ghi chú 1) |
| Kháng trạng thái | `get(48)` − bỏ qua của đối thủ (`get(204)`), tối đa 700, so với `rand(1000)` → 0,1%/điểm, tối đa 70% | Không ghi | Chỉ có trong Java |
| Đỡ đòn | `get(51) × 7 / cấp`, tối đa 70% (calc 21) | Không ghi | Chỉ có trong Java |
| Điểm kỹ năng pet | Không có trong client | `S = 5×N×(N−1) + 10` | Chưa kiểm chứng được |

**Ghi chú**

1. **Sát thương nhận thêm:**
   - Client cộng 20 + 10 = +30%. Ghi chú người chơi ghi +32%, tức 1,2 × 1,1 nhân với nhau.
   - Có thể server tính kiểu nhân, cũng có thể ghi chú sai. Client không cho biết bên nào đúng.
   - Tôi chưa xác nhận được bit 3 / bit 10 ứng với "lưu huyết" / "suy nhược". Tôi chỉ ghép theo con số +10 / +20.
2. **Hệ số người chơi tự đặt:** các bản C++ "魔化/战斗叠加" có những hệ số như 1,2 × 1,1 × 0,3 cho buff kỹ năng. Đây là con số người chơi tự gán cho kỹ năng, không có trong `Battle.calc`.
3. **Chưa kiểm chứng được:**
   - "Chuẩn xác ma pháp cơ bản 100": client không đặt giá trị nào cả, giá trị do server gửi.
   - Bảng kinh nghiệm lên cấp (ảnh JPG): client nhận EXP tối đa từ server (`get(1)`).
