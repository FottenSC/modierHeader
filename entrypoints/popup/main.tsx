import '@digdir/designsystemet-css';
import '@digdir/designsystemet-css/theme';
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Alert,
  Button,
  Field,
  Heading,
  Label,
  Paragraph,
  Select,
  SelectOption,
  Switch,
  Tag,
} from '@digdir/designsystemet-react';
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
    return (
      <main className="popup" data-color-scheme="light" data-color="brand1" data-size="sm">
        <Paragraph data-size="sm">Loading...</Paragraph>
      </main>
    );
  }

  return (
    <main className="popup" data-color-scheme="light" data-color="brand1" data-size="sm">
      <header className="popup__header">
        <div>
          <Heading level={1} data-size="xs">
            CleanHeader
          </Heading>
          <Paragraph data-size="sm" className="popup__subtle">
            {countEnabledRules(state)} enabled rule(s)
          </Paragraph>
        </div>
        <Switch
          aria-label="Extension enabled"
          checked={state.enabled}
          onChange={(event) => save({ ...state, enabled: event.target.checked })}
        />
      </header>

      <Field>
        <Label>Active profile</Label>
        <Select
          value={state.activeProfileId}
          onChange={(event) => save({ ...state, activeProfileId: event.target.value })}
        >
          {state.profiles.map((profile) => (
            <SelectOption key={profile.id} value={profile.id}>
              {profile.name}
            </SelectOption>
          ))}
        </Select>
      </Field>

      {activeProfile && (
        <Switch
          label="Profile enabled"
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
      )}

      {sitePermission && (
        <section className="site-permission" aria-label="Current site permission">
          <div className="site-permission__text">
            <Paragraph data-size="xs" className="popup__subtle">
              Current site
            </Paragraph>
            <Paragraph data-size="sm">{sitePermission.host}</Paragraph>
          </div>
          {sitePermission.granted ? (
            <Tag data-color="success">Allowed</Tag>
          ) : (
            <Button type="button" variant="secondary" onClick={requestCurrentSitePermission}>
              Allow site
            </Button>
          )}
        </section>
      )}

      <Alert data-color={state.lastApply?.ok === false ? 'danger' : 'info'}>{status}</Alert>

      <Button type="button" onClick={() => browser.runtime.sendMessage({ type: OPEN_OPTIONS_MESSAGE })}>
        Open options
      </Button>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
