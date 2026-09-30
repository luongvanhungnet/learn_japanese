# Mimikara Study

Trang học từ vựng Nhật N3/N2 chạy hoàn toàn trên máy cá nhân. Ứng dụng gồm 880 mục N3 và 1.160 mục N2, mỗi lần xem một bộ.

## Chạy cục bộ

Cần Node.js 20.19+ hoặc 22.12+.

```powershell
npm install
npm run dev
```

Mở địa chỉ Vite in ra trong terminal (thường là `http://localhost:5173`). Không cần máy chủ dữ liệu, tài khoản hay API khi học.

```powershell
npm test       # kiểm tra chấm đáp án, tiến độ và độ đầy đủ của hai bộ từ
npm run build  # tạo bản production trong dist/
npm run preview
```

## Cách học

- Chọn N3 hoặc N2. Hai cột số thứ tự và từ vựng luôn hiện khi cuộn ngang.
- Mở một ô ở ba cột còn lại, nhập rồi nhấn Enter hoặc nút ↵. Đúng sẽ có viền xanh và con trỏ chuyển xuống ô chưa làm tiếp theo cùng cột. Sai sẽ xóa nội dung vừa nhập, báo lỗi và giữ con trỏ ở ô đó.
- **Hint+** (Alt+A) hiện dần đáp án từ trái sang phải. **Đáp án** (Alt+S) hiện ngay trên ô đang nhập trong 1 giây rồi tự ẩn; con trỏ vẫn ở ô đó và việc xem không tính là làm đúng.
- Chỉ khi gửi câu sai, ô mới vào **Khắc phục lỗi**. Phải nhập đúng ô đó ở chế độ này để xóa lỗi.
- Thanh **Thu phóng** đổi kích thước bảng. **Tổng quan** hiển thị toàn bộ từ trên một bản đồ vừa màn hình; chọn một ô để quay lại hàng đó.
- **Tập trung** chỉ hiện từ vựng và một cột luyện tập. Chọn **Cách đọc**, **Hán Việt** hoặc **Ngữ nghĩa** ở thanh nhỏ phía trên; chiều rộng cột từ vựng tự thay đổi theo từng từ. Dùng **Danh sách đầy đủ** để quay lại bảng.
- Tiến độ được lưu bằng `localStorage` trong trình duyệt đang dùng. Xóa dữ liệu trang web của trình duyệt sẽ xóa tiến độ.

Ô cách đọc nhận hiragana hoặc katakana tương đương. Hán Việt và nghĩa nhận cả tiếng Việt có dấu hoặc không dấu, bỏ qua hoa thường, khoảng trắng và dấu câu. Một trong các nghĩa tách từ nguồn được chấp nhận. Từ không có kanji hiện “—” ở ô Hán Việt.

## Dữ liệu

Hai tập dữ liệu đã được đóng gói vào `src/data/n3.json` và `src/data/n2.json`; người dùng không cần tệp gốc để chạy trang.

- N3 được chuyển từ bảng Excel người dùng cung cấp. Các cách đọc còn trống và âm Hán Việt được bổ sung, đối chiếu với Unihan `kVietnamese` và dữ liệu kanji được dẫn trong [ATTRIBUTION.md](ATTRIBUTION.md).
- N2 được tách theo từng dòng/cột từ PDF người dùng cung cấp, OCR Nhật–Việt và so số thứ tự cùng một danh sách văn bản độc lập. Những chỗ OCR hoặc danh sách văn bản mâu thuẫn rõ đã được sửa trong `scripts/n2_overrides.json`.
- `scripts/validate_data.py` kiểm tra đủ số thứ tự, không trùng, và dữ liệu cần thiết ở mỗi mục. Bài kiểm thử Vitest chạy lại các kiểm tra này.

Các script trong `scripts/` dùng để tái tạo dữ liệu từ tài liệu nguồn. Chúng cần Python cùng `openpyxl`, `Pillow`, `lxml`, Poppler, Tesseract.js và kết nối mạng để tải dữ liệu tham chiếu; việc học và chạy ứng dụng không cần các bước này.
