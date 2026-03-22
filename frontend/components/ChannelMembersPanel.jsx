import { useMemo, useState } from 'react';
import { Bot, LogOut, Shield, User, UserPlus, X } from 'lucide-react';
import { resolveAssetUrl } from '../api/runtimeConfig';

const ROLE_ORDER = {
  owner: 0,
  admin: 1,
  moderator: 2,
  member: 3,
  bot: 4
};

const ROLE_LABELS = {
  owner: '\u0421\u043e\u0437\u0434\u0430\u0442\u0435\u043b\u044c',
  admin: '\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440',
  moderator: '\u041c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440',
  member: '\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a',
  bot: '\u0411\u043e\u0442'
};

const roleBadgeClass = {
  owner: 'owner',
  admin: 'admin',
  moderator: 'moderator',
  member: 'member',
  bot: 'bot'
};

const canInviteByRole = (role, allowMemberInvites) => {
  if (['owner', 'admin', 'moderator'].includes(role)) return true;
  return role === 'member' && allowMemberInvites;
};

const canRemoveByRole = (actorRole, targetRole) => {
  if (targetRole === 'owner') return false;
  if (actorRole === 'owner') return targetRole !== 'owner';
  if (actorRole === 'admin') return ['moderator', 'member', 'bot'].includes(targetRole);
  if (actorRole === 'moderator') return ['member', 'bot'].includes(targetRole);
  return false;
};

const getEditableRoles = (actorRole, member) => {
  if (member.role === 'owner' || member.isBot || member.role === 'bot') return [];
  if (actorRole === 'owner') return ['member', 'moderator', 'admin'];
  if (actorRole === 'admin') {
    if (member.role === 'admin') return [];
    return ['member', 'moderator'];
  }
  return [];
};

const getRoleBadge = (member) => {
  const role = member.role || (member.isBot ? 'bot' : 'member');
  const isBotRole = role === 'bot' || member.isBot;
  const Icon = isBotRole ? Bot : role === 'member' ? User : Shield;

  return (
    <span className={`role-badge ${roleBadgeClass[role] || 'member'}`}>
      <Icon size={12} /> {ROLE_LABELS[role] || '\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a'}
    </span>
  );
};

const ChannelMembersPanel = ({
  isOpen,
  onClose,
  members,
  myRole,
  userId,
  onKick,
  onAddMember,
  onChangeRole,
  allowMemberInvites
}) => {
  const [actionInProgress, setActionInProgress] = useState(null);

  const canInvite = canInviteByRole(myRole, allowMemberInvites);

  const sortedMembers = useMemo(() => {
    return [...(members || [])].sort((a, b) => {
      const roleDelta = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
      if (roleDelta !== 0) return roleDelta;
      return String(a.firstName || a.username || '').localeCompare(String(b.firstName || b.username || ''), 'ru');
    });
  }, [members]);

  if (!isOpen) return null;

  const handleKick = async (targetUserId, role) => {
    if (actionInProgress) return;
    if (!canRemoveByRole(myRole, role)) {
      alert('\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043f\u0440\u0430\u0432 \u0434\u043b\u044f \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u044d\u0442\u043e\u0433\u043e \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430');
      return;
    }
    setActionInProgress(`kick:${targetUserId}`);
    try {
      await onKick(targetUserId);
    } catch (error) {
      console.error('[ChannelMembersPanel] Kick error:', error);
      alert(error?.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRoleChange = async (targetUserId, nextRole) => {
    if (!nextRole || actionInProgress) return;
    setActionInProgress(`role:${targetUserId}`);
    try {
      await onChangeRole(targetUserId, nextRole);
    } catch (error) {
      console.error('[ChannelMembersPanel] Role change error:', error);
      alert(error?.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0440\u043e\u043b\u044c');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="members-panel-overlay" onClick={onClose}>
      <div className="members-panel" onClick={(event) => event.stopPropagation()}>
        <div className="members-panel-header">
          <div>
            <h3>{'\u0423\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438'}</h3>
            <p>{'\u041f\u0440\u0430\u0432\u0430, \u043c\u043e\u0434\u0435\u0440\u0430\u0442\u043e\u0440\u044b, \u0430\u0434\u043c\u0438\u043d\u044b \u0438 \u0431\u043e\u0442\u044b \u2014 \u0432\u0441\u0451 \u0432 \u043e\u0434\u043d\u043e\u043c \u043c\u0435\u0441\u0442\u0435.'}</p>
          </div>
          <div className="members-panel-header-actions">
            {canInvite ? (
              <button className="add-member-btn" onClick={onAddMember} title={'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430 \u0438\u043b\u0438 \u0431\u043e\u0442\u0430'}>
                <UserPlus size={18} />
              </button>
            ) : null}
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="members-panel-content">
          {sortedMembers.length === 0 ? (
            <div className="empty-members">
              <p>{'\u041f\u043e\u043a\u0430 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432 \u043d\u0435\u0442'}</p>
            </div>
          ) : (
            <div className="members-list">
              {sortedMembers.map((member) => {
                const isMe = member.id === userId;
                const editableRoles = getEditableRoles(myRole, member);
                const canKick = !isMe && canRemoveByRole(myRole, member.role);
                const initials = (member.firstName || member.lastName || member.username || 'U').charAt(0).toUpperCase();
                const isBusy = actionInProgress && actionInProgress.includes(member.id);

                return (
                  <div key={member.id} className="member-item">
                    <div className="member-info">
                      <div className="member-avatar">
                        {member.avatarUrl ? (
                          <img
                            src={resolveAssetUrl(member.avatarUrl)}
                            alt={member.firstName || member.username || 'User'}
                            onError={(event) => {
                              try { event.currentTarget.src = ''; } catch {}
                            }}
                          />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </div>

                      <div className="member-details">
                        <div className="member-title-row">
                          <span className="member-name">
                            {member.firstName || member.lastName
                              ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
                              : member.username
                                ? `@${member.username}`
                                : '\u0410\u043d\u043e\u043d\u0438\u043c'}
                          </span>
                          {isMe ? <span className="member-you">{'\u0432\u044b'}</span> : null}
                        </div>
                        <div className="member-meta-row">
                          {member.username ? <span className="member-username">@{member.username}</span> : null}
                          {getRoleBadge(member)}
                        </div>
                      </div>
                    </div>

                    <div className="member-actions">
                      {editableRoles.length > 0 ? (
                        <select
                          className="role-select"
                          value={member.role}
                          onChange={(event) => handleRoleChange(member.id, event.target.value)}
                          disabled={Boolean(isBusy)}
                        >
                          {editableRoles.map((role) => (
                            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="role-placeholder">{member.isBot ? '\u0421\u0438\u0441\u0442\u0435\u043c\u043d\u0430\u044f \u0440\u043e\u043b\u044c' : '\u0411\u0435\u0437 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439'}</div>
                      )}

                      {canKick ? (
                        <button
                          className="action-btn kick"
                          onClick={() => handleKick(member.id, member.role)}
                          disabled={Boolean(isBusy)}
                          title={'\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430'}
                        >
                          <LogOut size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <style>{`
          .members-panel-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.54);
            display: flex;
            justify-content: flex-end;
            z-index: 1200;
          }

          .members-panel {
            width: min(460px, 100%);
            height: 100%;
            background: linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(7, 11, 20, 0.98));
            display: flex;
            flex-direction: column;
            animation: slideIn 0.24s ease;
            border-left: 1px solid rgba(96, 165, 250, 0.18);
            box-shadow: -24px 0 60px rgba(0, 0, 0, 0.35);
          }

          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }

          .members-panel-header {
            padding: 22px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
          }

          .members-panel-header h3 {
            margin: 0 0 6px;
            font-size: 20px;
            font-weight: 700;
          }

          .members-panel-header p {
            margin: 0;
            color: rgba(226, 232, 240, 0.72);
            font-size: 13px;
          }

          .members-panel-header-actions {
            display: flex;
            gap: 8px;
            align-items: center;
          }

          .close-btn,
          .add-member-btn {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            border: none;
            color: white;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .close-btn {
            background: rgba(255, 255, 255, 0.08);
          }

          .add-member-btn {
            background: linear-gradient(135deg, #2563eb, #4f46e5);
          }

          .members-panel-content {
            flex: 1;
            overflow-y: auto;
            padding: 18px;
          }

          .members-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .member-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 14px;
            padding: 14px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 18px;
          }

          .member-info {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
          }

          .member-avatar {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            overflow: hidden;
            background: linear-gradient(135deg, #2563eb, #22c55e);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            flex-shrink: 0;
          }

          .member-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .member-details {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .member-title-row,
          .member-meta-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }

          .member-name {
            font-weight: 600;
            color: #fff;
          }

          .member-you,
          .member-username,
          .role-placeholder {
            font-size: 12px;
            color: rgba(226, 232, 240, 0.65);
          }

          .role-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
          }

          .role-badge.owner {
            background: linear-gradient(135deg, #facc15, #fb923c);
            color: #111827;
          }

          .role-badge.admin {
            background: rgba(59, 130, 246, 0.18);
            color: #bfdbfe;
          }

          .role-badge.moderator {
            background: rgba(34, 197, 94, 0.18);
            color: #bbf7d0;
          }

          .role-badge.member {
            background: rgba(255, 255, 255, 0.08);
            color: rgba(226, 232, 240, 0.82);
          }

          .role-badge.bot {
            background: rgba(167, 139, 250, 0.18);
            color: #ddd6fe;
          }

          .member-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
          }

          .role-select {
            min-width: 148px;
            height: 38px;
            padding: 0 12px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
            outline: none;
          }

          .action-btn {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            border: none;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .action-btn.kick {
            background: rgba(239, 68, 68, 0.18);
            color: #fecaca;
          }

          .action-btn:disabled,
          .role-select:disabled {
            opacity: 0.7;
            cursor: progress;
          }

          .empty-members {
            padding: 36px 18px;
            text-align: center;
            color: rgba(226, 232, 240, 0.72);
          }

          @media (max-width: 640px) {
            .members-panel {
              width: 100%;
              border-left: none;
            }

            .member-item {
              flex-direction: column;
              align-items: stretch;
            }

            .member-actions {
              width: 100%;
              justify-content: space-between;
            }

            .role-select {
              flex: 1;
              min-width: 0;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default ChannelMembersPanel;
