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

type SitePermission = {
  host: string;
  pattern: string;
  granted: boolean;
};

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

function Popup() {
  const [draft, setDraft] = useState<ModierHeadersState | null>(null);
  const [status, setStatus] = useState('Loading...');
  const [sitePermission, setSitePermission] = useState<SitePermission | null>(null);
  const [hasAllUrls, setHasAllUrls] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getState()
      .then((next) => {
        setDraft(cloneState(next));
        setStatus(next.lastApply?.message ?? 'Ready.');
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));

    refreshSitePermission().catch(() => setSitePermission(null));
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

  async function requestAllUrls() {
    const granted = await browser.permissions.request({ origins: ['<all_urls>'] });
    setHasAllUrls(granted);
    setStatus(granted ? 'All-site access granted.' : 'All-site access was not granted.');
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
      const diagnostics = (await browser.runtime.sendMessage({
        type: APPLY_RULES_MESSAGE,
      })) as ModierHeadersState['lastApply'];
      setStatus(diagnostics?.message ?? 'Imported and applied.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      event.target.value = '';
    }
  }

  if (!draft || !activeProfile) {
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
            {APP_NAME}
          </Heading>
          <Paragraph data-size="sm" className="popup__subtle">
            {countEnabledRules(draft)} enabled rule(s), {compileResult?.rules.length ?? 0} compiled
          </Paragraph>
        </div>
        <Switch
          aria-label="Extension enabled"
          checked={draft.enabled}
          onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
        />
      </header>

      <div className="popup__toolbar">
        <Button type="button" onClick={save}>
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={exportJson}>
          Export
        </Button>
        <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
          Import
        </Button>
        <input ref={fileInput} type="file" accept="application/json" hidden onChange={importJson} />
      </div>

      <div className="popup-layout">
        <aside className="profile-sidebar" aria-label="Profiles">
          <div className="profile-sidebar__header">
            <Heading level={2} data-size="xs">
              Profiles
            </Heading>
            <Button type="button" variant="secondary" onClick={addProfile}>
              New
            </Button>
          </div>

          <nav className="profile-list" aria-label="Switch profile">
            {draft.profiles.map((profile) => (
              <Button
                key={profile.id}
                type="button"
                variant={profile.id === draft.activeProfileId ? 'primary' : 'tertiary'}
                aria-current={profile.id === draft.activeProfileId ? 'page' : undefined}
                onClick={() => setDraft({ ...draft, activeProfileId: profile.id })}
              >
                <span className="profile-list__name">{profile.name}</span>
                <span className="profile-list__meta">
                  {profile.rules.filter((rule) => rule.enabled).length}/{profile.rules.length}
                </span>
              </Button>
            ))}
          </nav>
        </aside>

        <section className="popup-workspace" aria-label="Profile workspace">
          <section className="profile-panel" aria-label="Profile editor">
            <div className="profile-panel__top">
              <div>
                <Heading level={2} data-size="xs">
                  {activeProfile.name}
                </Heading>
                <Paragraph data-size="sm" className="popup__subtle">
                  Active profile
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
              onChange={(event) => updateActiveProfile((profile) => ({ ...profile, name: event.target.value }))}
            />

            <div className="profile-actions">
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
          </section>

          <section className="permissions" aria-label="Permissions">
            {sitePermission && (
          <div className="permission-row">
            <div className="permission-row__text">
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
          </div>
            )}

            <div className="permission-row">
              <div className="permission-row__text">
                <Paragraph data-size="xs" className="popup__subtle">
                  All sites
                </Paragraph>
                <Paragraph data-size="sm">{hasAllUrls ? 'Granted' : 'Optional'}</Paragraph>
              </div>
              {hasAllUrls ? (
                <Tag data-color="success">Granted</Tag>
              ) : (
                <Button type="button" variant="secondary" onClick={requestAllUrls}>
                  Request
                </Button>
              )}
            </div>
          </section>

          <section className="rules-section" aria-label="Rules">
            <div className="rules-section__header">
              <div>
                <Heading level={2} data-size="xs">
                  Rules
                </Heading>
                <Paragraph data-size="sm" className="popup__subtle">
                  Header edits and redirects for this profile.
                </Paragraph>
              </div>
              <Button type="button" onClick={addRule}>
                Add rule
              </Button>
            </div>

            <div className="rules">
              {activeProfile.rules.map((rule, index) => (
                <Card key={rule.id} className="rule-card" variant="tinted">
                  <details open={index === 0}>
                    <summary className="rule-card__summary">
                      <div className="rule-card__title">
                        <Heading level={3} data-size="2xs">
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
                    </summary>

                    <div className="rule-card__body">
                      <div className="rule-card__actions">
                        <Switch
                          label="Rule enabled"
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
                    </div>
                  </details>
                </Card>
              ))}
              {activeProfile.rules.length === 0 && (
                <Alert data-color="info">No rules yet. Add a rule to start modifying headers or redirects.</Alert>
              )}
            </div>
          </section>

          <section className="diagnostics" aria-label="Diagnostics">
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
          </section>
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
