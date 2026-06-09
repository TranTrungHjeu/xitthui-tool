# MindX LMS Teacher Dashboard

Công cụ hỗ trợ giáo viên MindX: Đồng bộ trạng thái buổi học, xem danh sách học sinh cần nhận xét, tạo nhận xét nhanh và đồng bộ nhận xét lên MindX LMS Gateway.

---

## 1. Cách chạy ứng dụng

### Yêu cầu hệ thống

- **Node.js**: Phiên bản 16 trở lên.
- **npm**: Quản lý gói thư viện đi kèm Node.js.

### Cấu hình biến môi trường (`.env`)

Trước khi chạy ứng dụng, hãy đảm bảo bạn đã tạo file `.env` ở thư mục gốc của dự án với các cấu hình sau:

```env
# Cấu hình Firebase & MindX LMS API
FIREBASE_API_KEY=your_firebase_api_key
LMS_BASE_GRAPHQL=https://gateway.mindx.edu.vn/graphql
```

### Cài đặt và khởi chạy

1. **Cài đặt các gói thư viện phụ thuộc:**

   ```bash
   npm install
   ```

2. **Khởi chạy ứng dụng:**

   ```bash
   npm start
   ```

   _Dashboard sẽ chạy tại địa chỉ: `http://localhost:3000`_

---

## 2. Cách xử lý Đăng nhập, Giữ Session và Refresh Token

Hệ thống quản lý phiên làm việc một cách chặt chẽ giữa React Frontend, Node.js Backend và Firebase Authentication của MindX LMS:

### A. Luồng Đăng nhập (Login Flow)

1. Giáo viên nhập `Email` và `Mật khẩu` trên form đăng nhập của Dashboard.
2. Form đăng nhập gửi yêu cầu POST đến endpoint `/api/login` trên Express Backend.
3. Backend gọi REST API của Firebase (`accounts:signInWithPassword`) để xác thực thông tin tài khoản và nhận về `firebaseIdToken` (ID Token) và `firebaseUid`.
4. Backend sử dụng `firebaseIdToken` để truy vấn thông tin user MindX qua cổng Gateway (`User_getByFirebaseId`) nhằm lấy `lmsUserId`.
5. Tiếp theo, backend thực hiện lấy `customToken` từ Gateway và đổi nó lấy **LMS ID Token** và **Refresh Token** thông qua Firebase (`accounts:signInWithCustomToken`).
6. Khi đăng nhập thành công, Backend trả về toàn bộ thông tin token cho Frontend.
7. Frontend lưu trữ thông tin session (gồm `lmsToken` và `lmsRefreshToken`) vào **`localStorage`** dưới khóa `mindx_lms_user`.

### B. Giữ Session khi Tải lại Trang (Session Persistence)

1. Khi giáo viên tải lại trang hoặc truy cập vào Dashboard ở phiên làm việc mới:
   - Một màn hình chờ (`authChecking`) với thông điệp _"Đang xác thực phiên làm việc..."_ sẽ hiển thị.
2. Ứng dụng đọc dữ liệu đã lưu trong `localStorage`.
3. Nếu tồn tại session cũ, Frontend sẽ tự động gửi yêu cầu kiểm tra token đến `/api/test-token` kèm theo `lmsToken` hiện tại.
4. Nếu token vẫn còn hạn sử dụng (hạn mặc định của Firebase ID Token thường là 1 giờ), backend trả về kết quả hợp lệ, và giáo viên truy cập thẳng vào Dashboard mà không cần đăng nhập lại.

### C. Cơ chế Tự động Làm mới Token (Auto Refresh Token)

Trong trường hợp `lmsToken` đã hết hạn (khi gọi `/api/test-token` báo lỗi hoặc không thành công):

1. React Frontend sẽ kiểm tra xem trong session lưu trữ có chứa `lmsRefreshToken` (Refresh Token) hay không.
2. Nếu có, Frontend tự động gửi yêu cầu POST tới endpoint `/api/refresh-token` trên Backend kèm theo `refreshToken`.
3. Backend gọi API đổi token của Firebase (`securetoken.googleapis.com/v1/token`) bằng phương thức `grant_type=refresh_token`.
4. Khi nhận được cặp token mới từ Firebase:
   - Backend phản hồi về Frontend cặp token mới: `lmsToken` (ID Token mới) và `lmsRefreshToken`.
   - Frontend cập nhật ngay lập tức thông tin mới này vào `localStorage`.
   - Ứng dụng tự động đăng nhập tiếp tục phiên làm việc cho giáo viên mà không có bất kỳ gián đoạn nào.
5. Nếu quá trình refresh thất bại (ví dụ: Refresh Token hết hạn hoặc bị thu hồi trên Firebase), session cũ sẽ bị xóa khỏi `localStorage` và giáo viên được điều hướng về trang đăng nhập để đăng nhập lại bằng mật khẩu.
