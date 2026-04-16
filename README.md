# Ad Management

Hệ thống quản lý nhập liệu, bảng tổng và hạ nguồn cho các nhóm quảng cáo `SM`, `360`, `Baidu JS`, `Other`, kèm màn nhập liệu `Yiyi`.

## Cấu trúc dự án

- Backend: thư mục gốc của repo
- Frontend Vite/React: `./ads-management`
- Database Prisma/SQLite: `./prisma`

## Yêu cầu môi trường

- Node.js 20+
- npm

## Cấu hình môi trường

1. Tạo file `.env` ở thư mục backend từ mẫu `.env.example`.
2. Cập nhật các biến sau:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-with-a-strong-jwt-secret"
PORT=3001
```

3. Frontend dùng file `ads-management/.env`:

```env
VITE_API_URL=http://localhost:3001
```

Lưu ý:

- Không commit `.env`, `.db`, `.sqlite` hoặc `prisma/dev.db`.
- `JWT_SECRET` phải đổi sang chuỗi mạnh khi triển khai thật.

## Cài đặt

### Backend

```powershell
npm install
```

### Frontend

```powershell
cd ads-management
npm install
```

## Khởi tạo database

Chạy tại thư mục backend:

```powershell
npm run db:push
npm run seed
```

`seed` sẽ xóa dữ liệu cũ và tạo dữ liệu mẫu mới.

## Tài khoản mẫu sau khi seed

- Admin: `admin / admin123`
- User nhập liệu: `editor / editor123`

Khuyến nghị đổi mật khẩu ngay sau khi dùng seed.

## Chạy hệ thống

### Chạy backend

```powershell
npm run dev
```

Backend mặc định chạy tại `http://localhost:3001`.

### Chạy frontend

```powershell
cd ads-management
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173`.

## Build production

### Backend

```powershell
npm run build
npm run start
```

### Frontend

```powershell
cd ads-management
npm run build
npm run preview
```

## Chức năng chính

### 1. Nhập liệu

- `Nhập liệu -> SM`
- `Nhập liệu -> 360`
- `Nhập liệu -> Baidu JS`
- `Nhập liệu -> Other`
- `Nhập liệu -> Yiyi`

Người dùng nhập liệu có thể nhập và lưu dữ liệu theo ngày/tháng.

### 2. Bảng tổng

- `Bảng tổng -> SM`
- `Bảng tổng -> 360`
- `Bảng tổng -> Baidu JS`
- `Bảng tổng -> Other`

Màn này dùng để tổng hợp theo loại quảng cáo và các chỉ số doanh thu, chi phí, lợi nhuận, thuế, ML 80%, LE.

### 3. Hạ nguồn

- Mục `Hạ nguồn` hiển thị cho cả admin và user nhập liệu.
- User nhập liệu xem được dữ liệu draft để xuất PDF báo cáo.
- Admin xem dữ liệu chính thức, chỉ gồm dữ liệu đã xác nhận.
- `Hạ nguồn -> LE` có thể xuất PDF trực tiếp.

### 4. Quản trị

Chỉ admin mới thấy và truy cập được:

- `Dashboard`
- `Quản trị`

Tại màn `Quản trị`, admin có thể quản lý:

- Ad Sites
- Upstreams
- Downstreams
- Kỳ downstream
- Users

## Phân quyền hiện tại

### Admin

- Xem `Dashboard`
- Nhập liệu
- Xem `Bảng tổng`
- Xem `Hạ nguồn`
- Truy cập `Quản trị`
- Chỉnh các cấu hình downstream và user

### User nhập liệu

- Nhập liệu
- Xem `Bảng tổng`
- Xem `Hạ nguồn`
- Xuất PDF hạ nguồn
- Không truy cập được `Dashboard` và `Quản trị`

## Ghi chú vận hành

- Dữ liệu `confirmed` được coi là dữ liệu chính thức.
- Ở `Hạ nguồn`, admin nhìn số chính thức; user nhập liệu nhìn bản nháp để phục vụ báo cáo gửi đi.
- Nếu backend không tự reload sau khi sửa code, hãy dừng và chạy lại `npm run dev`.
- Nếu frontend không nhận thay đổi mới, refresh trình duyệt hoặc chạy lại `npm run dev`.

## Các lệnh hữu ích

Chạy tại thư mục backend:

```powershell
npm run db:push
npm run db:studio
npm run seed
npm run build
```

Chạy tại thư mục frontend:

```powershell
npm run dev
npm run build
npm run lint
```

## Bảo mật

- File thật chứa bí mật chỉ để trong `.env`, không đưa lên Git.
- Dùng `.env.example` để chia sẻ cấu hình mẫu.
- Không lưu `JWT_SECRET`, password, database credentials vào mã nguồn.
- Nếu nghi ngờ secret đã lộ, phải đổi `JWT_SECRET` ngay.
