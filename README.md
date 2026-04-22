# Ads Management System

Hệ thống quản lý nhập liệu, dashboard, bảng tổng, hạ nguồn và quản trị site quảng cáo.

## 1. Kiến trúc hiện tại

- Backend: `Node.js + Express + TypeScript + Prisma`
- Frontend: `React + Vite + TypeScript + Ant Design + TanStack Query`
- Database: `PostgreSQL` trên `Supabase`
- Auth: `JWT`

## 2. Cấu trúc thư mục

- Backend: `D:\Download\manager\kko\150426\ads-management`
- Frontend: `D:\Download\manager\kko\150426\ads-management\ads-management`
- Prisma schema: `D:\Download\manager\kko\150426\ads-management\prisma\schema.prisma`

## 3. Môi trường chạy

Yêu cầu:

- Node.js `20+`
- npm

Backend `.env`:

```env
DATABASE_URL="postgresql://...pooler..."
DIRECT_URL="postgresql://...direct..."
JWT_SECRET="replace-with-a-strong-secret"
PORT=3001
```

Frontend `.env`:

```env
VITE_API_URL=http://localhost:3001
```

Lưu ý:

- `DATABASE_URL` dùng cổng pooler
- `DIRECT_URL` dùng cho Prisma direct connection
- không commit `.env`

## 4. Cài đặt

Backend:

```powershell
cd D:\Download\manager\kko\150426\ads-management
npm install
```

Frontend:

```powershell
cd D:\Download\manager\kko\150426\ads-management\ads-management
npm install
```

## 5. Chạy dự án

Backend dev:

```powershell
cd D:\Download\manager\kko\150426\ads-management
npm run dev
```

Backend build:

```powershell
cd D:\Download\manager\kko\150426\ads-management
npm run build
npm run start
```

Frontend dev:

```powershell
cd D:\Download\manager\kko\150426\ads-management\ads-management
npm run dev
```

Frontend build:

```powershell
cd D:\Download\manager\kko\150426\ads-management\ads-management
npm run build
```

## 6. Prisma / Database

Các lệnh hay dùng:

```powershell
cd D:\Download\manager\kko\150426\ads-management
npx prisma generate
npx prisma db push
npx prisma studio
```

Schema hiện tại gồm các nhóm chính:

- `AdType`
- `Upstream`
- `AdSite`
- `AdSiteRebateRate`
- `AdSiteEvent`
- `DailyInput`
- `Downstream`
- `DownstreamPeriod`
- `DailyDownstreamRate`
- `User`
- `YiyiDailyData`
- `YiyiDailyPricing`
- `LEDailyCost`

## 7. Phân quyền (RBAC)

### ADMIN

- full quyền
- quản trị `Ad Sites`, `Upstreams`, `Downstreams`, `Users`
- chốt / mở khóa / archive / pause / rebate config / reconcile / timeline

### EDITOR

- quyền xem giống `VIEWER`
- được thao tác nghiệp vụ nhập liệu hằng ngày
- không có quyền quản trị site / upstream / downstream / user

### VIEWER

- read-only
- xem được `Dashboard`, `Nhập liệu`, `Bảng tổng`, `Hạ nguồn`, `Danh sách site`
- không được thêm / sửa / xóa / lưu / chốt / mở khóa

## 8. Các màn hình chính

### Dashboard

Route:

- `/dashboard/sm`
- `/dashboard/360`
- `/dashboard/baidu`
- `/dashboard/other`

Đây là màn tổng quan theo route `dashboard/*`.

### Bảng tổng

Route:

- `/upstream/sm`
- `/upstream/360`
- `/upstream/baidu`
- `/upstream/other`

Đây là màn tổng hợp công thức theo route `upstream/*`.

### Nhập liệu

- `SM`
- `360`
- `Baidu JS`
- `Other`
- `Yiyi`

### Hạ nguồn

- xem theo downstream
- có luồng `ML`, `LE`
- có export PDF cho các màn liên quan

### Quản trị / Danh sách site

- `Ad Sites`
- `Upstreams`
- `Downstreams`
- `Kỳ downstream`
- `Users`
- `Timeline`
- `Reconciliation`
- `Rebate`

## 9. Nghiệp vụ quan trọng đang chạy

### 9.1 SM rebate

Rebate hiện chỉ áp dụng cho `SM`.

Config:

- theo `Ad Site`
- có `startDate`
- có `endDate`

Công thức:

- `Doanh thu gốc = qty * unitPrice`
- `Hoàn tiền = qty * rebateRate`
- `Thực thu = Doanh thu gốc - Hoàn tiền`

Lưu DB:

- `DailyInput.rebateAmount = Hoàn tiền`
- `DailyInput.rebateRateSnapshot = rate tại thời điểm lưu`
- `DailyInput.revenue = Thực thu`

Điểm quan trọng:

- `Dashboard` và các báo cáo đang đọc `DailyInput.revenue`
- nghĩa là với `SM`, doanh thu báo cáo là **Thực thu**

### 9.2 Pause / Resume và dữ liệu lịch sử

- `AdSite.isActive = false` nghĩa là site bị pause
- site pause không còn hiện để nhập mới
- nhưng nếu ngày đó đã có `DailyInput` lịch sử thì màn `Nhập liệu` vẫn phải hiện row đó để đối chiếu và giữ khớp số với `Dashboard`

### 9.3 Archive / Site Die

- `AdSite.isArchived = true`
- site archived bị loại khỏi input và các luồng tính tiền hiện hành

### 9.4 Timeline / Audit log

`AdSiteEvent` lưu:

- `eventType`
- `eventDate`
- `createdAt`
- `note`

Các event chính:

- `CREATED`
- `PAUSED`
- `RESUMED`
- `DIED`
- `NOTE`

### 9.5 Reconciliation

Drawer đối soát hiện hỗ trợ:

- chọn khoảng ngày
- doanh thu hệ thống
- UV hệ thống
- nhập số đối tác báo
- tự tính chênh lệch

## 10. Công thức tổng quát đang dùng

### SM input

- `revenue = qty * unitPrice` trước rebate
- sau rebate:
  - `actualRevenue = qty * unitPrice - qty * rebateRate`
  - `DailyInput.revenue = actualRevenue`

### 360 / Baidu / Other

Các mảng này giữ nguyên logic riêng hiện tại, không dùng rebate của `SM`.

### Dashboard / Summary

Một số rule quan trọng:

- `SM dashboard cost` khác `SM service cost`
- `LE dashboard tax` khác `LE payout tax`
- `360` ở bảng tổng chỉ hiển thị cột tổng quát, không hiển thị breakdown theo từng nhà

## 11. Bảo mật hiện tại

- `GET /api/daily-input` đã bắt buộc `requireAuth`
- middleware auth không còn tin payload JWT cũ cho quyền/trạng thái
- mỗi request auth sẽ rehydrate user từ DB
- nếu user bị khóa hoặc hạ quyền, token cũ mất hiệu lực ngay ở request tiếp theo

## 12. Verify chuẩn sau khi sửa code

Backend:

```powershell
cd D:\Download\manager\kko\150426\ads-management
npm run build
```

Frontend:

```powershell
cd D:\Download\manager\kko\150426\ads-management\ads-management
npm run lint
npm run build
```

Nếu có thay schema:

```powershell
cd D:\Download\manager\kko\150426\ads-management
npx prisma generate
npx prisma db push
```

## 13. Ghi chú vận hành

- `Dashboard` và `Bảng tổng` là **2 màn khác nhau**
- nếu backend không phản ánh code mới, restart server
- nếu Prisma generate lỗi `EPERM` trên Windows, thường là do file engine đang bị process khác giữ
- nếu frontend build cảnh báo bundle lớn, hiện tại nguyên nhân chính là asset ảnh/logo lớn và chunk JS lớn

## 14. Tài liệu liên quan

- Phân tích hệ thống cũ: `D:\Download\manager\kko\150426\ads-management\SYSTEM_ANALYSIS.md`
- Frontend README chỉ là file dẫn hướng, tài liệu chính là file này
