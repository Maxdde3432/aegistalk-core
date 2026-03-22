import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import adminAPI, { getAdminToken } from './api/admin.js';

const OWNER_ID = String(import.meta?.env?.VITE_OWNER_ID || '').trim();

const Toggle = ({ label, description, checked, onChange }) => {
  return (
    <div className="aegis-toggle">
      <div className="aegis-toggle-text">
        <div className="aegis-toggle-label">{label}</div>
        {description ? <div className="aegis-toggle-desc">{description}</div> : null}
      </div>
      <button
        type="button"
        className={`aegis-toggle-btn ${checked ? 'on' : 'off'}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span className="aegis-toggle-knob" />
      </button>
    </div>
  );
};

const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso || '');
  }
};

const asText = (v) => (v == null ? '' : String(v));

export default function AdminPanel({ user }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [accessOk, setAccessOk] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [lockedForSec, setLockedForSec] = useState(0);

  const [whitelistId, setWhitelistId] = useState('');
  const [aiAdvice, setAiAdvice] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [helpText, setHelpText] = useState('');
  const [helpTextDraft, setHelpTextDraft] = useState('');
  const [helpTextBusy, setHelpTextBusy] = useState(false);

  const isOwner = useMemo(() => String(user?.id || '') === OWNER_ID, [user?.id]);

  const refresh = async () => {
    setError('');
    setLoading(true);
    try {
      const s = await adminAPI.getStatus();
      setStatus(s);
      setAccessOk(true);
      setNeedsPassword(false);
      const l = await adminAPI.getLogs();
      setStatus(s);
      setLogs(Array.isArray(l?.logs) ? l.logs : []);
      try {
        const h = await adminAPI.getHelpText();
        const text = String(h?.helpText || '');
        setHelpText(text);
        setHelpTextDraft(text);
      } catch (helpErr) {
        console.warn('[AdminPanel] Failed to load help text:', helpErr);
      }
    } catch (e) {
      const msg = e?.message || 'Admin load failed';
      const statusCode = e?.status;
      setAccessOk(false);
      setError(msg);

      if (statusCode === 403) {
        // Backend says: admin_token is missing/expired/invalid.
        setNeedsPassword(true);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ddosActive = Boolean(status?.shield?.ddosActive);
  const xssActive = Boolean(status?.shield?.xssFilterActive);
  const whitelistOnly = String(status?.privacyMode || 'open') === 'whitelist';

  const groq429 = status?.ai?.groq?.statusCounts?.['429'] || 0;
  const last429At = status?.ai?.groq?.last429At || null;

  const toggle = async (shield, enabled) => {
    setBusy(true);
    setError('');
    try {
      await adminAPI.toggleShield({ shield, enabled });
      await refresh();
    } catch (e) {
      setError(e?.message || 'Toggle failed');
    } finally {
      setBusy(false);
    }
  };

  const submitWhitelist = async (action) => {
    const id = whitelistId.trim();
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      await adminAPI.updateWhitelist({ action, userId: id });
      setWhitelistId('');
      await refresh();
    } catch (e) {
      setError(e?.message || 'Whitelist update failed');
    } finally {
      setBusy(false);
    }
  };

  const saveHelpText = async () => {
    const text = helpTextDraft.trim();
    if (!text) return;
    setHelpTextBusy(true);
    setError('');
    try {
      const result = await adminAPI.updateHelpText(text);
      const next = String(result?.helpText || text);
      setHelpText(next);
      setHelpTextDraft(next);
    } catch (e) {
      setError(e?.message || 'Help text update failed');
    } finally {
      setHelpTextBusy(false);
    }
  };

  const handleUnlock = async () => {
    setLoginError('');
    setLockedForSec(0);
    const pwd = adminPassword;
    if (!pwd.trim()) return;
    const storedToken = localStorage.getItem('admin_token');
    console.log('Отправляем токен:', storedToken);
    setLoginBusy(true);
    try {
      const result = await adminAPI.login(pwd);
      const token = result?.token || result?.adminToken || result?.data?.token;
      if (token) {
        localStorage.setItem('admin_token', String(token));
      }
      setAdminPassword('');
      await refresh();
    } catch (err) {
      const msg = err?.message || 'Login failed';
      const details = err?.details || {};
      setLoginError(msg);
      if (err?.status === 429 && details?.retryAfterSec) {
        setLockedForSec(Number(details.retryAfterSec) || 0);
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const askAegis = async () => {
    setAiBusy(true);
    setAiAdvice('');
    setError('');
    try {
      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const recent = logs.filter((l) => {
        const t = Date.parse(l?.time || '');
        return Number.isFinite(t) && t >= weekAgo;
      });

      const adminAttempts = recent.filter((l) => {
        const type = String(l?.type || '').toLowerCase();
        const path = String(l?.path || '').toLowerCase();
        const level = String(l?.level || '').toLowerCase();

        // Count failed/denied admin auth attempts, not successful admin actions (like toggling shield).
        if (type.includes('admin_login_denied')) return true;
        if (type.includes('admin_password_failed')) return true;
        if (type.includes('admin_session_invalid')) return true;
        if (type.includes('admin_token_missing')) return true;

        // Fallback: any warn/error on /api/admin/* except expected action logs.
        if (path.includes('/api/admin') && (level === 'warn' || level === 'error')) {
          if (type.includes('admin_toggle_')) return false;
          return true;
        }

        return false;
      }).length;

      const injectionAttempts = recent.filter((l) => {
        const type = String(l?.type || '').toLowerCase();
        const msg = String(l?.message || '').toLowerCase();
        return (
          type.includes('xss') ||
          type.includes('sql') ||
          type.includes('injection') ||
          type.includes('prompt') ||
          type.includes('admin_password_failed') ||
          type.includes('admin_login_denied') ||
          type.includes('admin_session_invalid') ||
          msg.includes('xss') ||
          msg.includes('sql') ||
          msg.includes('injection') ||
          msg.includes('prompt')
        );
      }).length;

      const firstLine = `На этой неделе было ${adminAttempts} попыток доступа к административным функциям.`;

      const shieldLine = [
        ddosActive ? 'DDoS Shield включен, я проверяю входящие запросы.' : 'Рекомендую включить DDoS Shield.',
        xssActive ? 'XSS Filter включен, я проверяю ввод и заголовки.' : 'Рекомендую включить XSS Filter.'
      ].join(' ');

      const injectionLine =
        injectionAttempts > 0
          ? 'Кто-то пытается внедриться в систему. Я временно ограничиваю атакующего на 5-10 минут; админов не блокирую.'
          : 'Подозрительных попыток внедрения не обнаружено.';

      const advice = [firstLine, shieldLine, injectionLine].join(' ');
      setAiAdvice(advice);
      return;
    } catch (e) {
      setAiAdvice('');
      setError(e?.message || 'AI advice failed');
    } finally {
      setAiBusy(false);
    }
  };


  if (!isOwner) {
    return (
      <div className="aegis-admin-wrap">
        <div className="aegis-admin-card">
          <div className="aegis-admin-title">Access denied</div>
          <div className="aegis-admin-sub">This panel is restricted.</div>
        </div>
      </div>
    );
  }

  // No Data without Token/200 OK: show nothing but a minimal gate until backend confirms.
  if (!accessOk) {
    return (
      <div className="aegis-admin-wrap">
        <div className="aegis-admin-card" style={{ maxWidth: 560, margin: '0 auto' }}>
          <div className="aegis-admin-title">{needsPassword ? 'Admin verification' : 'Checking access...'}</div>
          <div className="aegis-admin-sub">
            {needsPassword
              ? 'Введите пароль администратора. Панель будет доступна только после 200 OK от сервера.'
              : 'Waiting for server authorization.'}
          </div>

          {needsPassword ? (
            <form
              className="aegis-admin-actions"
              onSubmit={async (ev) => {
                ev.preventDefault();
                await handleUnlock();
              }}
            >
              <input
                className="aegis-input"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="ADMIN_PASSWORD"
                autoComplete="current-password"
              />
              <button className="aegis-btn" type="submit" disabled={loginBusy || lockedForSec > 0}>
                {lockedForSec > 0 ? `Locked (${lockedForSec}s)` : (loginBusy ? 'Verifying…' : 'Unlock')}
              </button>
              <button
                className="aegis-btn aegis-btn-ghost"
                type="button"
                onClick={() => navigate('/chat', { replace: true })}
                disabled={loginBusy}
              >
                Exit
              </button>
            </form>
          ) : null}

          {loginError ? <div className="aegis-admin-error">{loginError}</div> : null}
          {error && !needsPassword ? <div className="aegis-admin-error">{error}</div> : null}
          <div className="aegis-card-footnote">
            Admin token: <span className="mono">{getAdminToken() ? 'present' : 'missing'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aegis-admin-wrap">
      <div className="aegis-admin-grid">
        <div className="aegis-admin-hero">
          <div className="aegis-admin-kicker">Aegis Control Plane</div>
          <div className="aegis-admin-title">Admin</div>
          <div className="aegis-admin-sub">
            User: <span className="mono">{user?.id}</span>
          </div>

          <div className="aegis-admin-actions">
            <button className="aegis-btn" type="button" disabled={loading || busy} onClick={refresh}>
              Refresh
            </button>
            <button className="aegis-btn aegis-btn-ghost" type="button" disabled={aiBusy || loading} onClick={askAegis}>
              {aiBusy ? 'Aegis анализирует...' : 'Спросить совет у Aegis'}
            </button>
          </div>

          {error ? <div className="aegis-admin-error">{error}</div> : null}

          <div className="aegis-admin-metrics">
            <div className="aegis-metric">
              <div className="aegis-metric-k">Groq 429</div>
              <div className="aegis-metric-v">{groq429}</div>
              <div className="aegis-metric-s">{last429At ? `Last: ${formatTime(last429At)}` : 'No recent 429'}</div>
            </div>
            <div className="aegis-metric">
              <div className="aegis-metric-k">Uptime</div>
              <div className="aegis-metric-v">{status?.runtime?.uptimeSec ?? '...'}</div>
              <div className="aegis-metric-s">seconds</div>
            </div>
            <div className="aegis-metric">
              <div className="aegis-metric-k">Privacy</div>
              <div className="aegis-metric-v">{String(status?.privacyMode || 'open')}</div>
              <div className="aegis-metric-s">AI endpoints</div>
            </div>
          </div>
        </div>

        <div className="aegis-admin-card">
          <div className="aegis-card-title">Shield</div>
          <Toggle
            label="DDoS Shield"
            description="Rate limit per IP (server-side)"
            checked={ddosActive}
            onChange={(v) => toggle('ddos', v)}
          />
          <Toggle
            label="XSS Filter"
            description="Blocks obvious script payloads (server-side)"
            checked={xssActive}
            onChange={(v) => toggle('xss', v)}
          />
          <Toggle
            label="Whitelist Only"
            description="Restricts AI endpoints to whitelist"
            checked={whitelistOnly}
            onChange={(v) => toggle('whitelist_only', v)}
          />
          <div className="aegis-card-footnote">All admin actions are logged as security events.</div>
        </div>

        <div className="aegis-admin-card">
          <div className="aegis-card-title">Whitelist</div>
          <div className="aegis-inline">
            <input
              className="aegis-input"
              value={whitelistId}
              onChange={(e) => setWhitelistId(e.target.value)}
              placeholder="UUID пользователя"
            />
            <button className="aegis-btn" type="button" disabled={busy || !whitelistId.trim()} onClick={() => submitWhitelist('add')}>
              Add
            </button>
            <button
              className="aegis-btn aegis-btn-danger"
              type="button"
              disabled={busy || !whitelistId.trim()}
              onClick={() => submitWhitelist('remove')}
            >
              Remove
            </button>
          </div>
          <div className="aegis-card-footnote">
            Whitelist affects AI endpoints when mode is <span className="mono">whitelist</span>.
          </div>
        </div>

        <div className="aegis-admin-card">
          <div className="aegis-card-title">Help Text</div>
          <textarea
            className="aegis-textarea"
            value={helpTextDraft}
            onChange={(e) => setHelpTextDraft(e.target.value)}
            placeholder="Текст /help (простой текст, без Markdown)"
          />
          <div className="aegis-admin-actions" style={{ justifyContent: 'flex-start' }}>
            <button
              className="aegis-btn"
              type="button"
              disabled={helpTextBusy || !helpTextDraft.trim() || helpTextDraft === helpText}
              onClick={saveHelpText}
            >
              {helpTextBusy ? 'Saving...' : 'Save Help Text'}
            </button>
          </div>
          <div className="aegis-card-footnote">This text is returned on /help and used as the style baseline.</div>
        </div>

        <div className="aegis-admin-card aegis-admin-logs">
          <div className="aegis-card-title">Suspicious Activity Logs</div>

          {loading ? (
            <div className="aegis-skeleton">Loading...</div>
          ) : (
            <div className="aegis-table-wrap">
              <table className="aegis-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>IP</th>
                    <th>Type</th>
                    <th>Path</th>
                    <th>Level</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length ? (
                    logs
                      .slice()
                      .reverse()
                      .map((l, idx) => (
                        <tr key={`${l.time || 't'}-${idx}`}>
                          <td className="mono">{formatTime(l.time)}</td>
                          <td className="mono">{asText(l.ip)}</td>
                          <td>{asText(l.type)}</td>
                          <td className="mono">{asText(l.path)}</td>
                          <td className={`lvl ${asText(l.level)}`}>{asText(l.level)}</td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="aegis-empty">
                        No logs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="aegis-admin-card">
          <div className="aegis-card-title">Aegis Advice</div>
          <div className="aegis-advice">{aiAdvice ? aiAdvice : 'Нажмите "Спросить совет у Aegis" для анализа.'}</div>
        </div>
      </div>
    </div>
  );
}
