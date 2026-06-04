# Ads Management — Backend

REST API (BFF) cho hệ thống quản lý quảng cáo / truyền thông. Xây dựng bằng
**Node.js + Express + TypeScript + Prisma (PostgreSQL)**, có xác thực JWT và phân
quyền theo vai trò (RBAC).

## Yêu cầu

- Node.js 18+
- PostgreSQL 14+

## Cài đặt & chạy

```bash
npm install

# Cấu hình môi trường
cp .env.example .env        # rồi sửa DATABASE_URL, JWT_SECRET...

# Khởi tạo schema database
npm run db:generate         # sinh Prisma Client
npm run db:push             # đẩy schema vào database

# Tạo roles, permissions và tài khoản admin mặc định
npm run bootstrap:admin

# Chạy dev (hot-reload)
npm run dev                 # mặc định http://localhost:3001
```

Tài khoản mặc định sau khi `bootstrap:admin` (chỉ dùng cho môi trường local —
đổi mật khẩu trước khi lên production):

| Vai trò  | Username | Password             |
|----------|----------|----------------------|
| Admin    | admin    | localdev-admin-123   |
| Operator | operator | localdev-operator-123|
| Viewer   | viewer   | localdev-viewer-123  |

## Build & chạy production

```bash
npm run build               # biên dịch ra dist/
npm start                   # node dist/index.js
```

## Scripts

| Lệnh                     | Mô tả                                   |
|--------------------------|-----------------------------------------|
| `npm run dev`            | Chạy dev với hot-reload                 |
| `npm run build`          | Biên dịch TypeScript ra `dist/`         |
| `npm start`              | Chạy bản build production               |
| `npm run typecheck`      | Kiểm tra kiểu, không xuất file          |
| `npm run db:generate`    | Sinh Prisma Client                      |
| `npm run db:push`        | Đồng bộ schema vào database             |
| `npm run db:migrate`     | Áp dụng migration (`prisma migrate deploy`) |
| `npm run bootstrap:admin`| Seed roles/permissions + tài khoản admin|

## Biến môi trường

Xem [.env.example](.env.example). Quan trọng:

- `DATABASE_URL` / `DIRECT_URL` — chuỗi kết nối PostgreSQL
- `JWT_SECRET` — **bắt buộc đổi** khi lên production
- `PORT` — cổng API (mặc định 3001)
- `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` — giới hạn tần suất request

## Cấu trúc

```
src/
  app.ts                 # khởi tạo Express, middleware, mount router
  index.ts               # entrypoint
  config/                # đọc & validate biến môi trường
  middleware/            # requireAuth, requirePermission (RBAC)
  modules/
    auth/                # đăng nhập, JWT
    users/  roles/       # quản lý người dùng & vai trò
    bff/                 # các module nghiệp vụ (BFF):
                         #   advertisers, media, ad-types, ad-ids,
                         #   ad-orders, data-entry, reports, settlement,
                         #   quarantine, operation-logs, dashboard, ...
    yiyi/                # module dữ liệu/báo cáo Yiyi
    health/              # health check
  shared/                # errors, response helpers, prisma client, services
prisma/
  schema.prisma          # định nghĩa schema database
scripts/
  bootstrap-admin.ts     # seed RBAC + admin
```

## Ghi chú khi triển khai

- Hiện chỉ có `prisma/schema.prisma`, **chưa có migration history**. Trên môi
  trường mới dùng `npm run db:push` để tạo schema. Nếu cần migration có phiên
  bản, hãy tạo bằng `npx prisma migrate dev`.
- File `.env` thật **không** đi kèm khi bàn giao — mỗi môi trường tự tạo từ
  `.env.example`.
