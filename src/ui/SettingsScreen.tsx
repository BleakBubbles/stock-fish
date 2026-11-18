import { type FormEvent, useState } from 'react';
import { type Backup, exportBackup, restoreBackup, validateBackup } from '../data/backup';
import type { ProviderId, Settings } from '../data/model';
import {
  PROVIDERS,
  type KeyTestResult,
  providerFromSettings,
  testProvider,
} from '../data/providers';
import { normalizeCurrency } from '../data/currency';
import { db, repo, useSettings } from '../data/store';
import { useHomeCurrency, useMarketEntries } from '../data/useMarket';
import { downloadText } from './files';
import { promptInstall, useInstallState } from './install';
import { PixelButton } from './pixel/PixelButton';
import { PixelInput } from './pixel/PixelInput';
import {
  PixelChoice,
  PixelField,
  PixelFileButton,
  PixelHeading,
  PixelLink,
  PixelParagraph,
} from './pixel/blocks';

export function SettingsScreen() {
  const settings = useSettings();
  if (!settings) return null;
  return (
    <section className="px-stack px-page-stack" aria-labelledby="settings-title">
      <PixelHeading text="Settings" id="settings-title" />
      <MarketDataSettings settings={settings} />
      <CurrencySettings settings={settings} />
      <BackupSettings />
      <InstallSettings />
      <div className="px-panel px-stack px-wide">
        <PixelHeading text="About" level={3} />
        <PixelParagraph text="Not investment advice." tone="warning" />
        <PixelParagraph text="Stock Fish only shows prices, for fun. It never trades and never says what to buy or sell." />
        <PixelParagraph
          text="Your fish and key stay in this browser. Clearing site data empties the tank, so export a backup now and then."
          tone="textMuted"
        />
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

  async function save(e: FormEvent) {
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
    <form className="px-panel px-stack px-wide" onSubmit={(e) => void save(e)}>
      <PixelHeading text="Market data" level={3} />
      <PixelField label="Source">
        <PixelChoice
          label="Source"
          options={PROVIDERS.map((p) => ({ value: p.id, label: p.name }))}
          value={provider}
          onChange={(id) => {
            setProvider(id);
            setSaved(false);
            setTest(undefined);
          }}
        />
      </PixelField>
      {needsKey && (
        <>
          <PixelField label="Twelve Data API key">
            <div className="px-input-row">
              <PixelInput
                label="Twelve Data API key"
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(v) => {
                  setKey(v);
                  setSaved(false);
                  setTest(undefined);
                }}
              />
              <PixelButton
                label={showKey ? 'Hide' : 'Show'}
                aria-pressed={showKey}
                onClick={() => setShowKey(!showKey)}
              />
            </div>
          </PixelField>
          <div className="px-row">
            <PixelLink href="https://twelvedata.com/pricing" text="Get a free key" />
          </div>
          <PixelParagraph
            text="It stays in this browser and goes only to Twelve Data. Free plan: 800 requests a day."
            tone="textMuted"
          />
        </>
      )}
      <div className="px-row">
        <PixelButton type="submit" label="Save" primary />
        <PixelButton
          label={test === 'running' ? 'Testing…' : needsKey ? 'Test key' : 'Test'}
          disabled={test === 'running'}
          onClick={() => void runTest()}
        />
      </div>
      <div role="status" className="px-stack">
        {saved && <PixelParagraph text="Saved." tone="success" />}
        {test && test !== 'running' && (
          <PixelParagraph text={test.detail} tone={test.ok ? 'success' : 'warning'} />
        )}
      </div>
    </form>
  );
}

const COMMON_CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY'];
const AUTO = 'auto';

/** The currency totals are shown in. Fish keep their own stock's currency. */
function CurrencySettings({ settings }: { settings: Settings }) {
  const home = useHomeCurrency();
  const entries = useMarketEntries();
  const held = [...(entries?.values() ?? [])].flatMap((e) =>
    e.quote?.currency ? [normalizeCurrency(e.quote.currency).code] : [],
  );
  const codes = [...new Set([...COMMON_CURRENCIES, ...held])];
  const value = settings.homeCurrency ?? AUTO;
  return (
    <div className="px-panel px-stack px-wide">
      <PixelHeading text="Currency" level={3} />
      <PixelParagraph
        text="Totals (weather, groups, territory) are shown in one currency. Each fish keeps its own."
        tone="textMuted"
      />
      <PixelChoice
        label="Home currency"
        options={[
          { value: AUTO, label: settings.homeCurrency ? 'Automatic' : `Automatic (${home})` },
          ...codes.map((c) => ({ value: c, label: c })),
        ]}
        value={value}
        onChange={(v) => void repo.saveSettings({ homeCurrency: v === AUTO ? undefined : v })}
      />
      <PixelParagraph
        text="Automatic uses the currency most of your holdings are in. Rates update twice a day."
        tone="textMuted"
      />
    </div>
  );
}

/** Add Stock Fish to the home screen or desktop, as an app that also opens offline. */
function InstallSettings() {
  const state = useInstallState();
  return (
    <div className="px-panel px-stack px-wide">
      <PixelHeading text="App" level={3} />
      {state === 'installed' ? (
        <PixelParagraph
          text="Installed. Stock Fish opens like an app, even offline."
          tone="success"
        />
      ) : (
        <>
          <PixelParagraph
            text="Install Stock Fish to open it like an app. It works offline, showing the last prices it saw."
            tone="textMuted"
          />
          {state === 'available' && (
            <div className="px-row">
              <PixelButton label="Install app" primary onClick={() => void promptInstall()} />
            </div>
          )}
          {state === 'ios' && (
            <PixelParagraph text="On iPhone or iPad: tap Share, then Add to Home Screen." />
          )}
          {state === 'menu' && (
            <PixelParagraph text="Use your browser's menu: Install, or Add to Home screen." />
          )}
        </>
      )}
    </div>
  );
}

function BackupSettings() {
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
      return setMessage({ ok: false, text: "That file isn't a backup (not valid JSON)." });
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
      text: `Restored ${pending.holdings.length} fish in ${pending.pens.length} pens.`,
    });
    setPending(undefined);
  }

  return (
    <div className="px-panel px-stack px-wide">
      <PixelHeading text="Backup" level={3} />
      <PixelParagraph
        text="A file with your pens, fish and colours. Your API key isn't in it."
        tone="textMuted"
      />
      <div className="px-row">
        <PixelButton label="Export backup" onClick={() => void exportJson()} />
        <PixelFileButton
          label="Import backup…"
          accept=".json,application/json"
          onFile={(f) => void readFile(f)}
        />
      </div>
      {pending && (
        <div className="px-stack" role="alertdialog" aria-label="Confirm restore">
          <PixelParagraph
            text={`Replace your whole tank with this backup (${pending.holdings.length} fish in ${pending.pens.length} pens)? Your current fish will be lost.`}
            tone="warning"
          />
          <div className="px-row">
            <PixelButton label="Replace my tank" onClick={() => void restore()} />
            <PixelButton label="Cancel" onClick={() => setPending(undefined)} />
          </div>
        </div>
      )}
      <div role="status">
        {message && (
          <PixelParagraph text={message.text} tone={message.ok ? 'success' : 'warning'} />
        )}
      </div>
    </div>
  );
}
