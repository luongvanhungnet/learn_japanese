# Ngân hàng Ôn thi thần tốc N3

600 câu tự biên soạn bởi Codex, 40 câu cho mỗi dạng. Không sao chép từ đề thi chính thức. Đây là ngân hàng luyện tập N3, với các câu nối ngữ cảnh từ cơ bản đến nâng cao trong phạm vi luyện N3; không phải một đề thi chuẩn hóa hay một danh sách từ vựng chính thức của JLPT.

| Thư mục | Tệp / dạng | Số câu |
| --- | --- | ---: |
| vocabulary | reading, writing, context, paraphrase, usage | 200 |
| grammar | form, ordering, text | 120 |
| reading | short, medium, information | 120 |
| listening | task, point, expression, response | 160 |

- Mỗi tệp chứa 40 câu đã lưu tĩnh, không sinh bằng cách thay tên, địa điểm hoặc số liệu trong một mẫu lúc chạy ứng dụng.
- 60 bài đọc riêng (20 bài mỗi dạng), mỗi bài có hai câu hỏi khác nhau. Hai câu dùng chung bài đọc là chủ đích; không phải hai bản sao của cùng một câu. Đoạn vừa có lập luận, diễn biến hoặc thay đổi quan điểm; tra cứu thông tin dùng lịch, giá, hạn chót, điều kiện và ngoại lệ.
- 160 kịch bản nghe riêng. Nhóm hiểu nhiệm vụ và hiểu điểm chính có cả câu hỏi trong lời đọc. Nhóm diễn đạt tình huống đọc tình huống; nhóm phản hồi nhanh đọc lời nói cần đáp lại. Đáp án lựa chọn vẫn hiển thị trên màn hình cho chế độ bốn lựa chọn.
- Mỗi câu có `id`, `section`, `kind`, `prompt`, `choices` (4 chuỗi), `answer` (chỉ số 0–3), `explanation` tiếng Việt và `batch` (1–12). Nội dung theo ngữ cảnh ở `passage` hoặc `audioText`.
- Câu ★ có `orderedFragments` và `starIndex` để đối chiếu vị trí đáp án với câu hoàn chỉnh. Các trường này phục vụ rà soát, không hiển thị lời giải trước khi chọn đúng.
- Giữ mã câu khi sửa nội dung. Nếu thay hẳn một câu bằng nội dung khác ở lần mở rộng sau, nên dùng mã mới.

## Rà soát nội dung

Codex đã rà soát nội dung và đáp án trong lượt biên soạn này: đối chiếu cách đọc/cách viết, nghĩa trong ngữ cảnh, quan hệ trước–sau/nhượng bộ/nguyên nhân trong đoạn văn, trật tự câu ★, điều kiện và phép tính trong thông báo, người thực hiện hành động trong hội thoại, cùng mức lịch sự trong lời đáp. Các lựa chọn sai chủ ý chứa lỗi từ vựng, cấu trúc hoặc không phù hợp tình huống.

Các sửa đổi ở lượt rà soát cuối gồm:

- Bổ sung ngữ cảnh về hiệu quả thuốc khác nhau theo người để làm rõ `とは限らない`.
- Sửa một câu ★ về việc quên trả sách, khóa điểm nhìn của người mượn và đối chiếu lại đáp án với các mảnh câu.
- Loại các phương án dùng từ có thể đọc thành câu hợp lệ ở nhóm `集中`, `落ち着く`, `思い出す`, `相談`, `受け取る`.
- Thay các lời đáp sai có câu Nhật không tự nhiên trong nhóm phản hồi nhanh bằng câu hoàn chỉnh nhưng không đáp đúng mục đích giao tiếp.
- Chuyển hai giải thích còn toàn tiếng Nhật sang tiếng Việt; kiểm tra lại phí giao hàng, giảm giá, giờ nhận hồ sơ và mốc tới sân bay.

Kiểm tra tự động không chứng minh tính duy nhất về nghĩa của đáp án. Phần rà soát ngôn ngữ ở trên do Codex thực hiện, không phải xác nhận độc lập từ giáo viên.

## Kiểm tra và mở rộng

Chạy `npm run speed-exam:audit` và các kiểm thử `src/speedExamData.test.ts`, `src/speedExamSelection.test.ts`, `src/SpeedExamMode.test.tsx`, `src/ExamNavigation.test.tsx`.

Audit kiểm tra 600 mã/câu không trùng, 15 tệp × 40 câu, 12 đợt × 50, bốn lựa chọn khác nhau, chỉ số đáp án hợp lệ, nguồn bài đọc/lời nghe, đáp án ★ và các nguồn dài gần trùng (Dice similarity trên trigram, ngưỡng 0,8). Cặp câu cố ý dùng chung một bài đọc được loại khỏi kiểm tra gần trùng; kiểm tra câu trùng vẫn xét cả bài đọc và câu hỏi. Kết quả audit được in ra JSON để dễ lưu/đối chiếu.

Các số lượng trong UI và Filter được tính từ ngân hàng. Khi mở rộng vượt 600, cập nhật mốc kiểm tra phát hành trong audit/test và bổ sung nhãn đợt; không cần sửa các con số trên giao diện.

## Đợt biên soạn

Mã đợt độc lập với thứ tự Sort khi luyện. Mỗi đợt có 50 câu, liệt kê theo thứ tự phần/dạng trong bộ tổng hợp.

| Đợt | Phân bổ theo phần | Tổng |
| --- | --- | ---: |
| 1 | Từ vựng 50 | 50 |
| 2 | Từ vựng 50 | 50 |
| 3 | Từ vựng 50 | 50 |
| 4 | Từ vựng 50 | 50 |
| 5 | Ngữ pháp 50 | 50 |
| 6 | Ngữ pháp 50 | 50 |
| 7 | Ngữ pháp 20 · Đọc hiểu 30 | 50 |
| 8 | Đọc hiểu 50 | 50 |
| 9 | Đọc hiểu 40 · Nghe hiểu 10 | 50 |
| 10 | Nghe hiểu 50 | 50 |
| 11 | Nghe hiểu 50 | 50 |
| 12 | Nghe hiểu 50 | 50 |
