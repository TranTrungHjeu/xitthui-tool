# Hướng dẫn xử lý lỗi Firebase "CONFIGURATION_NOT_FOUND"

Khi bạn nhận được lỗi:
```json
{
    "success": false,
    "error": "Firebase login failed: CONFIGURATION_NOT_FOUND"
}
```

## 1. Nguyên nhân gây ra lỗi
Lỗi này xảy ra vì 2 lý do:
1. API Key mà bạn đang sử dụng (`AIzaSy...`) thuộc về một project Firebase cá nhân của bạn (`ledanxam01`), và project này **chưa được bật tính năng Firebase Authentication (Đăng nhập bằng Email/Mật khẩu)**.
2. **QUAN TRỌNG HƠN:** Để có thể đăng nhập và đồng bộ dữ liệu với hệ thống **MindX LMS** (`https://gateway.mindx.edu.vn`), ứng dụng bắt buộc phải tạo ra một token hợp lệ của hệ thống MindX. Nếu bạn dùng Firebase API Key cá nhân, token tạo ra sẽ bị hệ thống MindX từ chối.

Do đó, bạn **không thể dùng Firebase API Key cá nhân**, mà phải lấy được **Firebase API Key của chính MindX LMS**.

---

## 2. Cách lấy MindX Firebase API Key chính xác

Vì bạn là giáo viên và có tài khoản MindX LMS, bạn có thể dễ dàng lấy API Key này bằng cách theo dõi các request mạng khi đăng nhập vào hệ thống chính thức của MindX:

**Bước 1:** Mở trình duyệt web (Google Chrome, Edge, Cốc Cốc...) và truy cập vào trang đăng nhập của hệ thống MindX LMS:
👉 `https://lms.mindx.edu.vn` (Hoặc trang LMS mà bạn thường dùng).

**Bước 2:** Nhấn phím **`F12`** (hoặc Chuột phải -> Chọn **Inspect** / **Kiểm tra**) để mở công cụ dành cho nhà phát triển (Developer Tools).

**Bước 3:** Chuyển sang tab **`Network`** (Mạng). Bạn có thể check vào ô `Preserve log` nếu có để tránh bị mất log khi chuyển trang.

**Bước 4:** Tiến hành nhập Email và Mật khẩu của bạn trên trang MindX và bấm **Đăng nhập**.

**Bước 5:** Trong tab `Network` lúc này, hãy để ý và tìm kiếm một request có tên bắt đầu bằng:
`verifyPassword?key=...` hoặc `accounts:signInWithPassword?key=...`

**Bước 6:** Click vào request đó, nhìn sang phần `Request URL`, bạn sẽ thấy một đường dẫn dạng như sau:
`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSy...`

**Bước 7:** Hãy copy chính xác đoạn mã sau chữ `key=` (ví dụ: `AIzaSy...`). Đó chính là **MindX Firebase API Key** thực sự mà bạn cần!

---

## 3. Cập nhật lại vào hệ thống của bạn

Sau khi đã copy được Key chuẩn:

1. Mở file `backend/.env` trong project này.
2. Sửa lại dòng `MINDX_FIREBASE_API_KEY` thành key bạn vừa copy:
```env
MINDX_FIREBASE_API_KEY=AIzaSy_GHI_CHUAN_KEY_CUA_MINDX_VAO_DAY
```
3. Lưu file lại.
4. Mở terminal đang chạy backend (port 4444) và khởi động lại (`rs` hoặc `Ctrl + C` rồi chạy lại `npm run dev`).
5. Quay lại trang Dashboard Frontend (`http://localhost:3333`) và thử đăng nhập lại. Chắc chắn sẽ thành công!