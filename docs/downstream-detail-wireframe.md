# Wireframe: Trang chi tiết Hạ lưu (Downstream Detail)

> Route: `/downstreams/:id`
> Mục đích: Hiển thị chi tiết 4 cấp drill-down để admin thấy rõ `pctHal` ở từng cặp (AdSite, Downstream).

---

## Layout tổng quan

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Sidebar]  │ Breadcrumb: Quản lý > Hạ lưu > ML          [⬅ Quay lại]  │
│            ├─────────────────────────────────────────────────────────────┤
│            │  ┌─────────────────────────────────────────────────────┐  │
│            │  │ ML  (active)         Tạo: 2026-04-12  Sửa: ...    │  │ ← Header card
│            │  │ payoutRate mặc định: 0.80                            │  │
│            │  └─────────────────────────────────────────────────────┘  │
│            │                                                            │
│            │  ┌──────────────────────┐ ┌──────────────────────┐         │
│            │  │ Tổng quan nhanh      │ │ Phạm vi pctHal       │         │
│            │  │ • #Nhà QC: 5         │ │ • min: 0.60          │         │
│            │  │ • #AdType: 2         │ │ • max: 0.90          │         │
│            │  │ • #AdSite dùng: 15   │ │ • TB: 0.79           │         │
│            │  │ • #Junction: 15      │ │ ⚠ 3 junction custom │         │
│            │  └──────────────────────┘ └──────────────────────┘         │
│            │                                                            │
│            │  [📑 Section 1: Theo AdType]  [📑 Section 2: Theo Nhà QC]  │
│            │  [📑 Section 3: Theo AdSite]  [📑 Section 4: Lịch sử giá]  │
│            │                                                            │
│            │  ┌─────────────────────────────────────────────────────┐  │
│            │  │ 📑 Section 1: Theo AdType                          │  │ ← Default open
│            │  │  ┌──────────────────────────────────────────────┐  │  │
│            │  │  │ AdType │ #Nhà QC │ #AdSite │ TB pctHal │ ▾  │  │  │
│            │  │  ├────────┼─────────┼─────────┼───────────┼────┤  │  │
│            │  │  │ SM     │ 4       │ 12      │ 0.80      │ ▾  │  │  │ ← Click row
│            │  │  │ 360    │ 1       │ 3       │ 0.85      │ ▸  │  │  │
│            │  │  └──────────────────────────────────────────────┘  │  │
│            │  │                                                     │  │
│            │  │ Khi click "SM" → bung bảng L3:                    │  │
│            │  │  ┌─────────────────────────────────────────────┐  │  │
│            │  │  │ Nhà QC   │ #AdSite │ TB pctHal │ Chi tiết  │  │  │
│            │  │  │ Bảo      │ 5       │ 0.80      │ [Mở ▾]   │  │  │
│            │  │  │ Long     │ 4       │ 0.85      │ [Mở ▸]   │  │  │
│            │  │  │ Minh     │ 3       │ 0.75      │ [Mở ▸]   │  │  │
│            │  │  └─────────────────────────────────────────────┘  │  │
│            │  │                                                     │  │
│            │  │ Khi click "Bảo" → bung bảng L4 (AdSite):        │  │
│            │  │  ┌──────────────────────────────────────────────┐  │  │
│            │  │  │ AdSite  │ Name   │ pctHal │ customPrice │ ✎  │  │  │
│            │  │  │ A7K9X2  │ sm-001 │ 0.60   │ 0.80        │ ✎  │  │  │
│            │  │  │ M3P4N8  │ sm-002 │ 0.80   │ -           │ ✎  │  │  │
│            │  │  │ X1Y2Z3  │ sm-003 │ 0.90   │ 1.20        │ ✎  │  │  │
│            │  │  └──────────────────────────────────────────────┘  │  │
│            │  └─────────────────────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────────────────────────┘
```

---

## Section 1: Theo AdType (default open)

**Mục đích**: Nhóm theo loại quảng cáo, drill-down xem Nhà QC → AdSite.

| Cột | Nguồn | Ý nghĩa |
|---|---|---|
| AdType | JOIN `DownstreamAdType.adTypeId` | SM / 360 / BAIDU_JS |
| #Nhà QC | `COUNT(DISTINCT AdSite.upstreamId)` | Số nhà QC đang dùng |
| #AdSite | `COUNT(DISTINCT AdSiteDownstream.adSiteId)` | Số AdSite đã gắn |
| TB pctHal | `AVG(AdSiteDownstream.pctHal)` | Trung bình (NULL → 1.0) |
| ▾ | - | Click để bung L3 |

Click row → mở rộng L3 (Nhà QC) ngay bên dưới.

---

## Section 2: Theo Nhà QC

**Mục đích**: Hiển thị theo chiều khác — mỗi nhà QC dùng hạ lưu này thế nào.

| Cột | Nguồn | Ý nghĩa |
|---|---|---|
| Nhà QC | JOIN `Upstream.id` | Tên nhà |
| #AdType | `COUNT(DISTINCT AdSite.adOrder.adTypeId)` | Số AdType đang dùng |
| #AdSite | `COUNT(DISTINCT AdSiteDownstream.adSiteId)` | Số AdSite |
| TB pctHal | `AVG(pctHal)` | Trung bình |
| TB customPrice | `AVG(AdSiteDownstream.customPrice)` | Trung bình (NULL → 0) |
| ▾ | - | Click để bung |

---

## Section 3: Theo AdSite (mặc định ẩn)

**Mục đích**: Bảng phẳng, tất cả AdSite, sort/filter.

| Cột | Nguồn | Ý nghĩa |
|---|---|---|
| AdSite ID | `AdSite.id` | 6 ký tự alphanumeric |
| Name | `AdSite.name` | Tên hiển thị |
| Nhà QC | JOIN `Upstream` | |
| AdType | JOIN `AdOrder.adType` | |
| pctHal | `AdSiteDownstream.pctHal` | Màu xanh nếu ≠ 1.0 |
| customPrice | `AdSiteDownstream.customPrice` | Màu cam nếu có |
| Trạng thái | `AdSite.status` | active / inactive |

Có thanh search + filter (AdType, Nhà QC).

Mỗi row có nút ✎ → mở **modal sửa pctHal + customPrice**.

---

## Section 4: Lịch sử giá (mặc định ẩn)

**Mục đích**: Hiển thị thay đổi giá theo thời gian.

| Cột | Nguồn |
|---|---|
| Ngày bắt đầu | `DownstreamPeriod.startDate` |
| Ngày kết thúc | `DownstreamPeriod.endDate` |
| Đơn giá | `DownstreamPeriod.unitPrice` |
| pctHal | `DownstreamPeriod.pctHal` |
| Ghi chú | `DownstreamPeriod.note` |

(Sắp xếp theo `startDate DESC`)

---

## Modal sửa AdSite Downstream

Khi click ✎ ở Section 3 → mở modal:

```
┌─────────────────────────────────────────────┐
│ Sửa Media Downstream                      × │
├─────────────────────────────────────────────┤
│ AdSite:   sm-001 (Bảo - SM)                  │
│ Downstream: ML                              │
│                                              │
│ pctHal (tỷ lệ chia)                          │
│ ┌─────────────────────────┐                 │
│ │ 0.60                    │  ← ô nhập số    │
│ └─────────────────────────┘                 │
│ (0 = 0%, 1 = 100%. VD: 0.8 = 80%)           │
│                                              │
│ customPrice (đơn giá riêng)                  │
│ ┌─────────────────────────┐                 │
│ │ 0.80                    │ ← optional       │
│ └─────────────────────────┘                 │
│ (Để trống = dùng giá từ period/rate)         │
│                                              │
│ [Hủy]                    [Lưu]              │
└─────────────────────────────────────────────┘
```

**Validation**:
- `pctHal`: bắt buộc, số trong [0, 1].
- `customPrice`: optional, số ≥ 0.

**API**: `PATCH /api/bff/media-ids/:junctionId` (đã có sẵn, đã có validation).

---

## State & Edge cases

| Tình huống | Hiển thị |
|---|---|
| Hạ lưu **chưa gắn Nhà QC nào** | Section 1, 2, 3: hiển thị "Chưa có dữ liệu" |
| **Tất cả pctHal = 1.0** (chưa override) | Badge xanh "Chưa tùy chỉnh" trên header |
| **Có pctHal < 0.5** | Badge cam "Tỷ lệ thấp" cảnh báo |
| **customPrice = 0 hoặc NULL** | Cột hiển thị "—" (không có) |
| **Hạ lưu inactive** | Disable nút ✎, badge "Ngưng dùng" |
| **AdSite archived** | Row mờ + tooltip "Đã archive" |

---

## Backend cần bổ sung

### 1. Endpoint mới

**`GET /api/bff/downstreams/:id/summary`** trả về:

```json
{
  "downstream": { "id": "A7K9X2", "downstreamType": "ML", "payoutRate": 0.8, "status": "active" },
  "totals": {
    "advertiserCount": 5,
    "adTypeCount": 2,
    "adSiteCount": 15,
    "junctionCount": 15,
    "customCount": 3,
    "pctHalMin": 0.6,
    "pctHalMax": 0.9,
    "pctHalAvg": 0.79
  },
  "byAdType": [
    { "adTypeId": "...", "adTypeCode": "SM", "advertiserCount": 4, "adSiteCount": 12, "pctHalAvg": 0.80 }
  ],
  "byAdvertiser": [
    { "upstreamId": "...", "upstreamName": "Bảo", "adTypeCount": 2, "adSiteCount": 5, "pctHalAvg": 0.80, "customPriceAvg": 0.80 }
  ],
  "byAdSite": [
    { "junctionId": "...", "adSiteId": "...", "adSiteName": "sm-001", "upstreamId": "...", "upstreamName": "Bảo", "adTypeCode": "SM", "pctHal": 0.60, "customPrice": 0.80 }
  ]
}
```

### 2. SQL gợi ý

```sql
-- Section 1: Theo AdType
SELECT
  at.id AS ad_type_id, at.code AS ad_type_code,
  COUNT(DISTINCT site.upstream_id) AS advertiser_count,
  COUNT(DISTINCT site.id) AS ad_site_count,
  AVG(junction.pct_hal) AS pct_hal_avg
FROM "AdSiteDownstream" junction
JOIN "Downstream" d ON d.id = junction.downstream_id
JOIN "AdSite" site ON site.id = junction.ad_site_id
LEFT JOIN "AdOrder" o ON o.id = site.ad_order_id
LEFT JOIN "AdType" at ON at.id = COALESCE(o.ad_type_id, site.upstream_id)
WHERE d.id = $1
GROUP BY at.id, at.code
ORDER BY ad_type_code;

-- Section 2: Theo Nhà QC (tương tự, group by upstream)
-- Section 3: Theo AdSite (flat list, order by upstream.name, site.name)
```

---

## Frontend

| Component | State |
|---|---|
| Trang list `/downstreams` | Đã có, chỉ thêm cột `#AdSite`, `pctHal min-max` |
| Trang detail `/downstreams/:id` | **Mới** |
| Component `Section1` `Section2` `Section3` | Mới, drill-down |
| Modal edit pctHal | **Mới** |
| Service `getDownstreamSummary(id)` | Mới |

---

## Effort estimate

| Hạng mục | Effort |
|---|---|
| Backend: endpoint `getDownstreamSummary` | 1-2 giờ |
| Backend: test SQL queries | 30 phút |
| Frontend: trang detail + 4 section | 3-4 giờ |
| Frontend: modal edit | 1 giờ |
| Frontend: cập nhật trang list | 30 phút |
| QA test | 1 giờ |
| **Tổng** | **~7-9 giờ (~1 ngày)** |

---

## Câu hỏi cần bạn confirm trước khi dev

| # | Câu hỏi |
|---|---|
| 1 | 4 section đã đủ chưa, hay cần thêm (VD: section lịch sử thay đổi pctHal - audit log)? |
| 2 | Modal edit chỉ cho phép sửa `pctHal` + `customPrice`, hay phải sửa cả trạng thái junction? |
| 3 | Có cần filter theo Nhà QC / AdType ở Section 3 (AdSite list) không? |
| 4 | Có cần export CSV ở trang detail không? |

Nếu bạn OK với wireframe này, tôi bắt đầu dev theo thứ tự: **Backend endpoint → Test SQL → Frontend detail page → Modal → List page update**.
