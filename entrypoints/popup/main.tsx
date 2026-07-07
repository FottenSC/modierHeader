import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { APPLY_RULES_MESSAGE, OPEN_OPTIONS_MESSAGE } from '../../src/shared/messages';
import { countEnabledRules } from '../../src/shared/compiler';
import { getState, setState } from '../../src/shared/storage';
import type { CleanHeaderState } from '../../src/shared/types';
import './style.css';

type SitePermission = {
  host: string;
  pattern: string;
  granted: boolean;
};

function Popup() {
  const [state, setLocalState] = useState<CleanHeaderState | null>(null);
  const [status, setStatus] = useState('Loading...');
  const [sitePermission, setSitePermission] = useState<SitePermission | null>(null);

  useEffect(() => {
    getState()
      .then((next) => {
        setLocalState(next);
        setStatus(next.lastApply?.message ?? 'Ready.');
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));

    refreshSitePermission().catch(() => setSitePermission(null));
  }, []);

  const activeProfile = useMemo(
    () => state?.profiles.find((profile) => profile.id === state.activeProfileId),
    [state],
  );

  async function save(next: CleanHeaderState) {
    setLocalState(next);
    await setState(next);
    const diagnostics = (await browser.runtime.sendMessage({ type: APPLY_RULES_MESSAGE })) as CleanHeaderState['lastApply'];
    if (diagnostics?.message) setStatus(diagnostics.message);
  }

  async function refreshSitePermission() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    const url = new URL(tab.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    const pattern = `${url.origin}/*`;
    const granted = await browser.permissions.contains({ origins: [pattern] });
    setSitePermission({ host: url.host, pattern, granted });
  }

  async function requestCurrentSitePermission() {
    if (!sitePermission) return;
    const granted = await browser.permissions.request({ origins: [sitePermission.pattern] });
    setSitePermission({ ...sitePermission, granted });
    setStatus(granted ? `Permission granted for ${sitePermission.host}.` : 'Permission was not granted.');
  }

  if (!state) {
    return <main className="popup">Loading...</main>;
  }

  return (
    <main className="popup">
      <header>
        <div>
          <h1>CleanHeader</h1>
          <p>{countEnabledRules(state)} enabled rule(s)</p>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(event) => save({ ...state, enabled: event.target.checked })}
          />
          <span>{state.enabled ? 'On' : 'Off'}</span>
        </label>
      </header>

      <label className="field">
        Active profile
        <select
          value={state.activeProfileId}
          onChange={(event) => save({ ...state, activeProfileId: event.target.value })}
        >
          {state.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </label>

      {activeProfile && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={activeProfile.enabled}
            onChange={(event) =>
              save({
                ...state,
                profiles: state.profiles.map((profile) =>
                  profile.id === activeProfile.id ? { ...profile, enabled: event.target.checked } : profile,
                ),
              })
            }
          />
          Profile enabled
        </label>
      )}

      {sitePermission && (
        <section className="site-permission" aria-label="Current site permission">
          <span>{sitePermission.host}</span>
          {sitePermission.granted ? (
            <strong>Allowed</strong>
          ) : (
            <button type="button" onClick={requestCurrentSitePermission}>
              Allow site
            </button>
          )}
        </section>
      )}

      <p className={state.lastApply?.ok === false ? 'status error' : 'status'}>{status}</p>

      <button type="button" onClick={() => browser.runtime.sendMessage({ type: OPEN_OPTIONS_MESSAGE })}>
        Open options
      </button>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
