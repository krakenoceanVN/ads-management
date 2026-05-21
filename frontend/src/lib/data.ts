import type { AdvertiserEntryRow, MediaEntryRow } from './dataEntryMath';
import type { OperationLog } from './i18n';

export { i18n } from './i18n';

type DemoStatus = boolean | 'active' | 'inactive' | 'pending' | 'confirmed';

export interface DemoAdvertiser {
  id: number;
  name: string;
  contact: string;
  phone: string;
  email: string;
  notes: string;
  status?: DemoStatus;
}

export interface DemoAdOrder {
  id: number;
  advId: number;
  name: string;
  notes: string;
  status?: DemoStatus;
}

export interface DemoAdId {
  id: number;
  advId: number;
  orderId: number;
  slot: string;
  type: string;
  rate: string;
  notes: string;
  status?: DemoStatus;
}

export interface DemoMedia {
  id: number;
  name: string;
  contact: string;
  phone: string;
  email: string;
  notes: string;
  status?: DemoStatus;
}

export interface DemoMediaOrder {
  id: number;
  mediaId: number;
  name: string;
  notes: string;
  status?: DemoStatus;
}

export interface DemoMediaId {
  id: number;
  mediaId: number;
  orderId: number;
  adSlot: string;
  slot: string;
  type: string;
  rate: string;
  shareRatio: string;
  notes: string;
  status?: DemoStatus;
}

export interface DemoDb {
  advertisers: DemoAdvertiser[];
  adOrders: DemoAdOrder[];
  adIds: DemoAdId[];
  media: DemoMedia[];
  mediaOrders: DemoMediaOrder[];
  mediaIds: DemoMediaId[];
  advertiserEntryRows: AdvertiserEntryRow[];
  mediaEntryRows: MediaEntryRow[];
  operationLogs: OperationLog[];
}

export const initialDb: DemoDb = {
  advertisers: [],
  adOrders: [],
  adIds: [],
  media: [],
  mediaOrders: [],
  mediaIds: [],
  advertiserEntryRows: [],
  mediaEntryRows: [],
  operationLogs: [
    { time: '2025-05-07 14:32', actor: 'nancy', moduleKey: 'pAdvertiserList', actionKey: 'createAdvertiser', targetName: '北京晓云', targetId: '' },
    { time: '2025-05-07 14:35', actor: 'nancy', moduleKey: 'pAdIdMgmt', actionKey: 'createAdId', targetName: '', targetId: '252' },
    { time: '2025-05-07 15:01', actor: 'nancy', moduleKey: 'pMediaMgmt', actionKey: 'createMedia', targetName: '济宁森林慷厦', targetId: '' },
    { time: '2025-05-07 15:20', actor: 'nancy', moduleKey: 'pAiEntry', actionKey: 'aiEntry', targetName: '', targetId: '3' },
  ],
};

export const menu = [
  { key: 'mAdvertiserMgmt', icon: '📢', children: [
    { key: 'pAdvertiserList' }, { key: 'pAdOrderMgmt' }, { key: 'pAdIdMgmt' }
  ] },
  { key: 'mTrafficMgmt', icon: '📡', children: [
    { key: 'pMediaMgmt' }, { key: 'pMediaAdOrderMgmt' }, { key: 'pMediaIdMgmt' }
  ] },
  { key: 'mDataEntry', icon: '📥', children: [
    { key: 'pAiEntry' }, { key: 'pAdvEntry' }, { key: 'pMediaDataMgmt' }
  ] },
  { key: 'mDataQuery', icon: '📊', children: [
    { key: 'pTotalProfit' }, { key: 'pOrderProfit' }, { key: 'pAdvQuery' }, { key: 'pMediaQuery' }
  ] },
  { key: 'mSettlement', icon: '🧾', children: [
    { key: 'pAdvSettlement' }, { key: 'pMediaSettlement' }
  ] },
  { key: 'mOpLog', icon: '📋', single: true }
];
