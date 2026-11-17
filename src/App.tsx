import { useEffect, useState } from 'react';
import { repo, useHoldings } from './data/store';
import { useMarketRefresh } from './data/useMarket';
import { AddHolding } from './ui/AddHolding';
import { EditHolding } from './ui/EditHolding';
import { HoldingsScreen } from './ui/HoldingsScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { TankScreen } from './ui/TankScreen';
import { PixelButton } from './ui/pixel/PixelButton';
import { PixelCheck } from './ui/pixel/PixelCheck';
import { PixelRoot, Rescale } from './ui/pixel/PixelRoot';
import { PixelText } from './ui/pixel/PixelText';

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
    <>
      <PixelRoot className="app">
        <header className="topbar">
          <h1>
            <PixelText text="Stock Fish" />
          </h1>
          <nav aria-label="Main" className="px-row">
            {TABS.map((t) => (
              <PixelButton
                key={t.name}
                label={t.label}
                active={activeTab === t.name}
                aria-current={activeTab === t.name ? 'page' : undefined}
                onClick={() => setView({ name: t.name })}
              />
            ))}
          </nav>
        </header>
        <main className="main">
          {view.name === 'tank' ? (
            <TankScreen
              market={market}
              onAdd={() => setView({ name: 'add' })}
              onChangeColours={(id) =>
                setView({ name: 'edit', id, focus: 'colours', returnTo: 'tank' })
              }
              onSettings={() => setView({ name: 'settings' })}
            />
          ) : (
            // Not converted to pixel UI yet (milestone 6): normal CSS pixels.
            <Rescale unit="css">
              <div className="main-scroll">
                {view.name === 'holdings' && (
                  <HoldingsScreen
                    onAdd={() => setView({ name: 'add' })}
                    onEdit={(id) =>
                      setView({ name: 'edit', id, focus: 'details', returnTo: 'holdings' })
                    }
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
              </div>
            </Rescale>
          )}
        </main>
      </PixelRoot>
      {new URLSearchParams(window.location.search).has('pixels') && <PixelCheck />}
    </>
  );
}
