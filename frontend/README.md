# Ads Management — Frontend

Giao diện quản trị (admin dashboard) cho hệ thống quản lý quảng cáo / truyền
thông. Xây dựng bằng **React 19 + Vite + TypeScript + Tailwind CSS**, kết nối tới
[backend](../backend) qua REST API.

## Yêu cầu

- Node.js 18+
- Backend đang chạy (mặc định `http://localhost:3001`)

## Cài đặt & chạy

```bash
npm install

# Cấu hình môi trường
cp .env.example .env.local   # rồi chỉnh VITE_API_URL nếu cần

npm run dev                  # http://localhost:3000
```

## Build & xem thử

```bash
npm run build                # build ra dist/
npm run preview              # chạy thử bản build
```

## Scripts

| Lệnh              | Mô tả                          |
|-------------------|--------------------------------|
| `npm run dev`     | Chạy dev server (cổng 3000)    |
| `npm run build`   | Build production ra `dist/`    |
| `npm run preview` | Xem thử bản build              |
| `npm run lint`    | Kiểm tra kiểu (`tsc --noEmit`) |
| `npm run clean`   | Xóa thư mục `dist/`            |

## Biến môi trường

Xem [.env.example](.env.example):

- `VITE_API_URL` — URL của backend API (vd `http://localhost:3001`)

## Tính năng chính

- Đăng nhập + phân quyền theo vai trò (Admin / Operator / Viewer)
- Quản lý nhà quảng cáo, media, loại quảng cáo, đơn quảng cáo
- Nhập liệu (data entry) và báo cáo lợi nhuận / doanh thu
- Đối soát (settlement), khu cách ly dữ liệu (quarantine)
- Nhật ký thao tác (operation logs)
- Quản lý người dùng & vai trò
- Module dữ liệu/báo cáo Yiyi

## Cấu trúc

```
src/
  main.tsx, App.tsx, AppContext.tsx   # entry, routing, state toàn cục
  api/        # yiyiApi
  lib/        # bffApi (client REST), types, i18n, helpers
  components/  # Sidebar, Topbar, Table, Modal, DatePicker, ...
  pages/       # các màn hình: Login, Advertiser, Media, DataEntry,
               # Reports, Settlement, QuarantineMgmt, RoleManagement,
               # UserManagement, System, YiyiData, YiyiReport, ...
```
