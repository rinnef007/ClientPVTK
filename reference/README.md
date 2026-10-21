# Tài liệu tham khảo

`world-online/` là **git submodule** trỏ tới <https://github.com/treefuture/world-online>, một repo của cộng đồng người chơi 世界Online. Repo chứa:
- dữ liệu JSON tổng hợp (trang bị, kỹ năng, pet, quái…);
- tài liệu và bảng tính về công thức;
- công cụ mô phỏng trạng thái.

Nội dung **không được chép vào repo này**: submodule chỉ lưu URL và mã commit. Repo gốc không có file giấy phép.

Lấy về sau khi clone:

```
git submodule update --init --depth 1 reference/world-online
```

Dùng để tham khảo cách tính (sát thương, phòng thủ, kinh nghiệm…). Nguồn chuẩn khi port vẫn là mã Java dịch ngược. README của công cụ mô phỏng tự ghi là "không dùng dữ liệu/logic chính thức, chỉ là kinh nghiệm cá nhân", nên số liệu ở đây cần đối chiếu trước khi dùng.
