# Chế độ tác tử

Tác tử lấy một thư mục bạn chọn làm dự án và chạy Claude Code hoặc Codex có trên máy tính này ngay trong thư mục đó. AI tự đọc tài liệu trong thư mục, tạo tệp mới, dùng kỹ năng và tập lệnh, và sửa các tài liệu đang mở trong GenOffice. Hãy dùng nó cho những việc cần dựa vào nhiều tài liệu.

## Cần chuẩn bị

- Một gói đăng ký Claude hoặc gói đăng ký ChatGPT đã kết nối trong **Cài đặt ▸ AI**. Chủ đề "Kết nối gói đăng ký" giải thích cách làm.
- Một thư mục chứa tài liệu của bạn. Không thể chọn cả một ổ đĩa, toàn bộ thư mục người dùng, hay thư mục chứa dữ liệu đăng nhập hoặc dữ liệu ứng dụng.

## Bắt đầu một phiên

1. Ở Trang chủ, nhấn thẻ **Tác tử**. Cửa sổ tác tử sẽ mở riêng.
2. Nhấn **Chọn thư mục…** để chọn thư mục dự án. Các thư mục bạn dùng gần đây được liệt kê dưới **Thư mục gần đây**.
3. Trong **Chương trình**, chọn Claude Code hoặc Codex. Không thể chọn chương trình chưa được kết nối.
4. Trong **Khi nào hỏi bạn**, chọn cách tác tử xin phép (xem bảng bên dưới).
5. Lần đầu tiên, hãy đọc **Trước khi bắt đầu** rồi nhấn **Tôi đã hiểu**.
6. Nhấn **Bắt đầu**, viết điều bạn muốn làm, rồi nhấn **Gửi**.

Mỗi cửa sổ là một phiên. Đóng cửa sổ hoặc nhấn **Dừng** sẽ kết thúc phiên, và chương trình mà GenOffice đã khởi động cho phiên đó cũng tắt theo. Phiên cũng kết thúc nếu bạn không gửi gì trong 30 phút.

## Cách tác tử hỏi

| Lựa chọn                           | Làm ngay                                                 | Hỏi trước                                               |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| **Hỏi trước mỗi lệnh** (mặc định)  | Đọc và ghi tệp trong thư mục dự án, sửa tài liệu đang mở | Chạy lệnh hoặc tập lệnh, đọc bên ngoài thư mục dự án    |
| **Hỏi trước khi ghi và chạy lệnh** | Đọc tệp trong thư mục dự án, sửa tài liệu đang mở        | Ghi tệp, chạy lệnh hoặc tập lệnh, đọc bên ngoài thư mục |
| **Tin tưởng dự án này**            | Gần như mọi thứ                                          | Đọc bên ngoài thư mục dự án                             |

Khi tác tử hỏi, cửa sổ sẽ cho thấy nó muốn làm gì (toàn bộ lệnh, đường dẫn tệp). Nhấn **Cho phép** hoặc **Từ chối**.

Dù bạn chọn cách nào, tác tử cũng không:

- Ghi đè lên tệp của một tài liệu đang mở trong một thẻ GenOffice. Tài liệu đang mở được sửa thông qua ứng dụng, nên thay đổi hiện ngay trong trình soạn thảo và có thể hoàn tác bằng chức năng hoàn tác của trình soạn thảo.
- Ghi ra bên ngoài thư mục dự án.
- Đụng đến dữ liệu đăng nhập của Claude hay Codex, hoặc thư mục dữ liệu của GenOffice.

## Claude Code và Codex

- **Codex** chạy lệnh trong không gian cách ly riêng của nó, kể cả những lệnh bạn cho phép. Nó chỉ có thể ghi vào thư mục dự án, internet bị chặn, và nó không đọc được các tệp cá nhân của bạn bên ngoài dự án. Khi một phiên bắt đầu, GenOffice kiểm tra trước xem việc cách ly này có hoạt động trên máy tính này không, và sẽ không khởi động nếu không.
- **Claude Code** không thể cách ly lệnh trên Windows. Một lệnh bạn cho phép có thể truy cập toàn bộ máy tính và internet. Vì vậy, với **Tin tưởng dự án này**, bộ kiểm tra riêng của Claude Code sẽ thay bạn kiểm tra từng hành động.

Tài liệu người khác gửi cho bạn có thể chứa chỉ dẫn ẩn bảo AI làm việc khác. Với thư mục chứa tài liệu bạn không rõ nguồn gốc, hãy dùng một trong các lựa chọn có hỏi.

## Ghi chú dự án và kỹ năng

- Nếu thư mục có `CLAUDE.md` hoặc `AGENTS.md`, nội dung của tệp đó được đưa cho tác tử làm chỉ dẫn. Hãy ghi vào đó những điều cần giữ mỗi lần: giọng văn, thuật ngữ, định dạng của tài liệu cần tạo.
- Claude Code nhận một bản sao các kỹ năng ở những nơi sau: `.claude/skills` trong thư mục dự án, `.ieumoffice/skills` và `.claude/skills` trong thư mục người dùng, và kỹ năng của các plugin Claude đã cài. Số kỹ năng dùng được hiện ra bên dưới dòng báo phiên đã bắt đầu.
- Codex tự đọc thư mục kỹ năng của riêng nó.
- Các chương trình mà tập lệnh của kỹ năng sử dụng (Python, v.v.) phải được cài trên máy tính này.

## Tệp mới và tài liệu đang mở

- Tệp mới do tác tử tạo được lưu trong thư mục dự án. Nhấn **Mở** ở dòng đó trong nhật ký tiến trình để mở tệp trong một thẻ GenOffice.
- Để tác tử sửa một tài liệu đang mở, trước tiên hãy mở tài liệu đó trong GenOffice rồi nêu tên nó trong yêu cầu.
- Tài liệu bạn mở trong lúc phiên đang chạy có thể được sửa từ tin nhắn tiếp theo của bạn.

## Quyền riêng tư và mức sử dụng

- Những gì bạn đã ẩn khỏi AI chỉ được giữ kín khi ứng dụng đọc một tài liệu đang mở trong GenOffice cho tác tử. Các tệp tác tử tự đọc từ thư mục sẽ được gửi nguyên trạng.
- Tác tử làm việc qua nhiều bước, nên dùng nhiều hạn mức gói đăng ký của bạn hơn bảng AI. Khi hết hạn mức, yêu cầu sẽ thất bại; tác tử không bao giờ chuyển sang AI khác hay sang một kết nối tính phí.

## Nếu có sự cố

| Cửa sổ hiển thị                               | Việc cần làm                                          |
| --------------------------------------------- | ----------------------------------------------------- |
| **Chưa kết nối**                              | Đăng nhập vào chương trình đó trong **Cài đặt ▸ AI**. |
| **Không thể dùng thư mục này**                | Chọn một thư mục chỉ chứa tài liệu công việc của bạn. |
| **Codex không thể mở hộp cát**                | Cập nhật Windows, hoặc chọn Claude Code.              |
| **Bạn đã dùng hết hạn mức gói đăng ký**       | Gửi lại sau khi hạn mức được đặt lại.                 |
| **Chương trình quá cũ để dùng chế độ tác tử** | Cập nhật chương trình đó, rồi nhấn **Phiên mới**.     |
