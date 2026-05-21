import React, { createContext, useContext, useState } from 'react';
import { initialDb, i18n } from './lib/data';
import { displayName as localizeName, renderOperationLog, type Lang, type OperationLog } from './lib/i18n';

type DetailPresetFilter = {
  ownerId: string;
  orderId: string;
} | null;

type ModalState = {
  type: string;
  record?: any;
} | null;

interface AppState {
  lang: Lang;
  setLang: (l: Lang) => void;
  currentPage: string;
  setCurrentPage: (p: string) => void;
  db: typeof initialDb;
  setDb: React.Dispatch<React.SetStateAction<typeof initialDb>>;
  t: (key: string) => string;
  modal: string | null;
  modalRecord: any;
  modalMode: 'create' | 'edit';
  openModal: (type: string, record?: any) => void;
  closeModal: () => void;
  displayName: (value: string | number | undefined | null) => string;
  renderLog: (log: OperationLog) => string;
  adIdPresetFilter: DetailPresetFilter;
  mediaIdPresetFilter: DetailPresetFilter;
  navigateToAdIds: (advId: number, orderId: number) => void;
  navigateToMediaIds: (mediaId: number, orderId: number) => void;
  clearAdIdPresetFilter: () => void;
  clearMediaIdPresetFilter: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('zh');
  const [currentPage, setCurrentPage] = useState('pAdvertiserList');
  const [db, setDb] = useState(initialDb);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [adIdPresetFilter, setAdIdPresetFilter] = useState<DetailPresetFilter>(null);
  const [mediaIdPresetFilter, setMediaIdPresetFilter] = useState<DetailPresetFilter>(null);

  const t = (key: string) => {
    return (i18n[lang] as any)[key] || key;
  };

  const displayName = (value: string | number | undefined | null) => localizeName(value, lang);
  const renderLog = (log: OperationLog) => renderOperationLog(log, lang);

  const navigateToAdIds = (advId: number, orderId: number) => {
    setAdIdPresetFilter({ ownerId: String(advId), orderId: String(orderId) });
    setCurrentPage('pAdIdMgmt');
  };

  const navigateToMediaIds = (mediaId: number, orderId: number) => {
    setMediaIdPresetFilter({ ownerId: String(mediaId), orderId: String(orderId) });
    setCurrentPage('pMediaIdMgmt');
  };

  return (
    <AppContext.Provider value={{
      lang,
      setLang,
      currentPage,
      setCurrentPage,
      db,
      setDb,
      t,
      modal: modalState?.type || null,
      modalRecord: modalState?.record || null,
      modalMode: modalState?.record ? 'edit' : 'create',
      openModal: (type, record) => setModalState({ type, record }),
      closeModal: () => setModalState(null),
      displayName,
      renderLog,
      adIdPresetFilter,
      mediaIdPresetFilter,
      navigateToAdIds,
      navigateToMediaIds,
      clearAdIdPresetFilter: () => setAdIdPresetFilter(null),
      clearMediaIdPresetFilter: () => setMediaIdPresetFilter(null),
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('Missing AppProvider');
  return ctx;
};
