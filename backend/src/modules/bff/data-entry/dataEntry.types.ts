import type { DataEntryStatus, EntryType } from '../bff.types';

export type { DataEntryStatus, EntryType };

export interface AdvertiserEntryRow {
  id: string;
  date: string;
  advertiser: string;
  advertiserId: string;
  adTypeName: string;
  adTypeCode: string | null;
  type: EntryType;
  adId: string;
  adIdNum: string;
  rate: string;
  traffic: string;
  settlement: string;
  receivable: number | '';
  status: DataEntryStatus;
  uiKey: string;
}

export interface MediaEntryRow {
  id: string;
  date: string;
  media: string;
  mediaId: string;
  mediaAdTypeName: string;
  mediaAdTypeCode: string | null;
  type: EntryType;
  mediaIdStr: string;
  upstreamAdId: string;
  upstreamAdIdNum: string;
  rate: string;
  traffic: string;
  settlement: string;
  dataCoefficient: string;
  receivable: number | '';
  shareRatio: string;
  shareRatioNum: number | null;
  actualReceived: number | null;
  status: DataEntryStatus;
  uiKey: string;
}