import { useEffect, useState } from 'react';
import { repo, useHoldings } from './data/store';
import { useMarketRefresh } from './data/useMarket';
import { AddHolding } from './ui/AddHolding';
import { EditHolding } from './ui/EditHolding';
import { HoldingsScreen } from './ui/HoldingsScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { TankScreen } from './ui/TankScreen';

type TabView = { name: 'tank' | 'holdings' | 'settings' };

type View =
  | TabView
  | { name: 'add' }
  | { name: 'edit'; id: string; focus: 'details' | 'colours'; returnTo: TabView['name'] };

const TABS = [
  { name: 'tank', label: 'Tank' },
  { name: 'holdings', label: 'Holdings' },
  { name: 'settings', label: 'Settings' },
] as const;

export function App() {
  const [view, setView] = useState<View>({ name: 'tank' });
  const holdings = useHoldings();
  // Keeps prices fresh whichever screen is showing.
  const market = useMarketRefresh();

  useEffect(() => {
    void repo.ensureDefaultPen();
  }, []);

  const activeTab =
    view.name === 'add' ? 'holdings' : view.name === 'edit' ? view.returnTo : view.name;
  const toHoldings = () => setView({ name: 'holdings' });
  const backFromEdit = () => setView({ name: view.name === 'edit' ? view.returnTo : 'holdings' });
  const editing = view.name === 'edit' ? holdings?.find((h) => h.id === view.id) : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <h1>Stock Fish</h1>
        <nav aria-label="Main">
          {TABS.map((t) => (
            <button
              key={t.name}
              type="button"
              className={`tab${activeTab === t.name ? ' is-active' : ''}`}
              aria-current={activeTab === t.name ? 'page' : undefined}
              onClick={() => setView({ name: t.name })}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className={view.name === 'tank' ? 'main is-tank' : 'main'}>
        {view.name === 'tank' && (
          <TankScreen
            market={market}
            onAdd={() => setView({ name: 'add' })}
            onChangeColours={(id) =>
              setView({ name: 'edit', id, focus: 'colours', returnTo: 'tank' })
            }
            onSettings={() => setView({ name: 'settings' })}
          />
        )}
        {view.name === 'holdings' && (
          <HoldingsScreen
            onAdd={() => setView({ name: 'add' })}
            onEdit={(id) => setView({ name: 'edit', id, focus: 'details', returnTo: 'holdings' })}
            onColours={(id) =>
              setView({ name: 'edit', id, focus: 'colours', returnTo: 'holdings' })
            }
          />
        )}
        {view.name === 'add' && <AddHolding onDone={toHoldings} />}
        {view.name === 'edit' && editing && (
          <EditHolding
            key={editing.id}
            holding={editing}
            focus={view.focus}
            onDone={backFromEdit}
          />
        )}
        {view.name === 'settings' && <SettingsScreen />}
      </main>
    </div>
  );
}
