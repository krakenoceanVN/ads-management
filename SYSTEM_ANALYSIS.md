# Ads Management System - System Analysis

## 1. Tổng quan

Hệ thống gồm 2 phần:

- Backend: `Node.js + Express + TypeScript + Prisma`
- Frontend: `React + Vite + TypeScript + Ant Design + TanStack Query`
- Database runtime: `PostgreSQL` trên `Supabase`
- Cơ chế xác thực: `JWT`

Thư mục chính:

- Backend: `D:\Download\manager\kko\150426\ads-management`
- Frontend: `D:\Download\manager\kko\150426\ads-management\ads-management`

Lưu ý quan trọng:

- `Dashboard` ở `/dashboard/*` và `Bảng tổng` ở `/upstream/*` là **2 màn khác nhau**
- `SM rebate` hiện chỉ áp dụng cho `SM` và cấu hình theo **Ad Site**
- `GET /api/daily-input` hiện đã bắt buộc đăng nhập
- `requireAuth` hiện lấy lại user từ DB ở mỗi request, không tin quyền/trạng thái cũ trong JWT

---

## 2. Kiến trúc backend

### 2.1 Entry points và module chính

- `D:\Download\manager\kko\150426\ads-management\src\index.ts`
- `D:\Download\manager\kko\150426\ads-management\src\prisma.ts`
- `D:\Download\manager\kko\150426\ads-management\src\middleware\auth.ts`
- `D:\Download\manager\kko\150426\ads-management\src\routes\admin.ts`
- `D:\Download\manager\kko\150426\ads-management\src\routes\dailyInput.ts`
- `D:\Download\manager\kko\150426\ads-management\src\routes\dashboard.ts`
- `D:\Download\manager\kko\150426\ads-management\src\routes\leDashboard.ts`
- `D:\Download\manager\kko\150426\ads-management\src\routes\yiyiData.ts`
- `D:\Download\manager\kko\150426\ads-management\src\services\mlPayout.service.ts`
- `D:\Download\manager\kko\150426\ads-management\src\utils\calculations.ts`

### 2.2 Route groups

#### Auth / user session

- `POST /api/auth/login`
- `GET /api/auth/me`

#### Nhập liệu

- `GET /api/daily-input`
- `POST /api/daily-input/batch`
- `POST /api/daily-input/confirm-batch`
- `POST /api/daily-input/:id/confirm`
- `PUT /api/daily-input/:id/unconfirm`
- `POST /api/daily-input/:id/unconfirm` (alias cũ, vẫn admin-only)
- `DELETE /api/daily-input/:id`

#### Dashboard / bảng tổng / hạ nguồn

- `GET /api/dashboard/monthly`
- `GET /api/dashboard/downstream-monthly`
- `GET /api/dashboard/le`
- `POST /api/dashboard/le/cost`

#### Yiyi

- `GET /api/yiyi-data`
- `POST /api/yiyi-data/batch`
- `POST /api/yiyi-data/monthly-batch`

#### Admin

- CRUD `upstreams`
- CRUD `ad-sites`
- CRUD `downstreams`
- CRUD `downstream-periods`
- CRUD `users`
- `ad-sites` timeline / reconciliation
- `ad-sites` rebate config

---

## 3. Mô hình dữ liệu hiện tại

Các model chính trong `prisma/schema.prisma`:

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

### 3.1 Quan hệ lõi

```text
AdType (1) -> (N) Upstream (1) -> (N) AdSite (1) -> (N) DailyInput
                                           |                 |
                                           |                 -> snapshot giá / rebate / revenue
                                           |
                                           -> (N) AdSiteEvent
                                           -> (N) AdSiteRebateRate

Downstream (1) -> (N) DownstreamPeriod
Downstream (1) -> (N) DailyDownstreamRate
```

### 3.2 Các cờ nghiệp vụ quan trọng

#### AdSite

- `isActive`
  - `false` = site bị pause
  - không cho tạo input mới
  - nhưng dữ liệu lịch sử vẫn phải hiện và vẫn được tính vào dashboard

- `isArchived`
  - `true` = site die / archive
  - bị loại khỏi input và các luồng tính tiền hiện hành

#### DailyInput

- `status`
  - `unconfirmed`
  - `confirmed`

- `revenue`
  - là doanh thu cuối cùng được dùng cho dashboard/payout
  - với `SM`, đây là **Thực thu sau rebate**

- `rebateAmount`
  - số hoàn tiền đã snapshot

- `rebateRateSnapshot`
  - rebate rate tại thời điểm lưu

---

## 4. Phân quyền hiện tại

### ADMIN

- full quyền
- quản trị `Ad Sites`, `Upstreams`, `Downstreams`, `Users`
- pause / resume / archive / restore
- timeline
- reconciliation
- rebate config
- mở khóa dữ liệu đã chốt

### EDITOR

- quyền xem phải giống `VIEWER` 100%
- được thao tác ở nghiệp vụ nhập liệu hằng ngày
- không có quyền quản trị site / upstream / downstream / user

### VIEWER

- read-only
- xem được:
  - `Dashboard`
  - `Nhập liệu`
  - `Bảng tổng`
  - `Hạ nguồn`
  - `Danh sách site`
- không được:
  - thêm
  - sửa
  - xóa
  - lưu
  - chốt
  - mở khóa

### 4.1 Cơ chế auth hiện tại

- JWT vẫn dùng để xác thực chữ ký và lấy `user.id`
- `requireAuth` sau đó query DB để lấy lại:
  - `role`
  - `permDataInput`
  - `permDataConfirm`
  - `permAdmin`
  - `status`
- nếu user bị khóa hoặc đổi quyền, token cũ mất hiệu lực ở request tiếp theo

Đây là fix trực tiếp cho lỗi cũ "JWT không thu hồi quyền/trạng thái ngay".

---

## 5. Frontend architecture

### 5.1 Files chính

- `D:\Download\manager\kko\150426\ads-management\ads-management\src\App.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\api\axios.ts`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\components\layout\AppLayout.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\pages\DashboardPage.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\pages\UpstreamDashboardPage.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\pages\AdminPage.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\pages\DownstreamSitesPage.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\pages\YiyiInputPage.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\components\daily-input\SmInputTable.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\components\daily-input\S360InputTable.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\components\daily-input\BaiduInputTable.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\components\daily-input\OtherInputTable.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\components\ad-sites\AdSiteTimelineDrawer.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\components\ad-sites\ReconciliationDrawer.tsx`
- `D:\Download\manager\kko\150426\ads-management\ads-management\src\components\ad-sites\AdSiteRebateDrawer.tsx`

### 5.2 Route mapping

#### Dashboard

- `/dashboard/sm`
- `/dashboard/360`
- `/dashboard/baidu`
- `/dashboard/other`

#### Bảng tổng

- `/upstream/sm`
- `/upstream/360`
- `/upstream/baidu`
- `/upstream/other`

#### Nhập liệu

- `/input/sm`
- `/input/360`
- `/input/baidu`
- `/input/other`
- `/input/yiyi`

#### Hạ nguồn

- `/downstream`
- `/downstream/:id`

#### Quản trị / danh sách site

- `/admin`

### 5.3 State management

- TanStack Query cho server state
- local draft state cho các bảng nhập liệu
- token lưu ở `localStorage`
- stale cache hiện được tăng để tránh refetch quá nhiều khi đổi tab

---

## 6. Luồng nhập liệu

### 6.1 Daily input GET

`GET /api/daily-input` nhận:

- `date`
- `ad_type`
- `search`

Behavior hiện tại:

- luôn cần auth
- trả về site đang active
- đồng thời trả thêm site đã pause nếu ngày đó đã có `DailyInput` lịch sử
- mục tiêu là giữ tổng nhìn thấy ở `Input` khớp `Dashboard`

Đây là fix trực tiếp cho lỗi cũ:

- `Input` ẩn site paused
- nhưng `Dashboard` vẫn cộng doanh thu lịch sử của site đó
- gây lệch số và làm user tưởng công thức sai

### 6.2 Daily input POST batch

Behavior hiện tại:

- site paused:
  - nếu ngày đó chưa từng có record -> chặn tạo mới
  - nếu ngày đó đã có record lịch sử -> cho phép update

### 6.3 Confirm / unconfirm

- `confirmed`:
  - không được sửa bình thường
  - admin có thể mở khóa bằng `unconfirm`

---

## 7. Rebate hiện tại

### 7.1 Scope

- chỉ áp dụng cho `SM`
- cấu hình theo **Ad Site**
- có khoảng thời gian hiệu lực:
  - `startDate`
  - `endDate` nullable

### 7.2 Công thức hiện tại

- `Doanh thu gốc = qty * unitPrice`
- `Hoàn tiền = qty * rebateRate`
- `Thực thu = Doanh thu gốc - Hoàn tiền`

Lưu xuống DB:

- `DailyInput.rebateAmount = Hoàn tiền`
- `DailyInput.rebateRateSnapshot = rebateRate tại thời điểm lưu`
- `DailyInput.revenue = Thực thu`

### 7.3 Active rate lookup

Một rate được coi là active khi:

- `startDate <= recordDate`
- và:
  - `endDate >= recordDate`
  - hoặc `endDate IS NULL`

### 7.4 UI behavior

Ở `SmInputTable.tsx`:

- input gốc:
  - `qty`
  - `unitPrice`
- cột tính toán:
  - `Doanh thu gốc`
  - `Hoàn tiền`
  - `Thực thu`

Hiện tại:

- `Hoàn tiền` và `Thực thu` là read-only
- user không được override tay

### 7.5 Recalculate rebate

Admin có thể chạy:

- `Áp dụng lại rebate`

Behavior:

- theo `Ad Site`
- chọn khoảng ngày
- có tùy chọn `include_confirmed`

Nếu bật `include_confirmed`, hệ thống có thể sửa lại cả dữ liệu đã chốt. Đây là thao tác mạnh và có popup cảnh báo.

---

## 8. Dashboard / Bảng tổng / Hạ nguồn

### 8.1 Những khác biệt phải bảo toàn

- `SM dashboard cost` khác `SM service cost`
- `LE dashboard tax` khác `LE payout tax`
- `360`, `Baidu JS`, `Other` có công thức doanh thu riêng và không dùng rebate của `SM`

### 8.2 Công thức nhập liệu

#### SM

- trước rebate:
  - `baseRevenue = qty * unitPrice`
- sau rebate:
  - `rebateAmount = qty * rebateRate`
  - `revenue = baseRevenue - rebateAmount`

#### 360 / Baidu JS

- `revenue = (amount1 + amount2) * ratio`

#### Other

- tùy billing method:
  - `CPM`: `qty * unitPrice`
  - `RATIO`: `(amount1 + amount2) * ratio`

### 8.3 Dashboard monthly

`/api/dashboard/monthly` trả:

- row theo từng ngày
- total row
- upstream breakdown theo màn dashboard

Các chỉ số lõi:

- `revenue`
- `cost`
- `tax`
- `profit`
- `profit_rate`

Riêng với `SM`, dashboard đọc `DailyInput.revenue`, nên đây là **Thực thu sau rebate**.

### 8.4 Bảng tổng 360

Màn `Bảng tổng -> 360` đã được gọn lại, chỉ còn:

- `Ngày`
- `Doanh thu`
- `Chi phí`
- `Lợi nhuận`
- `Thuế`
- `Lợi nhuận ròng`
- `Tỷ suất LN`
- `ML 80%`
- `LE`

Không còn breakdown theo từng nhà trong bảng này.

### 8.5 Hạ nguồn

- có luồng `ML`
- có luồng `LE`
- `LE` hiển thị theo ad site nhỏ thực tế
- có export PDF

---

## 9. Timeline / Reconciliation / trạng thái site

### 9.1 Timeline

`AdSiteEvent` dùng cho:

- `CREATED`
- `PAUSED`
- `RESUMED`
- `DIED`
- `NOTE`

Phân biệt:

- `createdAt` = ngày hệ thống ghi nhận
- `eventDate` = ngày thực tế xảy ra

UI timeline sort theo `eventDate`.

### 9.2 Pause / Resume

- `isActive = false` chỉ ảnh hưởng khả năng nhập mới
- không được làm mất dữ liệu lịch sử khỏi dashboard

### 9.3 Archive / Site Die

- `isArchived = true`
- bị loại khỏi input và các luồng tính tiền hiện hành

### 9.4 Reconciliation

Drawer đối soát hiện hỗ trợ:

- chọn khoảng ngày
- doanh thu hệ thống
- UV hệ thống
- nhập số đối tác báo
- chênh lệch doanh thu
- chênh lệch UV

---

## 10. Security notes

### 10.1 Đã fix

- `GET /api/daily-input` không còn public
- JWT không còn giữ quyền/trạng thái cũ tới hết hạn

### 10.2 Tradeoff hiện tại

- `requireAuth` giờ thêm 1 query DB mỗi request protected
- tradeoff này được chấp nhận vì an toàn RBAC quan trọng hơn

---

## 11. Verify chuẩn

### Backend

```powershell
cd D:\Download\manager\kko\150426\ads-management
npm run build
```

### Frontend

```powershell
cd D:\Download\manager\kko\150426\ads-management\ads-management
npm run lint
npm run build
```

### Nếu có thay schema

```powershell
cd D:\Download\manager\kko\150426\ads-management
npx prisma generate
npx prisma db push
```

---

## 12. Các lỗi cũ đã xử lý gần đây

### 12.1 Lộ dữ liệu daily input

Đã fix bằng:

- thêm `requireAuth` cho `GET /api/daily-input`

### 12.2 Lệch số giữa Input và Dashboard do site paused

Đã fix bằng:

- trả lại row lịch sử của site paused ở `GET /api/daily-input`
- cho phép update record lịch sử paused ở `POST /batch`
- vẫn chặn tạo record mới cho site paused

### 12.3 JWT không thu hồi quyền/trạng thái ngay

Đã fix bằng:

- rehydrate `req.user` từ DB tại `requireAuth`

---

## 13. Kết luận

Trạng thái hiện tại của hệ thống:

- kiến trúc backend/frontend ổn định
- RBAC đã rõ hơn và an toàn hơn
- `SM rebate` đang hoạt động theo `Ad Site`
- `Dashboard`, `Bảng tổng`, `Nhập liệu`, `Hạ nguồn`, `Admin` đã có nhiều nghiệp vụ custom, cần cực kỳ cẩn thận khi sửa

Nguyên tắc khi sửa tiếp:

- không phá công thức đang chạy
- không nhầm giữa `/dashboard/*` và `/upstream/*`
- không tự ý mở rộng rebate sang `360 / Baidu / Other`
- luôn verify bằng build + runtime check trước khi kết luận
