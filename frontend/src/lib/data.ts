export { i18n } from './i18n';

export const menu = [
  { key: 'mAdvertiserMgmt', icon: '📢', children: [
    { key: 'pAdvertiserList' }, { key: 'pAdTypeMgmt' }, { key: 'pAdIdMgmt' }
  ] },
  { key: 'mTrafficMgmt', icon: '📡', children: [
    { key: 'pDownstreamMgmt' }, { key: 'pMediaAdOrderMgmt' }, { key: 'pMediaIdMgmt' }
  ] },
  { key: 'mDataEntry', icon: '📥', children: [
    { key: 'pAiEntry' }, { key: 'pAdvEntry' }, { key: 'pMediaDataMgmt' }, { key: 'pYiyiEntry' }
  ] },
  { key: 'mDataQuery', icon: '📊', children: [
    { key: 'pTotalProfit' }, { key: 'pOrderProfit' }, { key: 'pAdvQuery' }, { key: 'pMediaQuery' }, { key: 'pYiyiReport', divider: true }
  ] },
  { key: 'mSettlement', icon: '🧾', children: [
    { key: 'pAdvSettlement' }, { key: 'pMediaSettlement' }
  ] },
  { key: 'mOpLog', icon: '📋', single: true },
  { key: 'mSystemAdmin', icon: '⚙️', children: [
    { key: 'pUserManagement' }, { key: 'pRoleManagement' }, { key: 'pQuarantineMgmt' }
  ] }
];
