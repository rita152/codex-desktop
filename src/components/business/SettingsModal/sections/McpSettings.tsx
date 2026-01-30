/**
 * MCP Server Settings Section
 * Manages MCP (Model Context Protocol) server configurations for Codex.
 */

import { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useMcpServers } from '../../../../hooks/useMcpServers';
import { TextArea } from '../../../ui/data-entry/TextArea';
import { Toggle } from '../../../ui/data-entry/Toggle';
import { Card } from '../../../ui/data-display/Card';
import type { McpServer } from '../../../../types/mcp';
import { getServerDisplayInfo } from '../../../../types/mcp';
import './McpSettings.css';

export const McpSettings = memo(function McpSettings() {
  const { t } = useTranslation();
  const {
    servers,
    loading,
    error,
    configExists,
    addServerFromToml,
    deleteServer,
    toggleServer,
    refresh,
  } = useMcpServers();

  const [showAddForm, setShowAddForm] = useState(false);
  const [tomlInput, setTomlInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmed = tomlInput.trim();
      if (!trimmed) {
        setFormError(t('settings.mcp.errors.tomlRequired'));
        return;
      }

      setSubmitting(true);
      setFormError(null);

      try {
        await addServerFromToml(trimmed);
        setTomlInput('');
        setShowAddForm(false);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
    },
    [tomlInput, addServerFromToml, t]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm(t('settings.mcp.confirmDelete', { id }))) {
        return;
      }
      setDeletingId(id);
      try {
        await deleteServer(id);
      } catch {
        // Error is handled by hook
      } finally {
        setDeletingId(null);
      }
    },
    [deleteServer, t]
  );

  const handleToggle = useCallback(
    async (server: McpServer) => {
      try {
        await toggleServer(server.base.id, !server.base.enabled);
      } catch {
        // Error is handled by hook
      }
    },
    [toggleServer]
  );

  const handleCancelAdd = useCallback(() => {
    setShowAddForm(false);
    setTomlInput('');
    setFormError(null);
  }, []);

  const getServerIcon = (server: McpServer) => {
    switch (server.type) {
      case 'Stdio':
        return '⚡';
      case 'Http':
        return '🌐';
      case 'Sse':
        return '📡';
      default:
        return '🔌';
    }
  };

  const getTypeBadgeClass = (server: McpServer) => {
    switch (server.type) {
      case 'Stdio':
        return 'mcp-server-card__badge--stdio';
      case 'Http':
        return 'mcp-server-card__badge--http';
      case 'Sse':
        return 'mcp-server-card__badge--sse';
      default:
        return '';
    }
  };

  const renderServerCard = (server: McpServer) => {
    const isDeleting = deletingId === server.base.id;
    const isEnabled = server.base.enabled;

    return (
      <Card
        key={server.base.id}
        className="mcp-server-card"
        radius="md"
        shadow={false}
        background="elevated"
        bordered
      >
        <div className="mcp-server-card__header">
          <div
            className={`mcp-server-card__icon ${!isEnabled ? 'mcp-server-card__icon--disabled' : ''}`}
          >
            {getServerIcon(server)}
          </div>
          <div className="mcp-server-card__content">
            <div className="mcp-server-card__title-row">
              <span className="mcp-server-card__name">{server.base.id}</span>
              <span className={`mcp-server-card__badge ${getTypeBadgeClass(server)}`}>
                {server.type}
              </span>
            </div>
            <div className="mcp-server-card__detail">{getServerDisplayInfo(server)}</div>
            <div className="mcp-server-card__status">
              <span
                className={`mcp-server-card__status-dot ${isEnabled ? 'mcp-server-card__status-dot--enabled' : ''}`}
              />
              <span>{isEnabled ? t('settings.mcp.enabled') : t('settings.mcp.disabled')}</span>
            </div>
          </div>
          <div className="mcp-server-card__actions">
            <Toggle
              checked={isEnabled}
              onChange={() => handleToggle(server)}
              className="mcp-server-card__toggle"
              aria-label={isEnabled ? t('settings.mcp.disable') : t('settings.mcp.enable')}
            />
            <button
              type="button"
              className="mcp-server-card__delete"
              onClick={() => handleDelete(server.base.id)}
              disabled={isDeleting}
              aria-label={t('settings.mcp.delete')}
            >
              {isDeleting ? '···' : '×'}
            </button>
          </div>
        </div>
      </Card>
    );
  };

  const renderAddForm = () => (
    <Card className="mcp-add-form" radius="lg" shadow={false} background="elevated" bordered={false}>
      <form onSubmit={handleSubmit}>
        <div className="mcp-add-form__header">
          <div className="mcp-add-form__icon">+</div>
          <div className="mcp-add-form__title-group">
            <h3 className="mcp-add-form__title">{t('settings.mcp.addServer')}</h3>
            <p className="mcp-add-form__subtitle">{t('settings.mcp.pasteTomlHint')}</p>
          </div>
        </div>

        {formError && (
          <div className="mcp-add-form__error">
            <span className="mcp-add-form__error-icon">⚠</span>
            <span>{formError}</span>
          </div>
        )}

        <div className="mcp-add-form__field">
          <label className="mcp-add-form__label">{t('settings.mcp.tomlConfig')}</label>
          <TextArea
            value={tomlInput}
            onChange={setTomlInput}
            placeholder={`[mcp_servers.server_name]\ncommand = "npx"\nargs = ["-y", "@example/mcp"]`}
            className="mcp-add-form__textarea"
            minRows={6}
            maxRows={15}
          />
        </div>

        <div className="mcp-add-form__actions">
          <button
            type="button"
            className="mcp-add-form__btn mcp-add-form__btn--cancel"
            onClick={handleCancelAdd}
            disabled={submitting}
          >
            {t('settings.mcp.cancel')}
          </button>
          <button
            type="submit"
            className="mcp-add-form__btn mcp-add-form__btn--submit"
            disabled={submitting || !tomlInput.trim()}
          >
            {submitting ? t('settings.mcp.adding') : t('settings.mcp.add')}
          </button>
        </div>
      </form>
    </Card>
  );

  const renderEmptyState = () => (
    <div className="mcp-empty">
      <div className="mcp-empty__icon">🔌</div>
      <p className="mcp-empty__title">{t('settings.mcp.empty')}</p>
      <p className="mcp-empty__hint">{t('settings.mcp.emptyHint')}</p>
    </div>
  );

  return (
    <div className="settings-section-content">
      <h2 className="settings-content__title">{t('settings.sections.mcp')}</h2>

      <p className="settings-item__description" style={{ marginBottom: 'var(--spacing-lg)' }}>
        {t('settings.mcp.description')}
      </p>

      {error && (
        <div className="mcp-alert mcp-alert--error">
          <span className="mcp-alert__icon">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {!configExists && (
        <div className="mcp-alert mcp-alert--warning">
          <span className="mcp-alert__icon">📁</span>
          <span>{t('settings.mcp.noConfigDir')}</span>
        </div>
      )}

      <div className="mcp-header">
        <button
          type="button"
          className="mcp-header__btn mcp-header__btn--primary"
          onClick={() => setShowAddForm(true)}
          disabled={showAddForm || loading}
        >
          <span>+</span>
          <span>{t('settings.mcp.addServer')}</span>
        </button>
        <button
          type="button"
          className="mcp-header__btn mcp-header__btn--secondary"
          onClick={refresh}
          disabled={loading}
        >
          <span>↻</span>
          <span>{loading ? t('settings.mcp.loading') : t('settings.mcp.refresh')}</span>
        </button>
      </div>

      {showAddForm && renderAddForm()}

      {loading && servers.length === 0 ? (
        <div className="mcp-loading">
          <div className="mcp-loading__spinner" />
          <span>{t('settings.mcp.loading')}</span>
        </div>
      ) : servers.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="mcp-servers-list">{servers.map(renderServerCard)}</div>
      )}
    </div>
  );
});

McpSettings.displayName = 'McpSettings';
