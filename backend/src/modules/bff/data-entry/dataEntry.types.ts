import type { DataEntryStatus, EntryType } from '../bff.types';

export type { DataEntryStatus, EntryType };

export interface AdvertiserEntryRow {
  id: number;
  date: string;
  advertiser: string;
  advertiserId: number;
  adOrder: string;
  adOrderId: number | null;
  adOrderCode: string | null;
  adOrderName?: string | null;
  type: EntryType;
  adId: string;
  adIdNum: number;
  rate: string;
  traffic: string;
  settlement: string;
  receivable: number | '';
  status: DataEntryStatus;
}

export interface MediaEntryRow {
  id: number;
  date: string;
  media: string;
  mediaId: number;
  mediaAdOrder: string;
  mediaAdOrderId: number | null;
  mediaAdOrderCode: string | null;
  mediaAdOrderName?: string | null;
  type: EntryType;
  mediaIdStr: string;
  upstreamAdId: string;
  upstreamAdIdNum: number;
  rate: string;
  traffic: string;
  settlement: string;
  dataCoefficient: string;
  receivable: number | '';
  shareRatio: string;
  shareRatioNum: number | null;
  actualReceived: number | null;
  status: DataEntryStatus;
}
