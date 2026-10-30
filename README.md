# Mimikara Study

Trang học tiếng Nhật gồm 880 từ N3, 111 mẫu ngữ pháp N3, 1.160 từ N2 và 214 bộ thủ Kanji. Có thể học với tiến độ khách lưu trên máy hoặc tạo tài khoản để lưu và đồng bộ dữ liệu qua PostgreSQL.

## Chạy cục bộ

Cần Node.js 20.19+ hoặc 22.12+.

```powershell
npm install
npm run db:local
npm run db:migrate
npm run dev
```

Mở địa chỉ Vite in ra trong terminal (thường là `http://localhost:5173`). `npm run dev` chạy Vite và API ở cổng 3001; Vite chuyển tiếp `/api` đến máy chủ. `db:local` dùng các công cụ PostgreSQL (`initdb`, `pg_ctl`) trên PATH, tạo cụm dữ liệu riêng trong `.postgres-data.local/`, lắng nghe tại `127.0.0.1:5433` và tạo cơ sở dữ liệu `mimikara_study`. Nó không thay đổi dịch vụ PostgreSQL hiện có. Có thể đặt `PG_BIN` để chỉ đến thư mục `bin` của PostgreSQL.

Nếu đã có PostgreSQL, sao chép `.env.example` thành **`.env.local`**, thay `DATABASE_URL` và `SESSION_SECRET`, rồi chạy `npm run db:migrate`. Không cần `db:local` khi dùng cơ sở dữ liệu riêng. Migration tạo bảng và có thể chạy lại; không xóa dữ liệu.

### Tài khoản và dữ liệu

Nút **Log in / Đăng nhập** và **Sign up / Đăng ký** có trong các chế độ học, flashcard và đọc truyện. Đăng ký bằng tên, email và mật khẩu 8–128 ký tự. Lựa chọn sao chép tiến độ khách trên máy được hiển thị khi đăng ký; dữ liệu khách vẫn được giữ. Đăng nhập chỉ nạp dữ liệu của tài khoản đó. Đăng xuất trở về tiến độ khách, không để dữ liệu của tài khoản khác xuất hiện.

Tài khoản lưu tiến độ luyện tập (bao gồm lỗi cần ôn và nghĩa Anh/Việt), lịch flashcard, vị trí ô gần nhất, lựa chọn hiển thị, bộ flashcard, ngôn ngữ và chương truyện. Dữ liệu nạp trước khi mở màn hình học. Thay đổi được lưu vào bộ đệm riêng của tài khoản và gửi theo đợt; nếu gửi thất bại, trang hiện trạng thái lỗi và nút thử lại. Các thay đổi chờ gửi được giữ để thử lại khi có mạng, quay lại trang hoặc đăng nhập lại. Đăng xuất chờ lưu thành công để giữ tiến độ.

API dùng PostgreSQL với các bảng `users`, `sessions`, `user_data`; dữ liệu học lưu bằng JSONB theo ID tài khoản. Mật khẩu được băm bằng scrypt và salt ngẫu nhiên. Phiên đăng nhập dùng cookie HttpOnly/SameSite, được lưu trên máy chủ dưới dạng HMAC, hết hạn sau 7 ngày và bị thu hồi khi đăng xuất. Các API ghi kiểm tra origin, giới hạn thử đăng nhập/đăng ký và kiểm tra tài khoản trước khi đồng bộ.

**`.env.local` chỉ dùng để cấu hình bí mật phía máy chủ**, được Git bỏ qua. `db:local` sinh mật khẩu PostgreSQL và `SESSION_SECRET` ngẫu nhiên; không đưa chúng vào mã nguồn. Không đặt tiền tố `VITE_` cho `DATABASE_URL`, `SESSION_SECRET` hay mật khẩu. `.env.example` chỉ chứa giá trị mẫu. `APP_ORIGIN` là danh sách origin giao diện được phép (phân cách bằng dấu phẩy); thêm origin thực tế khi đổi cổng hoặc tên miền. Với PostgreSQL từ xa cần TLS, dùng `DATABASE_SSL=true`; có thể đặt `DATABASE_SSL_CA_FILE` nếu cần CA riêng.

Sau khi build, `npm start` chạy API và phục vụ `dist/` tại `http://127.0.0.1:3001`. Khi triển khai, đặt `NODE_ENV=production`, dùng HTTPS và cấu hình `APP_ORIGIN` đúng tên miền để cookie Secure hoạt động. Chưa có dịch vụ gửi email xác minh hay khôi phục mật khẩu.

```powershell
npm test       # kiểm tra chấm đáp án, tiến độ và độ đầy đủ của ba bộ học
npm run test:db # kiểm tra tài khoản và tiến độ với PostgreSQL thật; tự dọn 2 tài khoản thử
npm run build  # tạo bản production trong dist/
npm run preview
```

## Cách học

- Chọn N3, **Ngữ pháp N3**, N2 hoặc **Bộ thủ Kanji**. Hai cột số thứ tự và chữ luôn hiện khi cuộn ngang.
- Mở một ô ở ba cột còn lại, nhập rồi nhấn Enter hoặc nút ↵. Đúng sẽ có viền xanh và con trỏ chuyển xuống ô chưa làm tiếp theo cùng cột. Sai sẽ xóa nội dung vừa nhập, báo lỗi và giữ con trỏ ở ô đó.
- **Hint+** (Alt+A) hiện dần đáp án từ trái sang phải. Mỗi lần nhấn đặt lại bộ đếm 5 giây cho riêng ô đó; sau 5 giây không nhấn thêm, gợi ý biến mất và số chữ đã gợi ý về 0. Trạng thái đúng/sai không bị xóa. **Đáp án** (Alt+S) hiện ngay trên ô đang nhập trong 1 giây rồi tự ẩn; con trỏ vẫn ở ô đó và việc xem không tính là làm đúng. Phím tắt dùng được cả khi chưa mở ô.
- Nhập sai, dùng **Hint+** hoặc xem **Đáp án** đều đưa từ vào **Khắc phục lỗi**. Nếu dùng gợi ý hoặc đáp án trong một lần ôn, trả lời đúng vẫn giữ từ trong danh sách, kể cả sau khi gợi ý tự ẩn hoặc tải lại trang. Phải trả lời đúng ô đó trong một lần ôn tiếp theo không dùng trợ giúp để xóa lỗi.
- Thanh **Thu phóng** đổi kích thước bảng. **Tổng quan** hiển thị toàn bộ từ trên một bản đồ vừa màn hình; chọn một ô để quay lại hàng đó.
- **Tập trung** hiển thị 4 cột: từ vựng, cách đọc, Hán Việt và ngữ nghĩa. **Alt+Z** sang trái, **Alt+X** sang phải, **Alt+C** lên và **Alt+V** xuống; bỏ qua ô không có dữ liệu và dừng ở mép bảng. Ô đã đúng vẫn có thể nhận con trỏ. Dùng **Danh sách đầy đủ** để quay lại bảng.
- Thanh điều khiển trong **Tập trung** tự ẩn; đưa chuột vào vùng 64 px trên cùng để hiện và giữ thanh mở khi thao tác bên trong. Thanh nổi không đẩy các ô học xuống. Nút **Toàn màn hình** mở toàn màn hình của trình duyệt; nhấn lại hoặc dùng **Esc** để thoát. Điều khiển vẫn truy cập được bằng phím Tab.
- Mỗi cột luyện tập trong chế độ tập trung có lựa chọn hiển thị riêng, được lưu trên máy: **1** giữ đáp án đã đúng trong ô xanh; **2** giữ ô xanh nhưng ẩn chữ; **3** hiện tất cả đáp án ở cả ô đã đúng và chưa đúng, đồng thời giữ nguyên màu và tiến độ. Ô chưa đúng ở chế độ 3 vẫn có thể mở để nhập và chấm đáp án.
- Tiến độ khách được lưu bằng `localStorage` trong trình duyệt đang dùng. Khi đăng nhập, tiến độ được lưu riêng cho tài khoản và đồng bộ với PostgreSQL; xóa dữ liệu trình duyệt không xóa phần đã đồng bộ.
- Vị trí ô đang học được lưu tự động, gồm bộ học, cột và chế độ danh sách/ôn lỗi/tập trung. Sau khi mở lại trang, nhấn **Tiếp tục ô gần nhất** hoặc **Alt+R** để cuộn đến ô đó và tiếp tục nhập. Vị trí được lưu khi con trỏ chuyển ô; nội dung đang gõ chưa gửi không được lưu.

Chọn **English** hoặc **Tiếng Việt** ở đầu trang (cũng có trong chế độ tập trung) để đổi giao diện và ngôn ngữ của nghĩa. Lựa chọn được lưu cho lần mở tiếp theo; mặc định là tiếng Anh. Cột Hán Việt giữ nguyên. Ô cách đọc nhận hiragana hoặc katakana tương đương. Ô nghĩa nhận một trong các nghĩa của ngôn ngữ đang chọn, bỏ qua hoa thường, khoảng trắng và dấu câu; nghĩa tiếng Việt và Hán Việt nhận cả có dấu hoặc không dấu. Từ không có kanji hiện “—” ở ô Hán Việt.

Tiến độ phần nghĩa, gợi ý và lỗi cần ôn được lưu riêng cho tiếng Anh và tiếng Việt; tiến độ cách đọc và Hán Việt dùng chung. Tiến độ đã có của bản tiếng Anh vẫn được giữ.

### Flashcard từ vựng

Nếu đang dùng cơ sở dữ liệu cũ, chạy `npm run db:migrate` để thêm hai khóa lưu lịch từ vựng; migration không thay đổi tiến độ đã có.

Mở **Flashcard từ vựng / Vocabulary flashcards** để học đủ 880 từ N3 và 214 bộ thủ Kanji. Thẻ chữ lớn nằm giữa màn hình; nút **Toàn màn hình** mở chế độ toàn màn hình của trình duyệt (Esc để thoát). Dùng phím hoặc nút bấm:

- **↑**: hiện nghĩa Anh/Việt, hiragana/katakana và Hán Việt.
- **↓**: hẹn ôn lại sau **7 ngày** và chuyển thẻ.
- **←**: hẹn ôn lại sau **5 phút** và chuyển thẻ.
- **→**: hẹn ôn lại sau **5 giờ** và chuyển thẻ.

Có thể hẹn ôn ngay cả khi chưa mở đáp án. Thẻ đến hạn được ưu tiên trước thẻ mới; thẻ chưa đến hạn được ẩn. Khi học hết, màn hình hiện lịch ôn tiếp theo và tự hiển thị lại thẻ khi đến hạn. Lịch từ vựng và bộ thẻ gần nhất lưu riêng tại `mimikara-word-flashcards-v1` và `mimikara-word-flashcard-deck-v1`, đồng bộ với tài khoản nếu đăng nhập. Mở `/#word-flashcard` để tiếp tục. Không thay đổi lịch ôn của flashcard câu.

### Flashcard câu

Mở **Flashcard câu / Sentence flashcards** từ thanh chế độ học hoặc thanh điều khiển **Tập trung**. Mỗi thẻ hiển thị một **câu tiếng Nhật đầy đủ**; nhấn **Spacebar** hoặc **Show answer / Hiện đáp án** để lật và xem bản dịch Anh/Việt. Thẻ từ vựng và bộ thủ có thêm cách đọc kana và romaji. Ví dụ: 「私は昼ご飯を食べました。」 — *Watashi wa hirugohan o tabemashita.* — “I ate lunch.”

Sau khi lật, chọn mức độ bằng nút hoặc phím tắt:

| Phím | Mức độ | Ôn lại sau |
| --- | --- | --- |
| A | Instant | 1 phút |
| S | Hard | 5 phút |
| D | Medium | 1 ngày |
| F | Ez | 3 ngày |

Thẻ đến hạn được ưu tiên trước thẻ mới. Thẻ chưa đến hạn không xuất hiện; khi ôn hết, trang hiển thị thời gian ôn tiếp theo và tự đưa thẻ trở lại khi đến hạn. Lịch lưu riêng ở `mimikara-flashcards-v1`, dùng chung khi đổi Anh/Việt. Bộ thẻ gần nhất được lưu tại `mimikara-flashcard-deck-v1`; mở lại `/#flashcard` để tiếp tục. Phím tắt không kích hoạt khi đang nhập, giữ phím, dùng Ctrl/Alt/Meta hoặc bộ gõ đang ghép ký tự.

Bộ câu hiện có gồm **881 thẻ N3** (đủ **880 từ vựng N3** và ví dụ 食べる), **40 thẻ N2**, **20 thẻ bộ thủ thông dụng**, và **134 câu ví dụ của toàn bộ 111 mẫu ngữ pháp N3**. Mỗi từ N3 có một câu đầy đủ, cách đọc kana, romaji và bản dịch Anh/Việt; N2 và bộ thủ vẫn là bộ chọn lọc. ID thẻ cũ được giữ nguyên nên lịch ôn đã lưu tiếp tục hoạt động.

Dữ liệu câu nằm trong `scripts/flashcard-sentences/`; chạy `npm run flashcards:build` để kiểm tra đủ từ, tạo romaji từ cách đọc đã biên soạn và cập nhật `src/data/flashcards.json`. Một số lỗi chính tả/cách đọc trong nguồn từ vựng được sửa riêng cho flashcard qua `corrections.json`, kèm ghi chú phân biệt nghĩa khi cần. Ngữ pháp sử dụng trực tiếp ví dụ trong dữ liệu hiện có. Các bài luyện theo ô và lịch ôn flashcard lưu tiến độ riêng.

## Dữ liệu

### Thi thử N3

Nút **Exam / Thi thử** trong danh sách và chế độ tập trung mở `/#exam`. Có đủ sáu đề phần viết tháng 7 và tháng 12 năm 2022, 2023, 2024 từ tài liệu người dùng cung cấp. Trang gốc được giữ dưới dạng ảnh rõ nét, gồm chữ Nhật, furigana, bài đọc và bảng biểu; có chuyển trang, phóng to và phiếu chọn đáp án 1–4. Chọn số câu để mở trang chứa câu đó.

Nhấn **Start exam / Bắt đầu thi** để bắt đầu một đồng hồ 100 phút chung cho phần viết; gợi ý dành 30 phút cho từ vựng và 70 phút cho ngữ pháp/đọc hiểu. Đồng hồ chạy theo hạn kết thúc tuyệt đối, tiếp tục khi rời trang, đóng tab hoặc tải lại. Câu trả lời được lưu ngay; khi hết giờ, bài được nộp tự động. Có thể nộp sớm sau khi xác nhận, rồi xem số câu đúng, phần trăm, thống kê theo phần và đối chiếu từng câu với đáp án. Câu bỏ trống tính là sai. Sau khi nộp không thể sửa đáp án; làm lại tạo một lượt mới. Giữ tối đa 30 lượt gần nhất.

Tài liệu gồm các đề được cộng đồng biên soạn/phục dựng, không kèm đáp án hoặc âm thanh nghe. Theo lựa chọn của người dùng, đáp án luyện tập được giải từ câu hỏi và rà soát độc lập; điểm là tỷ lệ câu đúng với trọng số bằng nhau, **không phải điểm JLPT quy đổi 180 điểm hoặc kết luận đỗ/trượt chính thức**. Không đưa phần nghe vào bài thi này. Có 437 câu phần viết, trong đó 435 câu được chấm. Hai câu từ vựng 20 và 26 của tháng 7/2024 có lỗi trong nguồn nên vẫn hiển thị nhưng không tính điểm; kết quả ghi rõ lý do, không tự sửa trang gốc.

Lượt thi lưu riêng tại `mimikara-exams-v1`, gồm hạn giờ, lựa chọn và trạng thái nộp. Khách dùng bộ nhớ trình duyệt; người đăng nhập lưu riêng theo tài khoản và đồng bộ PostgreSQL. Migration `002_exam_history.sql` mở rộng danh sách dữ liệu được phép mà giữ nguyên tiến độ đã có; chạy `npm run db:migrate` khi cập nhật một cơ sở dữ liệu khác.

`src/data/exams.json` là danh mục câu hỏi/trang và đáp án đã rà soát; `public/exams/pages/` chứa 118 trang phần viết. Nguồn, ánh xạ câu, ghi chú rà soát và checksum nằm trong `scripts/exam-source/`; xem README tại đó để kiểm tra hoặc tái tạo từ đúng PDF gốc. Nội dung Exam được tải khi mở chế độ này, không tải tất cả ảnh khi mở ứng dụng.

### Tiểu thuyết N3

Nút **Đọc tiểu thuyết N3 / Read N3 novel** mở *異世界で日本語しか使えません！*. Truyện gồm 20 chương, hơn 40.000 ký tự Nhật, xoay quanh công việc ở quán ăn, đời sống thị trấn và việc sửa hệ thống nước để tìm đường về nhà. Mỗi chương xếp 44 mục học theo thứ tự nguồn; từ thông dụng có thể xuất hiện tình cờ trước chương được xếp học, nên đây không phải hạn ngạch “lần xuất hiện đầu tiên”. Tất cả 880 ID xuất hiện ít nhất hai lần trong **nội dung truyện**, không tính danh sách học, thẻ tra cứu hay ví dụ ngữ pháp. Từ thông dụng được tái sử dụng nhiều hơn 2–4 lần. Các mục nguồn trùng chữ vẫn giữ ID riêng.

Di chuột, dùng Tab hoặc chạm vào từ để xem dạng từ điển, cách đọc, Hán Việt và nghĩa. Nhấp để ghim thẻ; Escape hoặc nút × đóng thẻ. Gạch chân xanh đánh dấu từ N3; gạch chấm vàng đánh dấu các đoạn ngữ pháp đã chọn theo ngữ cảnh, liên kết với bộ ngữ pháp hiện có (nghĩa, cấu trúc, cách đọc, ví dụ). Các từ khác dùng từ điển bổ sung đóng gói trong `src/data/novel-lexicon.json`. Toàn bộ 1.210 mục từ bổ sung và các từ N3 đều có nghĩa Anh/Việt. Khi chọn tiếng Việt, thẻ chỉ hiển thị nghĩa tiếng Việt, không chuyển sang tiếng Anh. Hán Việt không áp dụng cho từ không có kanji. Thẻ ngữ pháp ghi Hán Việt của **các thành phần kanji**, không xem đó là cách đọc tiếng Nhật của cả cấu trúc.

Chương đang đọc lưu riêng tại `mimikara-novel-chapter-v1`; việc đọc/tra cứu không làm thay đổi tiến độ luyện tập. Có đổi cỡ chữ, bật/tắt đánh dấu, chuyển chương và tải bản truyện văn bản cùng báo cáo đủ 880 từ. Truyện và dữ liệu tra cứu được tải theo yêu cầu khi mở trình đọc; không gọi API từ điển hay dịch thuật khi đọc.

Bản thảo gốc: `scripts/novel-manuscript.txt`. Ký hiệu `{{9|買い物のついでに}}` gắn một đoạn ngữ pháp với ID 9; ký hiệu không xuất hiện khi đọc hoặc tải bản văn bản. Chỉ gắn nghĩa ngữ pháp sau khi xét ngữ cảnh, không tự đánh dấu mọi chuỗi ngắn như 「間」 hay 「まで」. Bộ dò từ lấy dạng từ điển và biến thể chia động từ, ưu tiên từ dài hơn, giữ ID nguồn khi dùng dạng đúng cho lỗi rõ ràng: だまる → だます, 敵とな → 適当な, 鏡面 → 表面, パートナ → パートナー. Nghĩa của 自身 và 協調 cũng được sửa riêng ở trình đọc; dữ liệu luyện tập gốc được giữ nguyên. Thẻ có phần giải thích hiệu chỉnh.

Tái tạo truyện và báo cáo:

```powershell
npm run novel:build
npm test
```

`public/novel-coverage.json` ghi số lần của từng ID, số lần trong chương được xếp học, từ cũ tái sử dụng và đoạn ngữ pháp. Dùng chính bộ dò của trình đọc; không đếm từ ở sidebar hoặc thẻ ví dụ. Ký tự Nhật được đếm theo các vùng Unicode kana/kanji, dấu câu Nhật và ký tự toàn chiều rộng; không tính khoảng trắng, chữ Latin, tiêu đề chương hay ký hiệu chú thích.

Sau khi sửa bản thảo, nếu thêm từ ngoài bộ tra cứu, tái tạo từ điển bổ sung bằng công cụ build (cần `JMdict_e.xml` được tải riêng và mạng để đọc Unihan; không gửi nội dung truyện):

```powershell
python scripts/build_novel.py
node scripts/tokenize_novel.mjs
python scripts/build_novel_lexicon.py path/to/JMdict_e.xml
npm run novel:audit
```

Kuromoji chỉ là phụ thuộc phát triển để tách từ lúc nhập, không được đưa vào trình đọc. `scripts/novel-lexicon-review.json` ghi các mục cần rà soát; bản hiện tại không còn mục trống. Những trợ từ, tên riêng, từ cơ bản, cách đọc theo ngữ cảnh và lỗi rõ ràng được biên tập trong importer. Nghĩa hỗ trợ có thể gồm nhiều nghĩa từ điển, không phải bản dịch nguyên câu.

`scripts/novel-lexicon-vi.tsv` lưu nghĩa tiếng Việt đã biên tập cho 831 mục JMdict bổ sung, theo chữ từ điển thay vì ID sinh tự động. `scripts/novel_vi.py` áp dụng bảng này và từ chối xuất dữ liệu khi còn mục thiếu nghĩa tiếng Việt; importer gọi cùng hàm khi tạo lại từ điển. Sau khi sửa riêng bảng dịch, chạy `python scripts/novel_vi.py`. Từ mới cần được dịch trước khi xuất bản. Bản dịch được đóng gói để tra cứu không cần mạng; không dùng dịch tự động lúc đọc.

### Ngữ pháp N3

**Ngữ pháp N3** dùng cùng danh sách, ôn lỗi, tổng quan, thu phóng và chế độ tập trung như từ vựng. Hai cột luyện tập là **Cấu trúc** và **Ngữ nghĩa**; mở **Ví dụ** dưới mẫu để xem câu Nhật, cách đọc có trong nguồn và bản dịch theo ngôn ngữ đang chọn. Ví dụ không tính vào tiến độ. Cấu trúc không có trong nguồn hiện “—” và không tính vào tổng số ô (200 ô có thể luyện).

Nhập một trong các cấu trúc hoặc nghĩa được liệt kê. Cấu trúc giữ ký hiệu của nguồn (`Vru`, `N-no`, `Vte`, `Vた`, `Vます`...), nhận cả ký hiệu Nhật tương đương (`Vる`, `Nの`, `Vて`, `Vた`, `Vない`), bỏ qua hoa thường, khoảng trắng và dấu câu, nhưng phân biệt âm Nhật có dấu dakuten. Trong tập trung, mỗi cột có chế độ hiển thị riêng; phím Alt+Z/X/C/V di chuyển qua hai cột và bỏ qua cấu trúc trống. Tiến độ cấu trúc dùng chung Anh/Việt, còn nghĩa lưu riêng từng ngôn ngữ theo ID `n3-grammar:…` trong kho tiến độ hiện có.

`src/data/n3-grammar.json` chứa đủ 111 mẫu và 134 câu ví dụ từ trang PDF 4–31 của `Ebook n3.pdf` (Riki nihongo) do người dùng cung cấp. Giữ thứ tự và các mẫu trùng nhau nhưng khác cách dùng. Tiếng Việt theo nguồn; tiếng Anh là bản dịch bổ sung. Hai mục 15–16 thiếu dòng nghĩa nên được bổ sung từ ví dụ. Các lỗi in rõ ràng trong câu Nhật được sửa có lưu nguyên văn trong `sourceJapanese`; mở **Nguyên văn nguồn** để đối chiếu. Các chỗ nguồn thiếu bản dịch hoặc khác nghĩa giữa câu Nhật–Việt được ghi rõ trong dữ liệu nhập và chú thích.

Tái tạo JSON từ bản chép đã đối chiếu từng trang:

```powershell
python scripts/import_n3_grammar.py
python scripts/validate_data.py
```

Để OCR lại nguồn, cài Poppler và dùng Tesseract.js có sẵn của dự án. Lần đầu OCR có thể cần mạng để tải mô hình Nhật/Việt. Tạo ảnh và văn bản nháp trong thư mục tạm:

```powershell
pdftoppm -f 4 -l 31 -scale-to 1700 -png 'C:\Users\hungw\Downloads\Ebook n3.pdf' "$env:TEMP\n3_grammar_source"
node scripts/ocr_n3_grammar.mjs "$env:TEMP" n3_grammar_source
```

Đối chiếu OCR với ảnh từng trang trước khi cập nhật `scripts/n3_grammar_reviewed.txt`, rồi chạy lại importer. File đã rà soát dùng `|` để tách cột, `;` để tách đáp án thay thế, và dòng `+` để thêm ví dụ cho mục trước. Các bản sửa lỗi, chú thích và bản dịch bổ sung nằm trong importer. Không tự dùng OCR thô làm dữ liệu học. Trang học không cần tệp PDF hay OCR khi chạy.

Hai tập dữ liệu đã được đóng gói vào `src/data/n3.json` và `src/data/n2.json`; người dùng không cần tệp gốc để chạy trang.

`src/data/radicals.json` chứa đủ 214 bộ thủ theo thứ tự Kangxi, trích từ `214_Bo_Thu_Kanji_So_Tay_Hoc_Tap.pdf` người dùng cung cấp: chữ chuẩn, nghĩa Việt, số nét và biến thể. Tên Nhật còn thiếu và nghĩa Anh được bổ sung từ Kanji alive (CC BY 4.0); Hán Việt dùng tên bộ thủ truyền thống. Tên Nhật là tên gọi bộ thủ, không nhất thiết là âm đọc chữ đứng độc lập. Bộ thủ dùng cùng các chức năng luyện tập, tổng quan, tập trung và ôn lỗi; tiến độ riêng theo ID `radicals:…`, nghĩa Anh/Việt lưu riêng như N2/N3. Tái tạo dữ liệu bằng `python scripts/import_radicals.py path/to/214_Bo_Thu_Kanji_So_Tay_Hoc_Tap.pdf` (cần `pypdf` và mạng khi nhập lại; trang học không cần mạng).

- N3 được chuyển từ bảng Excel người dùng cung cấp. Các cách đọc còn trống và âm Hán Việt được bổ sung, đối chiếu với Unihan `kVietnamese` và dữ liệu kanji được dẫn trong [ATTRIBUTION.md](ATTRIBUTION.md).
- N2 được tách theo từng dòng/cột từ PDF người dùng cung cấp, OCR Nhật–Việt và so số thứ tự cùng một danh sách văn bản độc lập. Những chỗ OCR hoặc danh sách văn bản mâu thuẫn rõ đã được sửa trong `scripts/n2_overrides.json`.
- `scripts/validate_data.py` kiểm tra đủ số thứ tự, không trùng, và dữ liệu cần thiết ở mỗi mục. Bài kiểm thử Vitest chạy lại các kiểm tra này.

Các script trong `scripts/` dùng để tái tạo dữ liệu từ tài liệu nguồn. Chúng cần Python cùng `openpyxl`, `Pillow`, `lxml`, Poppler, Tesseract.js và kết nối mạng để tải dữ liệu tham chiếu; việc học và chạy ứng dụng không cần các bước này.

Sau khi nhập lại dữ liệu từ nguồn tiếng Việt, chạy `python scripts/import_english_meanings.py path/to/JMdict_e.xml` để áp dụng nghĩa tiếng Anh. Các nghĩa đã rà soát nằm trong `scripts/english_meanings_overrides.json`. Nguồn JMdict và giấy phép được ghi trong [ATTRIBUTION.md](ATTRIBUTION.md).

`src/data/vi.json` chứa toàn bộ nghĩa tiếng Việt được lấy nguyên vẹn từ phiên bản Git `92d0a2b`, trước khi đổi nội dung sang tiếng Anh. Hai ngôn ngữ liên kết bằng ID mục từ và dùng chung dữ liệu tiếng Nhật, cách đọc, Hán Việt.
### Novel narration

All 20 chapters appear in one continuous reading page. The chapter selector jumps to the chapter heading without hiding other chapters and restores the selected chapter when reopened. Sentence playback can start anywhere in the full novel, switching to the correct audio chapter automatically.

The novel reader includes Japanese narration for all 20 chapters (about 129 minutes). Press **Listen** to play, change speed from 0.5× to 2×, seek on the timeline, skip ±30 seconds, or move between chapters. Playback advances automatically through the remaining chapters. The current spoken sentence is highlighted in gold. The sticky **Free view / Automatic view** switch lets you keep your reading position or follow the highlighted sentence, without stopping narration. Reading settings and audio controls share one sticky panel. Use the ↑/↓ button to hide or show all settings without stopping playback. The prose fills a balanced, wider column; vocabulary and grammar cards appear next to the hovered/focused word, prefer the space below it, and flip above if necessary. Cards remain within the viewport and clear the controls, with internal scrolling for long entries. Study targets, text downloads, coverage reports, and dictionary attribution appear after chapter 20. Hovering a word opens quick lookup, including during narration. Clicking pins the card, keeps that exact word occurrence green and its sentence play button visible until unpinned, and temporarily disables quick lookup for other words; clicking another word replaces the pin. If the pinned word leaves the visible reading area, a small pin/close control appears at the corresponding top or bottom edge. Its pin button returns to the word and switches to Free view so narration does not pull the page away; its × button clears the pin and restores quick lookup. Chapter changes preserve a pinned word. Word and sentence clicks never seek the audio. Only the ▶ control at the start of a sentence starts playback from that sentence; it appears for the sentence currently hovered, focused, or clicked.

Download the current chapter or the complete novel as an MP3 using the player links. Recordings are bundled static assets: listeners do not need a speech-service account, API key, or backend. Audio loads only for the selected chapter; the complete MP3 is downloaded only when requested. The chapter files and full download total about 124 MB.

To regenerate narration after editing the manuscript:

```powershell
npm run novel:build
python -m pip install -r scripts/requirements-audio.txt
npm run novel:audio
```

The build-only generator uses Microsoft Edge's online TTS via [edge-tts](https://github.com/rany2/edge-tts), with Japanese voice `ja-JP-KeitaNeural`. Generation sends the original story text to that speech service and requires internet access. It caches source hashes, MP3 audio, and word-boundary metadata in the ignored `.novel-audio-cache/` directory, with at most four simultaneous requests. FFmpeg provided by `imageio-ffmpeg` measures decoded audio and encodes the bundled MP3s. It does not add dependencies to the frontend.

`scripts/prepare_novel_audio.mjs` uses the reader's sentence splitter, including grammar annotations and Japanese closing quotes. `scripts/build_novel_audio.py` aligns actual speech word timings to all 1,949 source sentences, rejects missing or unmatched prose, and produces `src/data/novel-audio.json` plus `public/novel-audio/`. The test suite verifies every sentence against the manuscript and checks timeline ordering and audio assets. Regenerate the recordings whenever the novel changes.

### Play & learn (`#game`)

Open **Play & learn / Chơi & học** from the study toolbar (also available in focus mode).
Choose a ramen shop, directions, or job interview scene and equip 3–5 cards. Each
run lasts at most 60 seconds, including answer feedback. Warm up allows 10 seconds
per question; Mastery cycles through meaning, optional listening, kana input and
context, reducing the response window from 10 to 2 seconds as the combo grows.
Questions avoid immediate repeats and shuffle answer positions and distractors.

Japanese listening uses browser speech synthesis and is opt-in. Test the voice
before a run; unsupported browsers can play without listening. Kana answers accept
normalized Hiragana or Katakana. Correct answers earn 12 EXP and 3 gold; the first
successful run in a scene unlocks its two additional cards. Incorrect answers and
timeouts reset the combo and appear in the post-game review. Finish early to
collect rewards for answers already completed.

Word Duel currently compares a personal best for the same language, scene,
difficulty, audio setting and deck. It does **not** match online opponents.
Rewards and records use the account-scoped `mimikara-game-v1` study key, or local
browser storage for guests. Apply migration `004_game_progress.sql` with
`npm run db:migrate` before using account sync against an existing database.

### Header vocabulary search

The header search looks across N3, N2, radicals, N3 grammar, the story lexicon and
game vocabulary. Search by Japanese, kana (including half-width Katakana),
Sino-Vietnamese, or English/Vietnamese meanings; Vietnamese accents are optional.
Exact matches appear first. Results show reading, meaning and collection, with up
to 30 matches displayed at a time. On the study screen, select a list entry to
switch to its collection and scroll to the word. Use Arrow Down or Enter to focus
the first matching list entry, Tab to browse, and Escape to dismiss results.
The search index loads when the field is first opened.
### Ôn thi thần tốc

Mở **Ôn thi thần tốc** từ thanh chế độ học hoặc truy cập `/#speed-exam`.
Ngân hàng 600 câu N3 do Codex tự biên soạn được tập hợp tại `src/speedExamData.ts`. Dữ liệu nằm trong 15 tệp JSON theo phần/dạng ở `src/data/speed-exam/`, mỗi dạng 40 câu; không lấy từ đề thi chính thức:

| Phần | Số câu | Các dạng |
| --- | ---: | --- |
| Từ vựng | 200 | Cách đọc kanji, cách viết, từ trong ngữ cảnh, diễn đạt đồng nghĩa, cách dùng từ (40 câu/dạng) |
| Ngữ pháp | 120 | Chọn cấu trúc, sắp xếp câu ★, ngữ pháp đoạn văn (40 câu/dạng) |
| Đọc hiểu | 120 | Đoạn ngắn, đoạn vừa, tra cứu thông tin (20 bài × 2 câu/dạng) |
| Nghe hiểu | 160 | Hiểu nhiệm vụ, hiểu điểm chính, diễn đạt theo tình huống, phản hồi nhanh (40 câu/dạng) |

Mọi câu có 4 lựa chọn trong chế độ luyện tập, kể cả các dạng nghe vốn có số lựa chọn khác trong đề chuẩn. Bấm/chạm đáp án hoặc nhấn ← A, ↑ B, ↓ C, → D. Đáp án đúng hiện xanh lá trong 2 giây rồi sang câu mới; đáp án sai hiện đỏ trong 2 giây rồi mở lại cùng câu. Khóa mọi lựa chọn trong thời gian phản hồi. Sau câu cuối hiển thị số lần chọn sai và nút luyện lại. Lượt luyện hiện chỉ giữ trong bộ nhớ của trang.

Phần nghe dùng Web Speech API (`ja-JP`, ưu tiên giọng Nhật có sẵn), có nút nghe lại/dừng và thông báo lỗi. Thiết bị cần trình duyệt hỗ trợ tổng hợp giọng nói tiếng Nhật; chất lượng giọng và nhu cầu mạng tùy trình duyệt/hệ điều hành. Không hiện bản chép lời khi làm câu nghe. Đổi câu hoặc rời chế độ sẽ dừng giọng đọc và dọn bộ đếm thời gian.

Menu **Filter · Lọc câu hỏi** nhóm câu theo Từ vựng, Ngữ pháp, Đọc hiểu và Nghe hiểu. Có thể chọn toàn bộ một phần, chọn từng dạng hoặc kết hợp nhiều dạng thuộc nhiều phần; số câu hiển thị ngay cạnh từng lựa chọn. Các kỹ năng đọc chi tiết được gom vào ba dạng chính: đoạn ngắn, đoạn vừa, tra cứu thông tin. Menu **Sort · Sắp xếp** hỗ trợ thứ tự gốc, đảo ngược, nhóm theo phần/dạng và ngẫu nhiên. Thứ tự ngẫu nhiên giữ ổn định suốt lượt làm bài; bấm luyện lại để xáo trộn lượt mới. Đổi lọc hoặc sắp xếp sẽ dừng âm thanh, hủy phản hồi đang chờ và bắt đầu lại tiến độ/số lần sai cho bộ câu mới. Nếu bỏ hết lựa chọn, giao diện hướng dẫn chọn câu thay vì báo hoàn thành.

Mỗi câu có mã ổn định, bốn lựa chọn, đáp án và giải thích tiếng Việt; câu đọc có bài đọc, câu nghe có `audioText`. Thuộc tính `batch` chia 600 câu thành 12 đợt × 50 để rà soát. Tổng số trên màn hình, Filter và nút chọn tất cả đều lấy từ dữ liệu. Chạy `npm run speed-exam:audit` để kiểm tra mã/câu trùng, cấu trúc lựa chọn, đáp án ★, số lượng theo đợt và nguồn đọc/nghe gần trùng. Xem quy ước biên soạn và ghi chú rà soát trong `src/data/speed-exam/README.md`.
