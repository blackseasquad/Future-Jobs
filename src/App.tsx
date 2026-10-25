import { useCallback, useState } from 'react';
import { careers } from './data/careers';
import { useAuth } from './hooks/useAuth';
import { useFavorites } from './hooks/useFavorites';
import { useKnownSkills } from './hooks/useKnownSkills';
import { useMarketData } from './hooks/useMarketData';
import { useToast } from './hooks/useToast';
import { exportFavorites } from './lib/exportFavorites';
import type { Tab } from './types';

import AnalyticsTab from './components/AnalyticsTab';
import Assistant from './components/Assistant';
import AuthModal from './components/AuthModal';
import CareerModal from './components/CareerModal';
import CatalogTab from './components/CatalogTab';
import FavoritesModal from './components/FavoritesModal';
import Header from './components/Header';
import Hero from './components/Hero';
import QuizTab from './components/QuizTab';
import SimulatorTab from './components/SimulatorTab';
import SkillsTab from './components/SkillsTab';
import Toast from './components/Toast';

// Readable section names sent to the assistant so it knows where the visitor is.
const TAB_LABELS: Record<string, string> = {
  catalog: 'Каталог Професии',
  quiz: 'Тест за съвместимост',
  analytics: 'Анализи & Трендове',
  skills: 'Топ Умения',
  simulator: 'Един ден през 2035',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('catalog');
  const [openCareerId, setOpenCareerId] = useState<string | null>(null);
  const [simRoleId, setSimRoleId] = useState(careers[0].id);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const { toast, notify } = useToast();
  const auth = useAuth(notify);
  const { favorites, toggle, isFavorite } = useFavorites(auth.user, notify);
  const market = useMarketData();
  const knownSkills = useKnownSkills(auth.user);

  const simulate = useCallback((id: string) => {
    setSimRoleId(id);
    setTab('simulator');
  }, []);

  const handleExport = () => {
    const items = careers.filter((c) => favorites.includes(c.id));
    if (items.length === 0) return notify('Нямате запазени професии за изтегляне!');
    exportFavorites(items);
    notify('Планът беше изтеглен!');
  };

  const openCareer = careers.find((c) => c.id === openCareerId) ?? null;
  const user = auth.user;
  const userLabel = user
    ? user.email
      ? user.email.split('@')[0]
      : user.is_anonymous
        ? 'Гост'
        : user.id.substring(0, 6)
    : 'Вход';

  return (
    <div className="app">
      <Header
        tab={tab}
        onTab={setTab}
        favCount={favorites.length}
        userLabel={userLabel}
        onOpenFavorites={() => setShowFavorites(true)}
        onOpenAuth={() => setShowAuth(true)}
      />
      <Hero />

      <main className="main">
        {tab === 'catalog' && (
          <CatalogTab
            market={market.data}
            isFavorite={isFavorite}
            onToggleFavorite={toggle}
            onOpen={setOpenCareerId}
            onSimulate={simulate}
          />
        )}
        {tab === 'quiz' && <QuizTab onOpenCareer={setOpenCareerId} />}
        {tab === 'analytics' && (
          <AnalyticsTab market={market.data} marketError={market.error} onReloadMarket={market.reload} user={auth.user} notify={notify} />
        )}
        {tab === 'skills' && (
          <SkillsTab market={market.data} favorites={favorites} knownSkills={knownSkills.known} onToggleKnown={knownSkills.toggle} />
        )}
        {tab === 'simulator' && <SimulatorTab roleId={simRoleId} onChange={setSimRoleId} />}
      </main>

      <footer className="footer">
        <p>© 2026 Интерактивен Навигатор "Професии на Бъдещето". Създаден за образователни и кариерни цели.</p>
      </footer>

      {openCareer && (
        <CareerModal
          market={market.data}
          career={openCareer}
          isFavorite={isFavorite(openCareer.id)}
          onToggleFavorite={toggle}
          onClose={() => setOpenCareerId(null)}
        />
      )}

      {showFavorites && (
        <FavoritesModal
          favorites={favorites}
          onToggleFavorite={toggle}
          onExport={handleExport}
          onClose={() => setShowFavorites(false)}
        />
      )}

      {showAuth && (
        <AuthModal
          user={user}
          onSignIn={auth.signIn}
          onSignUp={auth.signUp}
          onAnonymous={auth.signInAnonymously}
          onSignOut={auth.signOut}
          onClose={() => setShowAuth(false)}
          onInvalid={notify}
        />
      )}

      <Toast message={toast.message} visible={toast.visible} />

      <Assistant currentTab={TAB_LABELS[tab] ?? tab} />
    </div>
  );
}
