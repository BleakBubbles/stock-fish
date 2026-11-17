import { useEffect, useState } from 'react';
import { repo, useHoldings } from './data/store';
import { Tank } from './tank/Tank';
import { AddHolding } from './ui/AddHolding';
import { EditHolding } from './ui/EditHolding';
import { HoldingsScreen } from './ui/HoldingsScreen';
import { SettingsScreen } from './ui/SettingsScreen';

type TabView = { name: 'tank' | 'holdings' | 'settings' };

type View = TabView | { name: 'add' } | { name: 'edit'; id: string; focus: 'details' | 'colours' };

const TABS = [
  { name: 'tank', label: 'Tank' },
  { name: 'holdings', label: 'Holdings' },
  { name: 'settings', label: 'Settings' },
] as const;

export function App() {
  const [view, setView] = useState<View>({ name: 'tank' });
  const holdings = useHoldings();

  useEffect(() => {
    void repo.ensureDefaultPen();
  }, []);

  const activeTab = view.name === 'add' || view.name === 'edit' ? 'holdings' : view.name;
  const toHoldings = () => setView({ name: 'holdings' });
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
          <>
            <Tank />
            {holdings?.length === 0 && (
              <div className="tank-empty panel stack">
                <p>Your tank is empty.</p>
                <button
                  type="button"
                  className="button is-primary"
                  onClick={() => setView({ name: 'add' })}
                >
                  Add your first fish
                </button>
              </div>
            )}
          </>
        )}
        {view.name === 'holdings' && (
          <HoldingsScreen
            onAdd={() => setView({ name: 'add' })}
            onEdit={(id) => setView({ name: 'edit', id, focus: 'details' })}
            onColours={(id) => setView({ name: 'edit', id, focus: 'colours' })}
          />
        )}
        {view.name === 'add' && <AddHolding onDone={toHoldings} />}
        {view.name === 'edit' && editing && (
          <EditHolding key={editing.id} holding={editing} focus={view.focus} onDone={toHoldings} />
        )}
        {view.name === 'settings' && <SettingsScreen />}
      </main>
    </div>
  );
}
