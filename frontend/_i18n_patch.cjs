const fs = require('fs');

const newKeys = {
  // Header
  back: { zh: '← 返回', vi: '← Quay lại', en: '← Back' },
  loading: { zh: '加载中…', vi: 'Đang tải…', en: 'Loading…' },
  errorPrefix: { zh: '错误', vi: 'Lỗi', en: 'Error' },
  notFoundDownstream: { zh: '未找到该下游。', vi: 'Không tìm thấy hạ lưu.', en: 'Downstream not found.' },
  notSelectedDownstream: { zh: '请先选择下游。', vi: 'Chưa chọn hạ lưu.', en: 'Please select a downstream first.' },
  pageTitle: { zh: '下游：', vi: 'Hạ lưu: ', en: 'Downstream: ' },
  inactiveBadge: { zh: '已停用', vi: 'Ngưng dùng', en: 'Inactive' },

  // Stat cards
  statAdvertiserCount: { zh: '使用中的广告主数', vi: 'Số nhà QC đang dùng', en: 'Active advertisers' },
  statAdSiteCount: { zh: '已关联的广告位', vi: 'Số vị trí QC đã gắn', en: 'Linked ad sites' },
  statAdTypeCount: { zh: '广告类型数', vi: 'Số loại quảng cáo', en: 'Ad type count' },
  statJunctionCount: { zh: '关联总数', vi: 'Tổng số liên kết', en: 'Total links' },
  statPayoutRate: { zh: '默认单价', vi: 'Đơn giá mặc định', en: 'Default rate' },
  statPctHalRange: { zh: '分成比例范围', vi: 'Phạm vi tỷ lệ chia', en: 'Share ratio range' },
  statPctHalAvg: { zh: '平均：', vi: 'Trung bình: ', en: 'Average: ' },
  warnCustomPrice: { zh: '⚠ {n} 个关联使用了<b>单独价格</b>（未使用默认价格）。', vi: '⚠ {n} liên kết đang dùng <b>đơn giá riêng</b> (không dùng giá mặc định).', en: '⚠ {n} links use <b>custom price</b> (not default).' },

  // Section 1
  secByAdType: { zh: '按广告类型', vi: 'Theo loại quảng cáo', en: 'By ad type' },
  secByAdTypeEmpty: { zh: '暂无数据。', vi: 'Chưa có dữ liệu.', en: 'No data yet.' },
  colAdType: { zh: '广告类型', vi: 'Loại QC', en: 'Ad type' },
  colAdvertisers: { zh: '广告主数', vi: '#Nhà QC', en: 'Advertisers' },
  colAdSites: { zh: '广告位数', vi: '#Vị trí QC', en: 'Ad sites' },
  colJunctions: { zh: '关联数', vi: '#Liên kết', en: 'Links' },
  colPctHalAvg: { zh: '平均分成', vi: 'Tỷ lệ TB', en: 'Avg ratio' },
  btnDetail: { zh: '详情', vi: 'Chi tiết', en: 'Detail' },
  colAdSitesCol: { zh: '广告位明细', vi: 'Vị trí QC chi tiết', en: 'Ad sites detail' },

  // Section 2
  secByAdvertiser: { zh: '按广告主', vi: 'Theo nhà quảng cáo', en: 'By advertiser' },
  colAdvertiserName: { zh: '广告主', vi: 'Nhà QC', en: 'Advertiser' },

  // Section 3
  secByAdSite: { zh: '按广告位', vi: 'Theo vị trí quảng cáo', en: 'By ad site' },
  searchPlaceholder: { zh: '搜索广告位、广告主、类型…', vi: 'Tìm vị trí QC, nhà QC, loại QC…', en: 'Search ad site, advertiser, type…' },
  secByAdSiteEmpty: { zh: '暂无关联。', vi: 'Không có liên kết nào.', en: 'No links.' },
  colAdSite: { zh: '广告位', vi: 'Vị trí QC', en: 'Ad site' },
  colPctHal: { zh: '分成', vi: 'Tỷ lệ chia', en: 'Share ratio' },
  colCustomPrice: { zh: '单独价格', vi: 'Đơn giá riêng', en: 'Custom price' },
  btnEdit: { zh: '✎ 编辑', vi: '✎ Sửa', en: '✎ Edit' },
  btnCancel: { zh: '取消', vi: 'Hủy', en: 'Cancel' },
  btnSave: { zh: '保存', vi: 'Lưu', en: 'Save' },
  btnSaving: { zh: '保存中…', vi: 'Đang lưu…', en: 'Saving…' },
  titleDownstream: { zh: '编辑分成比例和单价', vi: 'Sửa tỷ lệ chia & đơn giá', en: 'Edit share ratio & rate' },
  labelAdSite: { zh: '广告位', vi: 'Vị trí QC', en: 'Ad site' },
  labelDownstream: { zh: '下游', vi: 'Hạ lưu', en: 'Downstream' },
  labelAdvertiser: { zh: '广告主', vi: 'Nhà QC', en: 'Advertiser' },
  labelAdType: { zh: '广告类型', vi: 'Loại QC', en: 'Ad type' },
  labelPctHal: { zh: '分成比例 (0=0%, 1=100%)', vi: 'Tỷ lệ chia (0 = 0%, 1 = 100%)', en: 'Share ratio (0=0%, 1=100%)' },
  placeholderPctHal: { zh: '例：0.6 = 60%。留空 = 使用默认', vi: 'Ví dụ: 0.6 = 60%. Để trống = dùng mặc định', en: 'e.g. 0.6 = 60%. Empty = use default' },
  labelCustomPrice: { zh: '单独价格（可选）', vi: 'Đơn giá riêng (tùy chọn)', en: 'Custom price (optional)' },
  placeholderCustomPrice: { zh: '例：0.80。留空 = 使用默认', vi: 'Ví dụ: 0.80. Để trống = dùng giá mặc định', en: 'e.g. 0.80. Empty = use default' },
  currentValue: { zh: '当前：', vi: 'Hiện tại: ', en: 'Current: ' },
  errPctHalRange: { zh: '分成比例必须是 0–1 之间的数字（例如 0.6 = 60%）。留空 = 使用默认。', vi: 'Tỷ lệ chia phải là số trong khoảng 0–1 (ví dụ: 0.6 = 60%). Để trống = dùng mặc định.', en: 'Share ratio must be 0–1 (e.g. 0.6 = 60%). Empty = use default.' },
  errCustomPriceRange: { zh: '单独价格必须是 ≥ 0 的数字。留空 = 使用默认。', vi: 'Đơn giá riêng phải là số ≥ 0. Để trống = dùng giá mặc định.', en: 'Custom price must be ≥ 0. Empty = use default.' },
  errSave: { zh: '保存失败', vi: 'Lỗi lưu', en: 'Save failed' },
  tooltEditDisabled: { zh: '该下游已停用', vi: 'Hạ lưu đang ngưng dùng', en: 'Downstream inactive' },
};

const f = 'D:/Download/260604/frontend/src/lib/i18n.ts';
let src = fs.readFileSync(f, 'utf8');

// Tìm 3 dấu "  }," (đóng từng object lang) — chèn trước dấu này
// Pattern: dòng có đúng "  }," (chính xác, 2 spaces + } + ,)
const marker = /^  },$/gm;
const matches = [...src.matchAll(marker)];
console.log('Found', matches.length, 'closing markers');

// Build block text
function buildBlock(prefix) {
  const lines = [];
  for (const [key, trans] of Object.entries(newKeys)) {
    lines.push(`    ${prefix}DownstreamDetail_${key}: ${JSON.stringify(trans[prefix])},`);
  }
  return lines.join('\n');
}

const zhBlock = '\n  // DownstreamDetail (downstream master-detail page)\n' + buildBlock('zh') + '\n';
const viBlock = '\n  // DownstreamDetail (downstream master-detail page)\n' + buildBlock('vi') + '\n';
const enBlock = '\n  // DownstreamDetail (downstream master-detail page)\n' + buildBlock('en') + '\n';

// Tìm 3 vị trí "  }," đầu tiên từ trên xuống, mỗi cái chèn block tương ứng
let count = 0;
src = src.replace(marker, (match, ...args) => {
  const offset = args[args.length - 2]; // offset
  count++;
  if (count === 1) return zhBlock + match;
  if (count === 2) return viBlock + match;
  if (count === 3) return enBlock + match;
  return match;
});

fs.writeFileSync(f, src);
console.log('Patched i18n.ts with', Object.keys(newKeys).length, 'new keys per language');
