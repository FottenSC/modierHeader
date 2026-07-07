import '@digdir/designsystemet-css';
import '@digdir/designsystemet-css/theme';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Alert,
  Button,
  Card,
  Field,
  Heading,
  Label,
  Paragraph,
  Select,
  SelectOption,
  Switch,
  Tag,
  Textfield,
  ValidationMessage,
} from '@digdir/designsystemet-react';
import { browser } from 'wxt/browser';
import { APPLY_RULES_MESSAGE } from '../../src/shared/messages';
import { compileStateToDnr, countEnabledRules } from '../../src/shared/compiler';
import { createEmptyRule, createProfile } from '../../src/shared/defaults';
import { createExportPayload, parseImportPayload } from '../../src/shared/exporter';
import { getState, setState } from '../../src/shared/storage';
import { APP_NAME } from '../../src/shared/constants';
import { parseList, validateState } from '../../src/shared/validation';
import type { ModierHeadersProfile, ModierHeadersRule, ModierHeadersState } from '../../src/shared/types';
import type { ChangeEvent, ChangeEventHandler, ReactNode } from 'react';
import './style.css';

type SelectFieldProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  label: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  value: string;
};

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function SelectField({ children, className, disabled, label, onChange, value }: SelectFieldProps) {
  return (
    <Field className={className}>
      <Label>{label}</Label>
      <Select disabled={disabled} value={value} onChange={onChange}>
        {children}
      </Select>
    </Field>
  );
}

const REDIRECT_PLACEHOLDER = ['https', '://new.example/\\1'].join('');

function OptionsApp() {
  const [draft, setDraft] = useState<ModierHeadersState | null>(null);
  const [status, setStatus] = useState('Loading...');
  const [hasAllUrls, setHasAllUrls] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getState()
      .then((state) => {
        setDraft(cloneState(state));
        setStatus(state.lastApply?.message ?? 'Ready.');
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));

    browser.permissions
      .contains({ origins: ['<all_urls>'] })
      .then(setHasAllUrls)
      .catch(() => setHasAllUrls(false));
  }, []);

  const activeProfile = useMemo(
    () => draft?.profiles.find((profile) => profile.id === draft.activeProfileId),
    [draft],
  );

  const validationIssues = useMemo(() => (draft ? validateState(draft) : []), [draft]);
  const compileResult = useMemo(() => (draft ? compileStateToDnr(draft) : null), [draft]);

  function updateActiveProfile(updater: (profile: ModierHeadersProfile) => ModierHeadersProfile) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        profiles: current.profiles.map((profile) =>
          profile.id === current.activeProfileId ? updater(profile) : profile,
        ),
      };
    });
  }

  function updateRule(ruleId: string, updater: (rule: ModierHeadersRule) => ModierHeadersRule) {
    updateActiveProfile((profile) => ({
      ...profile,
      rules: profile.rules.map((rule) => (rule.id === ruleId ? updater(rule) : rule)),
    }));
  }

  async function save() {
    if (!draft) return;
    const issues = validateState(draft);
    if (issues.length > 0) {
      setStatus(`Fix ${issues.length} validation issue(s) before saving.`);
      return;
    }
    await setState(draft);
    const diagnostics = (await browser.runtime.sendMessage({ type: APPLY_RULES_MESSAGE })) as ModierHeadersState['lastApply'];
    setDraft({ ...draft, lastApply: diagnostics });
    setStatus(diagnostics?.message ?? 'Saved.');
  }

  function addProfile() {
    const profile = createProfile(`Profile ${(draft?.profiles.length ?? 0) + 1}`);
    setDraft((current) =>
      current
        ? {
            ...current,
            activeProfileId: profile.id,
            profiles: [...current.profiles, profile],
          }
        : current,
    );
  }

  function duplicateProfile() {
    if (!draft || !activeProfile) return;
    const profile = {
      ...cloneState(activeProfile),
      id: crypto.randomUUID(),
      name: `${activeProfile.name} copy`,
      rules: activeProfile.rules.map((rule) => ({ ...rule, id: crypto.randomUUID() })),
    };
    setDraft({ ...draft, activeProfileId: profile.id, profiles: [...draft.profiles, profile] });
  }

  function deleteProfile() {
    if (!draft || draft.profiles.length <= 1) return;
    const profiles = draft.profiles.filter((profile) => profile.id !== draft.activeProfileId);
    setDraft({ ...draft, activeProfileId: profiles[0].id, profiles });
  }

  function addRule() {
    updateActiveProfile((profile) => ({
      ...profile,
      rules: [...profile.rules, createEmptyRule({ name: `Rule ${profile.rules.length + 1}` })],
    }));
  }

  function removeRule(ruleId: string) {
    updateActiveProfile((profile) => ({
      ...profile,
      rules: profile.rules.filter((rule) => rule.id !== ruleId),
    }));
  }

  function exportJson() {
    if (!draft) return;
    const payload = createExportPayload(draft);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'modierheaders-export.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parseImportPayload(JSON.parse(await file.text()));
      await setState(imported);
      setDraft(cloneState(imported));
      await browser.runtime.sendMessage({ type: APPLY_RULES_MESSAGE });
      setStatus('Imported and applied.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      event.target.value = '';
    }
  }

  async function requestAllUrls() {
    const granted = await browser.permissions.request({ origins: ['<all_urls>'] });
    setHasAllUrls(granted);
    setStatus(granted ? 'All-site access granted.' : 'All-site access was not granted.');
  }

  if (!draft || !activeProfile) {
    return (
      <main className="page page--loading" data-color-scheme="light" data-color="brand1" data-size="sm">
        <Paragraph>Loading...</Paragraph>
      </main>
    );
  }

  return (
    <main className="page" data-color-scheme="light" data-color="brand1" data-size="sm">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <Heading level={1} data-size="xs">
            {APP_NAME}
          </Heading>
          <Paragraph data-size="sm">Local rules, no telemetry.</Paragraph>
        </div>

        <Switch
          label="Extension enabled"
          checked={draft.enabled}
          onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
        />

        <nav className="profile-nav" aria-label="Profiles">
          {draft.profiles.map((profile) => (
            <Button
              key={profile.id}
              type="button"
              variant={profile.id === draft.activeProfileId ? 'primary' : 'secondary'}
              onClick={() => setDraft({ ...draft, activeProfileId: profile.id })}
            >
              {profile.name}
            </Button>
          ))}
        </nav>

        <div className="sidebar__actions">
          <Button type="button" variant="secondary" onClick={addProfile}>
            Add profile
          </Button>
          <Button type="button" variant="secondary" onClick={duplicateProfile}>
            Duplicate
          </Button>
          <Button
            type="button"
            variant="tertiary"
            data-color="danger"
            onClick={deleteProfile}
            disabled={draft.profiles.length <= 1}
          >
            Delete
          </Button>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace__header">
          <div>
            <Paragraph data-size="sm" className="eyebrow">
              Header and redirect rules
            </Paragraph>
            <Heading level={2} data-size="md">
              {activeProfile.name}
            </Heading>
            <Paragraph data-size="sm" className="muted">
              {countEnabledRules(draft)} enabled rule(s), {compileResult?.rules.length ?? 0} compiled DNR rule(s)
            </Paragraph>
          </div>
          <div className="toolbar">
            <Button type="button" onClick={save}>
              Save and apply
            </Button>
            <Button type="button" variant="secondary" onClick={exportJson}>
              Export
            </Button>
            <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
              Import
            </Button>
            <input ref={fileInput} type="file" accept="application/json" hidden onChange={importJson} />
          </div>
        </header>

        <Card className="profile-card">
          <div className="section-heading">
            <div>
              <Heading level={3} data-size="xs">
                Profile
              </Heading>
              <Paragraph data-size="sm" className="muted">
                One active profile is compiled into dynamic rules.
              </Paragraph>
            </div>
            <Switch
              label="Profile enabled"
              checked={activeProfile.enabled}
              onChange={(event) =>
                updateActiveProfile((profile) => ({ ...profile, enabled: event.target.checked }))
              }
            />
          </div>
          <Textfield
            label="Profile name"
            value={activeProfile.name}
            onChange={(event) =>
              updateActiveProfile((profile) => ({ ...profile, name: event.target.value }))
            }
          />
        </Card>

        <section className="rules-section">
          <div className="section-heading">
            <div>
              <Heading level={3} data-size="xs">
                Rules
              </Heading>
              <Paragraph data-size="sm" className="muted">
                Header operations and URL redirects are compiled to Manifest V3 DNR.
              </Paragraph>
            </div>
            <Button type="button" onClick={addRule}>
              Add rule
            </Button>
          </div>

          <div className="rules">
            {activeProfile.rules.map((rule, index) => (
              <Card key={rule.id} className="rule-card" variant="tinted">
                <div className="rule-card__header">
                  <div>
                    <Heading level={4} data-size="2xs">
                      {rule.name || `Rule ${index + 1}`}
                    </Heading>
                    <div className="tag-row">
                      <Tag variant="outline" data-color="brand1">
                        {rule.kind === 'redirect' ? 'Redirect' : rule.kind === 'requestHeader' ? 'Request' : 'Response'}
                      </Tag>
                      {rule.kind !== 'redirect' && (
                        <Tag variant="outline" data-color="neutral">
                          {rule.operation}
                        </Tag>
                      )}
                      {rule.target.allUrls && (
                        <Tag variant="outline" data-color="warning">
                          All URLs
                        </Tag>
                      )}
                    </div>
                  </div>
                  <div className="rule-card__actions">
                    <Switch
                      aria-label={`${rule.name || `Rule ${index + 1}`} enabled`}
                      checked={rule.enabled}
                      onChange={(event) =>
                        updateRule(rule.id, (item) => ({ ...item, enabled: event.target.checked }))
                      }
                    />
                    <Button
                      type="button"
                      variant="tertiary"
                      data-color="danger"
                      onClick={() => removeRule(rule.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="rule-grid">
                  <Textfield
                    label="Name"
                    value={rule.name}
                    onChange={(event) => updateRule(rule.id, (item) => ({ ...item, name: event.target.value }))}
                  />
                  <SelectField
                    label="Type"
                    value={rule.kind}
                    onChange={(event) =>
                      updateRule(rule.id, (item) => ({ ...item, kind: event.target.value as ModierHeadersRule['kind'] }))
                    }
                  >
                    <SelectOption value="requestHeader">Request header</SelectOption>
                    <SelectOption value="responseHeader">Response header</SelectOption>
                    <SelectOption value="redirect">Redirect URL</SelectOption>
                  </SelectField>

                  {rule.kind !== 'redirect' && (
                    <>
                      <SelectField
                        label="Operation"
                        value={rule.operation}
                        onChange={(event) =>
                          updateRule(rule.id, (item) => ({
                            ...item,
                            operation: event.target.value as ModierHeadersRule['operation'],
                          }))
                        }
                      >
                        <SelectOption value="set">Set</SelectOption>
                        <SelectOption value="append">Append</SelectOption>
                        <SelectOption value="remove">Remove</SelectOption>
                      </SelectField>
                      <Textfield
                        label="Header name"
                        value={rule.headerName}
                        onChange={(event) =>
                          updateRule(rule.id, (item) => ({ ...item, headerName: event.target.value }))
                        }
                      />
                      <Textfield
                        className="wide"
                        label="Header value"
                        value={rule.headerValue}
                        disabled={rule.operation === 'remove'}
                        onChange={(event) =>
                          updateRule(rule.id, (item) => ({ ...item, headerValue: event.target.value }))
                        }
                      />
                    </>
                  )}

                  {rule.kind === 'redirect' && (
                    <Textfield
                      className="wide"
                      label="Regex substitution"
                      value={rule.redirectRegexSubstitution}
                      placeholder={REDIRECT_PLACEHOLDER}
                      onChange={(event) =>
                        updateRule(rule.id, (item) => ({
                          ...item,
                          redirectRegexSubstitution: event.target.value,
                        }))
                      }
                    />
                  )}

                  <Textfield
                    label="URL filter"
                    value={rule.target.urlFilter}
                    disabled={rule.target.allUrls || Boolean(rule.target.regexFilter)}
                    onChange={(event) =>
                      updateRule(rule.id, (item) => ({
                        ...item,
                        target: { ...item.target, urlFilter: event.target.value },
                      }))
                    }
                  />
                  <Textfield
                    label="Regex filter"
                    value={rule.target.regexFilter}
                    disabled={rule.target.allUrls}
                    onChange={(event) =>
                      updateRule(rule.id, (item) => ({
                        ...item,
                        target: { ...item.target, regexFilter: event.target.value, urlFilter: '' },
                      }))
                    }
                  />
                  <Textfield
                    className="wide"
                    label="Domains"
                    value={rule.target.requestDomains.join(', ')}
                    disabled={rule.target.allUrls}
                    placeholder="example.com, api.example.com"
                    onChange={(event) =>
                      updateRule(rule.id, (item) => ({
                        ...item,
                        target: { ...item.target, requestDomains: parseList(event.target.value) },
                      }))
                    }
                  />
                  <Textfield
                    className="wide"
                    label="Resource types"
                    value={rule.target.resourceTypes.join(', ')}
                    onChange={(event) =>
                      updateRule(rule.id, (item) => ({
                        ...item,
                        target: {
                          ...item.target,
                          resourceTypes: parseList(event.target.value) as ModierHeadersRule['target']['resourceTypes'],
                        },
                      }))
                    }
                  />
                  <Textfield
                    label="Methods"
                    value={rule.target.requestMethods.join(', ')}
                    placeholder="get, post"
                    onChange={(event) =>
                      updateRule(rule.id, (item) => ({
                        ...item,
                        target: {
                          ...item.target,
                          requestMethods: parseList(event.target.value).map((method) =>
                            method.toLowerCase(),
                          ) as ModierHeadersRule['target']['requestMethods'],
                        },
                      }))
                    }
                  />
                  <Switch
                    className="rule-grid__switch"
                    label="All URLs"
                    checked={rule.target.allUrls}
                    onChange={(event) =>
                      updateRule(rule.id, (item) => ({
                        ...item,
                        target: { ...item.target, allUrls: event.target.checked },
                      }))
                    }
                  />
                </div>
              </Card>
            ))}
            {activeProfile.rules.length === 0 && (
              <Alert data-color="info">No rules yet. Add a rule to start modifying headers or redirects.</Alert>
            )}
          </div>
        </section>

        <section className="status-grid">
          <Card className="status-card">
            <div className="section-heading">
              <div>
                <Heading level={3} data-size="xs">
                  Permissions
                </Heading>
                <Paragraph data-size="sm" className="muted">
                  {hasAllUrls ? 'All-site access granted.' : 'All-site access not granted.'}
                </Paragraph>
              </div>
              <Tag data-color={hasAllUrls ? 'success' : 'warning'}>{hasAllUrls ? 'Granted' : 'Optional'}</Tag>
            </div>
            {!hasAllUrls && (
              <Button type="button" variant="secondary" onClick={requestAllUrls}>
                Request all-site access
              </Button>
            )}
          </Card>

          <Card className="status-card">
            <Heading level={3} data-size="xs">
              Diagnostics
            </Heading>
            <Alert data-color={draft.lastApply?.ok === false ? 'danger' : 'info'}>{status}</Alert>
            {validationIssues.length > 0 && (
              <div className="validation-list">
                {validationIssues.map((issue) => (
                  <ValidationMessage key={`${issue.path}-${issue.message}`}>
                    {issue.path}: {issue.message}
                  </ValidationMessage>
                ))}
              </div>
            )}
          </Card>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<OptionsApp />);
