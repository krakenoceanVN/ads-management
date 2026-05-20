/**
 * DEPRECATED: do not mount.
 * This component uses legacy local CRUD and is intentionally disabled.
 * All data operations now flow through BFF /api/bff/* endpoints.
 * CPA/CPS types and local AppContext.db mutations are not supported.
 */
import React, { useEffect, useState } from 'react';

type ModalType = 'newAdvertiser' | 'newAdOrder' | 'newAdId' | 'newMedia' | 'newMediaAdOrder' | 'newMediaId';

function nextId(items: Array<{ id: number }>) {
  return Math.max(0, ...items.map(item => item.id)) + 1;
}

function hasRelated(count: number) {
  return count > 0;
}

function formatRatioNumber(value: number) {
  return Number(value.toFixed(6)).toString();
}

function normalizeRevenueShare(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const numericText = raw.replace(/,/g, '').replace(/%/g, '').trim();
  const parsed = Number(numericText);
  if (!Number.isFinite(parsed)) return raw;
  const percent = raw.includes('%') ? parsed : parsed > 1 ? parsed : parsed * 100;
  return `${formatRatioNumber(percent)}%`;
}

function normalizeRateForType(type: string, value: unknown) {
  return type === 'CPS' ? normalizeRevenueShare(value) : String(value ?? '').trim();
}

export function displayRateByType(type: string, value: unknown) {
  return type === 'CPS' ? normalizeRevenueShare(value) : String(value ?? '');
}

function relatedSlotMatches(value: unknown, slot: unknown) {
  const source = String(value ?? '').trim();
  const target = String(slot ?? '').trim();
  if (!source || !target) return false;
  return source === target || source.startsWith(`${target}(`) || source.includes(target);
}

function isValidEmail(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

export function GlobalModal() {
  const { modal, modalMode, modalRecord, closeModal, t, db, setDb, displayName } = useAppContext();

  const [formData, setFormData] = useState<any>({});
  const [typeSelect, setTypeSelect] = useState('CPM');
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (!modal) return;
    const record = modalRecord ? { ...modalRecord } : {};
    if (modal === 'newMediaId') {
      const upstream = db.adIds.find(item =>
        item.slot === record.adSlot ||
        item.slot === record.upstreamAdId ||
        item.slot === record.slot
      );
      if (upstream) {
        record.upstreamAdvId = String(upstream.advId);
        record.upstreamOrderId = String(upstream.orderId);
        record.adSlot = upstream.slot;
      }
      if (record.shareRatio) record.shareRatio = normalizeRevenueShare(record.shareRatio);
    }
    if (record.type === 'CPS') record.rate = normalizeRevenueShare(record.rate);
    setFormData(record);
    setTypeSelect(record.type || 'CPM');
    setEmailError('');
  }, [modal, modalRecord]);

  if (!modal) return null;

  const typedModal = modal as ModalType;
  const isEdit = modalMode === 'edit';

  const titles: Record<ModalType, string> = {
    newAdvertiser: isEdit ? t('editAdvertiser') : t('newAdvertiser'),
    newAdOrder: isEdit ? t('editAdOrder') : t('newAdOrder'),
    newAdId: isEdit ? t('editAdId') : t('newAdId'),
    newMedia: isEdit ? t('editMedia') : t('newMedia'),
    newMediaAdOrder: isEdit ? t('editMediaAdOrder') : t('newMediaAdOrder'),
    newMediaId: isEdit ? t('editMediaId') : t('newMediaId'),
  };

  const nowText = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const log = (actionKey: string, moduleKey: string, targetName = '', targetId = '') => ({
    time: nowText(),
    actor: 'nancy',
    moduleKey,
    actionKey,
    targetName,
    targetId
  });

  const handleInput = (key: string, val: string) => {
    if (key === 'email') setEmailError('');
    setFormData((prev: any) => ({ ...prev, [key]: val }));
  };

  const handleUpstreamAdvertiserChange = (value: string) => {
    setFormData((prev: any) => ({ ...prev, upstreamAdvId: value, upstreamOrderId: '', adSlot: '' }));
  };

  const handleUpstreamOrderChange = (value: string) => {
    setFormData((prev: any) => ({ ...prev, upstreamOrderId: value, adSlot: '' }));
  };

  const handleUpstreamAdIdChange = (value: string) => {
    const upstream = db.adIds.find(item => item.slot === value);
    setFormData((prev: any) => ({
      ...prev,
      adSlot: value,
      upstreamAdvId: upstream ? String(upstream.advId) : prev.upstreamAdvId,
      upstreamOrderId: upstream ? String(upstream.orderId) : prev.upstreamOrderId,
      rate: upstream ? normalizeRateForType(upstream.type, upstream.rate) : prev.rate,
    }));
    if (upstream?.type) setTypeSelect(upstream.type);
  };

  const submitModal = () => {
    const advId = Number(formData.advId);
    const orderId = Number(formData.orderId);
    const mediaId = Number(formData.mediaId);
    if ((typedModal === 'newAdvertiser' || typedModal === 'newMedia') && !isValidEmail(formData.email)) {
      setEmailError(t('emailInvalid'));
      return;
    }
    if (typedModal === 'newAdvertiser' && !formData.name) return alert(t('advertiserName') + '?');
    if (typedModal === 'newMedia' && !formData.name) return alert(t('mediaName') + '?');
    if (typedModal === 'newAdOrder' && (!formData.name || !advId)) return alert(t('requiredFields'));
    if (typedModal === 'newMediaAdOrder' && (!formData.name || !mediaId)) return alert(t('requiredFields'));
    if (typedModal === 'newAdId' && (!formData.slot || !advId || !orderId)) return alert(t('requiredFields'));
    if (typedModal === 'newMediaId' && (!formData.slot || !formData.adSlot || !mediaId || !orderId)) return alert(t('requiredFields'));

    setDb(prev => {
      const preservedStatus = formData.status ?? modalRecord?.status ?? true;
      const newDb = {
        ...prev,
        advertisers: [...prev.advertisers],
        adOrders: [...prev.adOrders],
        adIds: [...prev.adIds],
        media: [...prev.media],
        mediaOrders: [...prev.mediaOrders],
        mediaIds: [...prev.mediaIds],
        operationLogs: [...prev.operationLogs],
      };

      if (typedModal === 'newAdvertiser') {
        if (!formData.name) {
          alert(t('advertiserName') + '?');
          return prev;
        }
        const payload = {
          id: isEdit ? Number(formData.id) : nextId(newDb.advertisers),
          name: formData.name || '',
          contact: formData.contact || '',
          phone: formData.phone || '',
          email: formData.email || '',
          notes: formData.notes || '',
          status: preservedStatus,
        };
        newDb.advertisers = isEdit ? newDb.advertisers.map(item => item.id === payload.id ? payload : item) : [...newDb.advertisers, payload];
        newDb.operationLogs.unshift(log(isEdit ? 'editAdvertiser' : 'createAdvertiser', 'pAdvertiserList', payload.name));
      }

      if (typedModal === 'newAdOrder') {
        const advId = Number(formData.advId);
        if (!formData.name || !advId) {
          alert(t('requiredFields'));
          return prev;
        }
        const payload = {
          id: isEdit ? Number(formData.id) : nextId(newDb.adOrders),
          advId,
          name: formData.name || '',
          notes: formData.notes || '',
          status: preservedStatus,
        };
        newDb.adOrders = isEdit ? newDb.adOrders.map(item => item.id === payload.id ? payload : item) : [...newDb.adOrders, payload];
        newDb.operationLogs.unshift(log(isEdit ? 'editAdOrder' : 'createAdOrder', 'pAdOrderMgmt', payload.name));
      }

      if (typedModal === 'newAdId') {
        const advId = Number(formData.advId);
        const orderId = Number(formData.orderId);
        if (!formData.slot || !advId || !orderId) {
          alert(t('requiredFields'));
          return prev;
        }
        const payload = {
          id: isEdit ? Number(formData.id) : nextId(newDb.adIds),
          advId,
          orderId,
          slot: formData.slot || '',
          type: typeSelect,
          rate: normalizeRateForType(typeSelect, formData.rate),
          notes: formData.notes || '',
          status: preservedStatus,
        };
        newDb.adIds = isEdit ? newDb.adIds.map(item => item.id === payload.id ? payload : item) : [...newDb.adIds, payload];
        newDb.operationLogs.unshift(log(isEdit ? 'editAdId' : 'createAdId', 'pAdIdMgmt', '', payload.slot));
      }

      if (typedModal === 'newMedia') {
        if (!formData.name) {
          alert(t('mediaName') + '?');
          return prev;
        }
        const payload = {
          id: isEdit ? Number(formData.id) : nextId(newDb.media),
          name: formData.name || '',
          contact: formData.contact || '',
          phone: formData.phone || '',
          email: formData.email || '',
          notes: formData.notes || '',
          status: preservedStatus,
        };
        newDb.media = isEdit ? newDb.media.map(item => item.id === payload.id ? payload : item) : [...newDb.media, payload];
        newDb.operationLogs.unshift(log(isEdit ? 'editMedia' : 'createMedia', 'pMediaMgmt', payload.name));
      }

      if (typedModal === 'newMediaAdOrder') {
        const mediaId = Number(formData.mediaId);
        if (!formData.name || !mediaId) {
          alert(t('requiredFields'));
          return prev;
        }
        const payload = {
          id: isEdit ? Number(formData.id) : nextId(newDb.mediaOrders),
          mediaId,
          name: formData.name || '',
          notes: formData.notes || '',
          status: preservedStatus,
        };
        newDb.mediaOrders = isEdit ? newDb.mediaOrders.map(item => item.id === payload.id ? payload : item) : [...newDb.mediaOrders, payload];
        newDb.operationLogs.unshift(log(isEdit ? 'editMediaAdOrder' : 'createMediaAdOrder', 'pMediaAdOrderMgmt', payload.name));
      }

      if (typedModal === 'newMediaId') {
        const mediaId = Number(formData.mediaId);
        const orderId = Number(formData.orderId);
        if (!formData.slot || !formData.adSlot || !mediaId || !orderId) {
          alert(t('requiredFields'));
          return prev;
        }
        const payload = {
          id: isEdit ? Number(formData.id) : nextId(newDb.mediaIds),
          mediaId,
          orderId,
          adSlot: formData.adSlot || '',
          slot: formData.slot || '',
          type: typeSelect,
          rate: normalizeRateForType(typeSelect, formData.rate),
          shareRatio: normalizeRevenueShare(formData.shareRatio),
          notes: formData.notes || '',
          status: preservedStatus,
        };
        newDb.mediaIds = isEdit ? newDb.mediaIds.map(item => item.id === payload.id ? payload : item) : [...newDb.mediaIds, payload];
        newDb.operationLogs.unshift(log(isEdit ? 'editMediaId' : 'createMediaId', 'pMediaIdMgmt', '', payload.slot));
      }

      return newDb;
    });
    closeModal();
  };

  const deleteRecord = () => {
    if (!isEdit || !modalRecord) return;
    const relatedAdOrders = typedModal === 'newAdvertiser' ? db.adOrders.filter(item => item.advId === modalRecord.id).length : 0;
    const relatedAdIds = typedModal === 'newAdOrder' ? db.adIds.filter(item => item.orderId === modalRecord.id).length : 0;
    const relatedMediaOrders = typedModal === 'newMedia' ? db.mediaOrders.filter(item => item.mediaId === modalRecord.id).length : 0;
    const relatedMediaIds = typedModal === 'newMediaAdOrder' ? db.mediaIds.filter(item => item.orderId === modalRecord.id).length : 0;
    const hasRelations = hasRelated(relatedAdOrders + relatedAdIds + relatedMediaOrders + relatedMediaIds);
    const message = `${t('confirmDelete')}\n${hasRelations ? t('deleteRelatedDataConfirm') : t('deleteCannotRecover')}`;
    if (!window.confirm(message)) return;

    setDb(prev => {
      const newDb = {
        ...prev,
        advertisers: [...prev.advertisers],
        adOrders: [...prev.adOrders],
        adIds: [...prev.adIds],
        media: [...prev.media],
        mediaOrders: [...prev.mediaOrders],
        mediaIds: [...prev.mediaIds],
        advertiserEntryRows: [...prev.advertiserEntryRows],
        mediaEntryRows: [...prev.mediaEntryRows],
        operationLogs: [...prev.operationLogs],
      };

      if (typedModal === 'newAdvertiser') {
        const relatedOrders = newDb.adOrders.filter(item => item.advId === modalRecord.id);
        const orderIds = relatedOrders.map(item => item.id);
        const relatedSlots = newDb.adIds.filter(item => item.advId === modalRecord.id || orderIds.includes(item.orderId)).map(item => item.slot);
        newDb.advertisers = newDb.advertisers.filter(item => item.id !== modalRecord.id);
        newDb.adOrders = newDb.adOrders.filter(item => item.advId !== modalRecord.id);
        newDb.adIds = newDb.adIds.filter(item => item.advId !== modalRecord.id && !orderIds.includes(item.orderId));
        newDb.advertiserEntryRows = newDb.advertiserEntryRows.filter(row =>
          row.advertiser !== modalRecord.name && !relatedSlots.some(slot => relatedSlotMatches(row.adId, slot))
        );
        newDb.mediaEntryRows = newDb.mediaEntryRows.filter(row =>
          !relatedSlots.some(slot => relatedSlotMatches(row.mediaId, slot) || relatedSlotMatches(row.upstreamAdId, slot))
        );
        newDb.operationLogs.unshift(log('deleteAdvertiser', 'pAdvertiserList', modalRecord.name));
      }

      if (typedModal === 'newAdOrder') {
        const relatedSlots = newDb.adIds.filter(item => item.orderId === modalRecord.id).map(item => item.slot);
        newDb.adOrders = newDb.adOrders.filter(item => item.id !== modalRecord.id);
        newDb.adIds = newDb.adIds.filter(item => item.orderId !== modalRecord.id);
        newDb.advertiserEntryRows = newDb.advertiserEntryRows.filter(row =>
          row.adOrder !== modalRecord.name && !relatedSlots.some(slot => relatedSlotMatches(row.adId, slot))
        );
        newDb.operationLogs.unshift(log('deleteAdOrder', 'pAdOrderMgmt', modalRecord.name));
      }

      if (typedModal === 'newAdId') {
        newDb.adIds = newDb.adIds.filter(item => item.id !== modalRecord.id);
        newDb.advertiserEntryRows = newDb.advertiserEntryRows.filter(row => !relatedSlotMatches(row.adId, modalRecord.slot));
        newDb.operationLogs.unshift(log('deleteAdId', 'pAdIdMgmt', '', modalRecord.slot));
      }

      if (typedModal === 'newMedia') {
        const orderIds = newDb.mediaOrders.filter(item => item.mediaId === modalRecord.id).map(item => item.id);
        const relatedSlots = newDb.mediaIds.filter(item => item.mediaId === modalRecord.id || orderIds.includes(item.orderId)).map(item => item.slot);
        newDb.media = newDb.media.filter(item => item.id !== modalRecord.id);
        newDb.mediaOrders = newDb.mediaOrders.filter(item => item.mediaId !== modalRecord.id);
        newDb.mediaIds = newDb.mediaIds.filter(item => item.mediaId !== modalRecord.id && !orderIds.includes(item.orderId));
        newDb.mediaEntryRows = newDb.mediaEntryRows.filter(row =>
          row.media !== modalRecord.name && !relatedSlots.some(slot => relatedSlotMatches(row.mediaId, slot))
        );
        newDb.operationLogs.unshift(log('deleteMedia', 'pMediaMgmt', modalRecord.name));
      }

      if (typedModal === 'newMediaAdOrder') {
        const relatedSlots = newDb.mediaIds.filter(item => item.orderId === modalRecord.id).map(item => item.slot);
        newDb.mediaOrders = newDb.mediaOrders.filter(item => item.id !== modalRecord.id);
        newDb.mediaIds = newDb.mediaIds.filter(item => item.orderId !== modalRecord.id);
        newDb.mediaEntryRows = newDb.mediaEntryRows.filter(row =>
          row.mediaAdOrder !== modalRecord.name && !relatedSlots.some(slot => relatedSlotMatches(row.mediaId, slot))
        );
        newDb.operationLogs.unshift(log('deleteMediaAdOrder', 'pMediaAdOrderMgmt', modalRecord.name));
      }

      if (typedModal === 'newMediaId') {
        newDb.mediaIds = newDb.mediaIds.filter(item => item.id !== modalRecord.id);
        newDb.mediaEntryRows = newDb.mediaEntryRows.filter(row => !relatedSlotMatches(row.mediaId, modalRecord.slot));
        newDb.operationLogs.unshift(log('deleteMediaId', 'pMediaIdMgmt', '', modalRecord.slot));
      }

      return newDb;
    });
    closeModal();
  };

  const renderCommonContactFields = (nameLabel: string) => (
    <>
      <div className="form-group"><label>{nameLabel}</label><input type="text" onChange={e => handleInput('name', e.target.value)} value={formData.name || ''} placeholder={nameLabel} /></div>
      <div className="form-row cols3">
        <div className="form-group"><label>{t('contact')}</label><input type="text" onChange={e => handleInput('contact', e.target.value)} value={formData.contact || ''} /></div>
        <div className="form-group"><label>{t('phone')}</label><input type="text" onChange={e => handleInput('phone', e.target.value)} value={formData.phone || ''} /></div>
        <div className="form-group">
          <label>{t('email')}</label>
          <input type="email" onChange={e => handleInput('email', e.target.value)} value={formData.email || ''} />
          {emailError && <div className="form-error">{emailError}</div>}
        </div>
      </div>
      <div className="form-group"><label>{t('notes')}</label><textarea onChange={e => handleInput('notes', e.target.value)} value={formData.notes || ''}></textarea></div>
    </>
  );

  const renderRateInput = () => (
    <div className="form-row cols2">
      <div className="form-group">
        <label>{t('type')} (CPM/CPA/CPS)</label>
        <select value={typeSelect} onChange={e => setTypeSelect(e.target.value)}>
          <option value="CPM">CPM</option>
          <option value="CPA">CPA</option>
          <option value="CPS">CPS</option>
        </select>
      </div>
      <div className="form-group">
        <label>{typeSelect === 'CPS' ? t('revenueShare') : t('unitPrice')}</label>
        <input type="text" placeholder={typeSelect === 'CPS' ? '70%' : '0.000'} onChange={e => handleInput('rate', e.target.value)} value={formData.rate || ''} />
      </div>
    </div>
  );

  const typeHelp = typeSelect === 'CPM' ? t('cpmHelp') : typeSelect === 'CPA' ? t('cpaHelp') : t('cpsHelp');

  const usedAdSlots = new Set(
    db.mediaIds
      .filter(item => !isEdit || item.id !== modalRecord?.id)
      .flatMap(item => {
        const values = [item.adSlot];
        if (!item.adSlot || !db.adIds.some(ad => ad.slot === item.adSlot)) values.push(item.slot);
        return values;
      })
      .filter(Boolean)
      .map(item => String(item))
  );
  const availableUpstreamAdIds = db.adIds.filter(item => !usedAdSlots.has(String(item.slot)));
  const upstreamAdvScoped = formData.upstreamAdvId
    ? availableUpstreamAdIds.filter(item => item.advId === Number(formData.upstreamAdvId))
    : availableUpstreamAdIds;
  const upstreamOrderScoped = formData.upstreamOrderId
    ? upstreamAdvScoped.filter(item => item.orderId === Number(formData.upstreamOrderId))
    : upstreamAdvScoped;
  const upstreamAdvertiserOptions = db.advertisers.filter(advertiser =>
    availableUpstreamAdIds.some(item => item.advId === advertiser.id)
  );
  const upstreamAdOrderOptions = db.adOrders.filter(order =>
    upstreamAdvScoped.some(item => item.orderId === order.id)
  );

  const renderBody = () => {
    switch (typedModal) {
      case 'newAdvertiser':
        return renderCommonContactFields(t('advertiserName'));
      case 'newAdOrder':
        return (
          <>
            <div className="form-group"><label>{t('selectAdvertiser')}</label>
              <select onChange={e => handleInput('advId', e.target.value)} value={formData.advId || ''}>
                <option value="">-</option>
                {db.advertisers.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}
              </select>
            </div>
            <div className="form-group"><label>{t('adOrderName')}</label><input type="text" onChange={e => handleInput('name', e.target.value)} value={formData.name || ''} /></div>
            <div className="form-group"><label>{t('notes')}</label><textarea rows={3} onChange={e => handleInput('notes', e.target.value)} value={formData.notes || ''}></textarea></div>
          </>
        );
      case 'newAdId':
        return (
          <>
            <div className="form-row cols2">
              <div className="form-group"><label>{t('selectAdvertiser')}</label>
                <select onChange={e => handleInput('advId', e.target.value)} value={formData.advId || ''}>
                  <option value="">-</option>
                  {db.advertisers.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('selectAdOrder')}</label>
                <select onChange={e => handleInput('orderId', e.target.value)} value={formData.orderId || ''}>
                  <option value="">-</option>
                  {db.adOrders.filter(o => o.advId === Number(formData.advId)).map(o => <option key={o.id} value={o.id}>{displayName(o.name)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label>{t('adId')}</label><input type="text" onChange={e => handleInput('slot', e.target.value)} value={formData.slot || ''} placeholder={t('adId')} /></div>
            {renderRateInput()}
            <div className="modal-help">{typeHelp}</div>
            <div className="form-group"><label>{t('notes')}</label><textarea rows={2} onChange={e => handleInput('notes', e.target.value)} value={formData.notes || ''}></textarea></div>
          </>
        );
      case 'newMedia':
        return renderCommonContactFields(t('mediaName'));
      case 'newMediaAdOrder':
        return (
          <>
            <div className="form-group"><label>{t('selectMedia')}</label>
              <select onChange={e => handleInput('mediaId', e.target.value)} value={formData.mediaId || ''}>
                <option value="">-</option>
                {db.media.map(m => <option key={m.id} value={m.id}>{displayName(m.name)}</option>)}
              </select>
            </div>
            <div className="form-group"><label>{t('mediaAdOrderName')}</label><input type="text" onChange={e => handleInput('name', e.target.value)} value={formData.name || ''} /></div>
            <div className="form-group"><label>{t('notes')}</label><textarea rows={3} onChange={e => handleInput('notes', e.target.value)} value={formData.notes || ''}></textarea></div>
          </>
        );
      case 'newMediaId':
        return (
          <>
            <div className="form-row cols3">
              <div className="form-group"><label>{t('selectAdvertiser')}</label>
                <select onChange={e => handleUpstreamAdvertiserChange(e.target.value)} value={formData.upstreamAdvId || ''}>
                  <option value="">-</option>
                  {upstreamAdvertiserOptions.map(a => <option key={a.id} value={a.id}>{displayName(a.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('selectAdOrder')}</label>
                <select onChange={e => handleUpstreamOrderChange(e.target.value)} value={formData.upstreamOrderId || ''}>
                  <option value="">-</option>
                  {upstreamAdOrderOptions.map(o => <option key={o.id} value={o.id}>{displayName(o.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('selectAdSlot')}</label>
                <select onChange={e => handleUpstreamAdIdChange(e.target.value)} value={formData.adSlot || ''}>
                  <option value="">{upstreamOrderScoped.length ? '-' : t('noAvailableAdIds')}</option>
                  {upstreamOrderScoped.map(o => <option key={o.id} value={o.slot}>{o.slot}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row cols3">
              <div className="form-group"><label>{t('selectMedia')}</label>
                <select onChange={e => setFormData((prev: any) => ({ ...prev, mediaId: e.target.value, orderId: '' }))} value={formData.mediaId || ''}>
                  <option value="">-</option>
                  {db.media.map(m => <option key={m.id} value={m.id}>{displayName(m.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('selectMediaAdOrder')}</label>
                <select onChange={e => handleInput('orderId', e.target.value)} value={formData.orderId || ''}>
                  <option value="">-</option>
                  {db.mediaOrders.filter(o => o.mediaId === Number(formData.mediaId)).map(o => <option key={o.id} value={o.id}>{displayName(o.name)}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('shareRatio')}</label><input type="text" onChange={e => handleInput('shareRatio', e.target.value)} value={formData.shareRatio || ''} placeholder="80%" /></div>
            </div>
            <div className="form-group"><label>{t('mediaSlot')}</label><input type="text" onChange={e => handleInput('slot', e.target.value)} value={formData.slot || ''} placeholder={t('mediaSlot')} /></div>
            {renderRateInput()}
            <div className="modal-help">{typeHelp}</div>
            <div className="form-group"><label>{t('notes')}</label><textarea rows={2} onChange={e => handleInput('notes', e.target.value)} value={formData.notes || ''}></textarea></div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{titles[typedModal] || modal}</span>
          <button className="modal-close" onClick={closeModal}>x</button>
        </div>
        <div className="modal-body">
          {renderBody()}
        </div>
        <div className="modal-footer">
          {isEdit && <button className="btn-danger" onClick={deleteRecord}>{t('delete')}</button>}
          <button className="btn-outline" onClick={closeModal}>{t('cancel')}</button>
          <button className="btn-primary" onClick={submitModal}>{t('submit')}</button>
        </div>
      </div>
    </div>
  );
}
