# Font cho PDF tiếng Việt

## ✅ Font đã được cài đặt

File `Roboto-Regular.ttf` đã có trong thư mục này và hỗ trợ đầy đủ tiếng Việt.

## Nếu cần download lại

Chạy script trong thư mục root của project:

```bash
node download-font.cjs
```

Hoặc download thủ công:

### Cách 1: Download trực tiếp từ Google Fonts

1. Truy cập: https://fonts.google.com/specimen/Roboto
2. Click "Download family"
3. Extract file zip
4. Copy `Roboto-Regular.ttf` vào thư mục này (`public/fonts/`)

### Cách 2: Từ GitHub

```bash
# Linux/Mac
wget https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Regular.ttf

# Windows PowerShell
Invoke-WebRequest -Uri "..." -OutFile "Roboto-Regular.ttf"
```

## Vietnamese Support

Roboto Regular hỗ trợ đầy đủ các ký tự tiếng Việt:

- ✅ Dấu sắc, huyền, ngã, hỏi, nặng
- ✅ Các ký tự đặc biệt: ă, â, ê, ô, ơ, ư, đ
- ✅ Test case: "Báo cáo trải nghiệm về lập trình Robotics và Coding"
- ✅ Ký tự đặc biệt: "ễ" (như trong "nghiệm"), "ữ" (như trong "như"), etc.

## Troubleshooting

**Lỗi: "WinAnsi cannot encode..."**
→ Font chưa được load. Chạy `node download-font.cjs` trong thư mục root.

**File size:** ~298KB (Roboto-Regular.ttf)
