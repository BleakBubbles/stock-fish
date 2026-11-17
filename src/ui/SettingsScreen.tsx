import { useRef, useState } from 'react';
import { type Backup, exportBackup, restoreBackup, validateBackup } from '../data/backup';
import type { ProviderId, Settings } from '../data/model';
import {
  PROVIDERS,
  type KeyTestResult,
  providerFromSettings,
  testProvider,
} from '../data/providers';
import { db, repo, useSettings } from '../data/store';
import { downloadText } from './files';

export function SettingsScreen() {
  const settings = useSettings();
  if (!settings) return null;
  return (
    <section className="stack" aria-labelledby="settings-title">
      <h2 id="settings-title" className="visually-hidden">
        Settings
      </h2>
      <MarketDataSettings settings={settings} />
      <BackupSettings />
      <div className="panel stack">
        <h3>About</h3>
        <p>
          <strong>Not investment advice.</strong> Stock Fish only displays prices for fun. It never
          executes trades and doesn't tell you what to buy or sell.
        </p>
        <p className="muted">
          Your holdings and key stay in this browser. Clearing site data wipes the tank, so export a
          backup now and then.
        </p>
      </div>
    </section>
  );
}

function MarketDataSettings({ settings }: { settings: Settings }) {
  const [provider, setProvider] = useState<ProviderId>(settings.provider);
  const [key, setKey] = useState(settings.apiKeys.twelvedata ?? '');
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<KeyTestResult | 'running'>();
  const [saved, setSaved] = useState(false);

  const draft: Settings = {
    provider,
    apiKeys: { ...settings.apiKeys, twelvedata: key.trim() || undefined },
  };
  const needsKey = PROVIDERS.find((p) => p.id === provider)?.needsKey ?? false;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await repo.saveSettings(draft);
    setSaved(true);
  }

  async function runTest() {
    const p = providerFromSettings(draft);
    if (!p) return setTest({ ok: false, detail: 'Enter a key first.' });
    setTest('running');
    setTest(await testProvider(p));
  }

  return (
    <form className="panel stack" onSubmit={save}>
      <h3>Market data</h3>
      <fieldset className="stack">
        <legend>Source</legend>
        {PROVIDERS.map((p) => (
          <label key={p.id} className="choice">
            <input
              type="radio"
              name="provider"
              value={p.id}
              checked={provider === p.id}
              onChange={() => {
                setProvider(p.id);
                setSaved(false);
                setTest(undefined);
              }}
            />
            {p.name}
          </label>
        ))}
      </fieldset>
      {needsKey && (
        <>
          <div className="field">
            <label htmlFor="api-key">Twelve Data API key</label>
            <div className="inline">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setSaved(false);
                  setTest(undefined);
                }}
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="button" onClick={() => setShowKey(!showKey)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <p className="muted">
            Get a free key at{' '}
            <a href="https://twelvedata.com/pricing" target="_blank" rel="noreferrer">
              twelvedata.com
            </a>
            . It's stored only in this browser and sent only to Twelve Data. The free plan allows
            800 requests a day.
          </p>
        </>
      )}
      <div className="actions">
        <button type="submit" className="button is-primary">
          Save
        </button>
        <button type="button" className="button" onClick={runTest} disabled={test === 'running'}>
          {test === 'running' ? 'Testing…' : needsKey ? 'Test key' : 'Test'}
        </button>
      </div>
      <div role="status">
        {saved && <p className="message is-success">Saved.</p>}
        {test && test !== 'running' && (
          <p className={`message ${test.ok ? 'is-success' : 'is-warning'}`}>{test.detail}</p>
        )}
      </div>
    </form>
  );
}

function BackupSettings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  async function exportJson() {
    const backup = await exportBackup(db);
    const date = backup.exportedAt.slice(0, 10);
    downloadText(`stock-fish-${date}.json`, JSON.stringify(backup, null, 2), 'application/json');
  }

  async function readFile(file: File) {
    setPending(undefined);
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return setMessage({ ok: false, text: 'That file is not valid JSON.' });
    }
    const result = validateBackup(data);
    if (!result.ok) return setMessage({ ok: false, text: result.errors.join(' ') });
    setMessage(undefined);
    setPending(result.backup);
  }

  async function restore() {
    if (!pending) return;
    await restoreBackup(db, pending);
    setMessage({
      ok: true,
      text: `Restored ${pending.holdings.length} holdings in ${pending.pens.length} pens.`,
    });
    setPending(undefined);
  }

  return (
    <div className="panel stack">
      <h3>Backup</h3>
      <p className="muted">
        A JSON file with your pens and holdings. It doesn't include your API key.
      </p>
      <div className="actions">
        <button type="button" className="button" onClick={exportJson}>
          Export backup
        </button>
        <button type="button" className="button" onClick={() => fileRef.current?.click()}>
          Import backup…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void readFile(file);
          }}
        />
      </div>
      {pending && (
        <div className="stack" role="alertdialog" aria-label="Confirm restore">
          <p className="message is-warning">
            Replace everything in your tank with this backup ({pending.holdings.length} holdings in{' '}
            {pending.pens.length} pens)? Your current holdings will be lost.
          </p>
          <div className="actions">
            <button type="button" className="button" onClick={restore}>
              Replace my tank
            </button>
            <button type="button" className="button" onClick={() => setPending(undefined)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <div role="status">
        {message && (
          <p className={`message ${message.ok ? 'is-success' : 'is-warning'}`}>{message.text}</p>
        )}
      </div>
    </div>
  );
}
