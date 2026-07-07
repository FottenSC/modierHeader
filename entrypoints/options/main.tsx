import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { APPLY_RULES_MESSAGE } from '../../src/shared/messages';
import { compileStateToDnr, countEnabledRules } from '../../src/shared/compiler';
import { createEmptyRule, createProfile } from '../../src/shared/defaults';
import { createExportPayload, parseImportPayload } from '../../src/shared/exporter';
import { getState, setState } from '../../src/shared/storage';
import { parseList, validateState } from '../../src/shared/validation';
import type { CleanHeaderProfile, CleanHeaderRule, CleanHeaderState } from '../../src/shared/types';
import type { ChangeEvent } from 'react';
import './style.css';

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const REDIRECT_PLACEHOLDER = ['https', '://new.example/\\1'].join('');

function OptionsApp() {
  const [draft, setDraft] = useState<CleanHeaderState | null>(null);
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

  function updateActiveProfile(updater: (profile: CleanHeaderProfile) => CleanHeaderProfile) {
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

  function updateRule(ruleId: string, updater: (rule: CleanHeaderRule) => CleanHeaderRule) {
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
    const diagnostics = (await browser.runtime.sendMessage({ type: APPLY_RULES_MESSAGE })) as CleanHeaderState['lastApply'];
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
    anchor.download = 'cleanheader-export.json';
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
    return <main className="page">Loading...</main>;
  }

  return (
    <main className="page">
      <aside>
        <h1>CleanHeader</h1>
        <label className="toggle">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
          />
          Extension enabled
        </label>
        <nav>
          {draft.profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={profile.id === draft.activeProfileId ? 'active' : ''}
              onClick={() => setDraft({ ...draft, activeProfileId: profile.id })}
            >
              {profile.name}
            </button>
          ))}
        </nav>
        <button type="button" onClick={addProfile}>
          Add profile
        </button>
        <button type="button" onClick={duplicateProfile}>
          Duplicate
        </button>
        <button type="button" onClick={deleteProfile} disabled={draft.profiles.length <= 1}>
          Delete
        </button>
      </aside>

      <section className="workspace">
        <header className="toolbar">
          <div>
            <p className="eyebrow">Local-only header control</p>
            <h2>{activeProfile.name}</h2>
            <p>{countEnabledRules(draft)} enabled rule(s), {compileResult?.rules.length ?? 0} compiled DNR rule(s)</p>
          </div>
          <div className="actions">
            <button type="button" onClick={save}>
              Save and apply
            </button>
            <button type="button" onClick={exportJson}>
              Export
            </button>
            <button type="button" onClick={() => fileInput.current?.click()}>
              Import
            </button>
            <input ref={fileInput} type="file" accept="application/json" hidden onChange={importJson} />
          </div>
        </header>

        <section className="panel">
          <div className="profile-grid">
            <label>
              Profile name
              <input
                value={activeProfile.name}
                onChange={(event) =>
                  updateActiveProfile((profile) => ({ ...profile, name: event.target.value }))
                }
              />
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={activeProfile.enabled}
                onChange={(event) =>
                  updateActiveProfile((profile) => ({ ...profile, enabled: event.target.checked }))
                }
              />
              Profile enabled
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h3>Rules</h3>
            <button type="button" onClick={addRule}>
              Add rule
            </button>
          </div>
          <div className="rules">
            {activeProfile.rules.map((rule) => (
              <article key={rule.id} className="rule-card">
                <div className="rule-header">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) => updateRule(rule.id, (item) => ({ ...item, enabled: event.target.checked }))}
                    />
                    Enabled
                  </label>
                  <button type="button" onClick={() => removeRule(rule.id)}>
                    Remove
                  </button>
                </div>

                <div className="rule-grid">
                  <label>
                    Name
                    <input
                      value={rule.name}
                      onChange={(event) => updateRule(rule.id, (item) => ({ ...item, name: event.target.value }))}
                    />
                  </label>
                  <label>
                    Type
                    <select
                      value={rule.kind}
                      onChange={(event) =>
                        updateRule(rule.id, (item) => ({ ...item, kind: event.target.value as CleanHeaderRule['kind'] }))
                      }
                    >
                      <option value="requestHeader">Request header</option>
                      <option value="responseHeader">Response header</option>
                      <option value="redirect">Redirect URL</option>
                    </select>
                  </label>
                  {rule.kind !== 'redirect' && (
                    <>
                      <label>
                        Operation
                        <select
                          value={rule.operation}
                          onChange={(event) =>
                            updateRule(rule.id, (item) => ({
                              ...item,
                              operation: event.target.value as CleanHeaderRule['operation'],
                            }))
                          }
                        >
                          <option value="set">Set</option>
                          <option value="append">Append</option>
                          <option value="remove">Remove</option>
                        </select>
                      </label>
                      <label>
                        Header name
                        <input
                          value={rule.headerName}
                          onChange={(event) =>
                            updateRule(rule.id, (item) => ({ ...item, headerName: event.target.value }))
                          }
                        />
                      </label>
                      <label className="wide">
                        Header value
                        <input
                          value={rule.headerValue}
                          disabled={rule.operation === 'remove'}
                          onChange={(event) =>
                            updateRule(rule.id, (item) => ({ ...item, headerValue: event.target.value }))
                          }
                        />
                      </label>
                    </>
                  )}
                  {rule.kind === 'redirect' && (
                    <label className="wide">
                      Regex substitution
                      <input
                        value={rule.redirectRegexSubstitution}
                        placeholder={REDIRECT_PLACEHOLDER}
                        onChange={(event) =>
                          updateRule(rule.id, (item) => ({
                            ...item,
                            redirectRegexSubstitution: event.target.value,
                          }))
                        }
                      />
                    </label>
                  )}
                  <label>
                    URL filter
                    <input
                      value={rule.target.urlFilter}
                      disabled={rule.target.allUrls || Boolean(rule.target.regexFilter)}
                      onChange={(event) =>
                        updateRule(rule.id, (item) => ({
                          ...item,
                          target: { ...item.target, urlFilter: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Regex filter
                    <input
                      value={rule.target.regexFilter}
                      disabled={rule.target.allUrls}
                      onChange={(event) =>
                        updateRule(rule.id, (item) => ({
                          ...item,
                          target: { ...item.target, regexFilter: event.target.value, urlFilter: '' },
                        }))
                      }
                    />
                  </label>
                  <label className="wide">
                    Domains
                    <input
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
                  </label>
                  <label className="wide">
                    Resource types
                    <input
                      value={rule.target.resourceTypes.join(', ')}
                      onChange={(event) =>
                        updateRule(rule.id, (item) => ({
                          ...item,
                          target: {
                            ...item.target,
                            resourceTypes: parseList(event.target.value) as CleanHeaderRule['target']['resourceTypes'],
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Methods
                    <input
                      value={rule.target.requestMethods.join(', ')}
                      placeholder="get, post"
                      onChange={(event) =>
                        updateRule(rule.id, (item) => ({
                          ...item,
                          target: {
                            ...item.target,
                            requestMethods: parseList(event.target.value).map((method) =>
                              method.toLowerCase(),
                            ) as CleanHeaderRule['target']['requestMethods'],
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={rule.target.allUrls}
                      onChange={(event) =>
                        updateRule(rule.id, (item) => ({
                          ...item,
                          target: { ...item.target, allUrls: event.target.checked },
                        }))
                      }
                    />
                    All URLs
                  </label>
                </div>
              </article>
            ))}
            {activeProfile.rules.length === 0 && <p className="empty">No rules yet.</p>}
          </div>
        </section>

        <section className="panel diagnostics">
          <div>
            <h3>Permissions</h3>
            <p>{hasAllUrls ? 'All-site access granted.' : 'All-site access not granted.'}</p>
          </div>
          {!hasAllUrls && (
            <button type="button" onClick={requestAllUrls}>
              Request all-site access
            </button>
          )}
          <div>
            <h3>Diagnostics</h3>
            <p className={draft.lastApply?.ok === false ? 'error-text' : ''}>{status}</p>
            {validationIssues.length > 0 && (
              <ul>
                {validationIssues.map((issue) => (
                  <li key={`${issue.path}-${issue.message}`}>
                    {issue.path}: {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<OptionsApp />);
