import { useEffect, useMemo, useState } from 'react';
import { Bot, Search, UserPlus, X } from 'lucide-react';
import { usersAPI } from '../api/chats';
import { resolveAssetUrl } from '../api/runtimeConfig';

const GroupMemberPickerModal = ({
  isOpen,
  onClose,
  onAddMember,
  existingMembers = []
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [addingId, setAddingId] = useState(null);

  const existingMemberIds = useMemo(
    () => new Set(existingMembers.map((member) => member.id)),
    [existingMembers]
  );

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setError('');
      setAddingId(null);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError('');
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        setIsLoading(true);
        setError('');
        const foundUsers = await usersAPI.searchUsers(trimmed);
        if (cancelled) return;
        setResults(Array.isArray(foundUsers) ? foundUsers : []);
      } catch (searchError) {
        if (cancelled) return;
        console.error('[GroupMemberPicker] Search error:', searchError);
        setResults([]);
        setError(searchError?.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u043f\u043e\u0438\u0441\u043a');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isOpen, query]);

  if (!isOpen) return null;

  const availableResults = results.filter((item) => !existingMemberIds.has(item.id));

  const handleAdd = async (user) => {
    if (!user?.id || addingId) return;
    setAddingId(user.id);
    try {
      await onAddMember(user);
      setQuery('');
      setResults([]);
    } catch (error) {
      console.error('[GroupMemberPicker] Add member error:', error);
      alert(error?.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="group-member-picker-overlay" onClick={onClose}>
      <div className="group-member-picker" onClick={(event) => event.stopPropagation()}>
        <div className="group-member-picker__header">
          <div>
            <h3>{'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0430'}</h3>
            <p>{'\u041c\u043e\u0436\u043d\u043e \u0434\u043e\u0431\u0430\u0432\u043b\u044f\u0442\u044c \u0438 \u043b\u044e\u0434\u0435\u0439, \u0438 \u0431\u043e\u0442\u043e\u0432 \u043f\u043e username.'}</p>
          </div>
          <button type="button" className="group-member-picker__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <label className="group-member-picker__search">
          <Search size={16} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={'\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0438\u043c\u0435\u043d\u0438 \u0438\u043b\u0438 @username'}
            autoFocus
          />
        </label>

        <div className="group-member-picker__content">
          {!query.trim() || query.trim().length < 2 ? (
            <div className="group-member-picker__state">{'\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043c\u0438\u043d\u0438\u043c\u0443\u043c 2 \u0441\u0438\u043c\u0432\u043e\u043b\u0430 \u0434\u043b\u044f \u043f\u043e\u0438\u0441\u043a\u0430.'}</div>
          ) : null}

          {isLoading ? <div className="group-member-picker__state">{'\u0418\u0449\u0435\u043c \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432...'}</div> : null}
          {error ? <div className="group-member-picker__state error">{error}</div> : null}

          {!isLoading && query.trim().length >= 2 && !error && availableResults.length === 0 ? (
            <div className="group-member-picker__state">{'\u041d\u0438\u043a\u043e\u0433\u043e \u043d\u0435 \u043d\u0430\u0448\u043b\u0438 \u0438\u043b\u0438 \u0432\u0441\u0435 \u0443\u0436\u0435 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u044b.'}</div>
          ) : null}

          <div className="group-member-picker__results">
            {availableResults.map((item) => {
              const initials = (item.displayName || item.firstName || item.username || 'U').charAt(0).toUpperCase();
              return (
                <div key={item.id} className="group-member-picker__item">
                  <div className="group-member-picker__identity">
                    <div className="group-member-picker__avatar">
                      {item.avatarUrl ? (
                        <img src={resolveAssetUrl(item.avatarUrl)} alt={item.displayName || item.username || 'User'} />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div className="group-member-picker__meta">
                      <div className="group-member-picker__name-row">
                        <span className="group-member-picker__name">{item.displayName || item.firstName || item.username || '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c'}</span>
                        {item.isBot ? (
                          <span className="group-member-picker__bot-badge">
                            <Bot size={12} /> Bot
                          </span>
                        ) : null}
                      </div>
                      <span className="group-member-picker__username">{item.username ? `@${item.username}` : '\u0411\u0435\u0437 username'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="group-member-picker__add"
                    onClick={() => handleAdd(item)}
                    disabled={addingId === item.id}
                  >
                    <UserPlus size={16} />
                    {addingId === item.id ? '\u0414\u043e\u0431\u0430\u0432\u043b\u044f\u0435\u043c...' : '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <style>{`
          .group-member-picker-overlay {
            position: fixed;
            inset: 0;
            z-index: 1400;
            background: rgba(4, 9, 18, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }

          .group-member-picker {
            width: min(560px, 100%);
            max-height: min(80vh, 720px);
            background: linear-gradient(180deg, rgba(17, 24, 39, 0.98), rgba(8, 12, 20, 0.98));
            border: 1px solid rgba(88, 130, 255, 0.2);
            border-radius: 22px;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .group-member-picker__header {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-start;
            padding: 22px 22px 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }

          .group-member-picker__header h3 {
            margin: 0 0 6px;
            font-size: 20px;
          }

          .group-member-picker__header p {
            margin: 0;
            color: rgba(226, 232, 240, 0.72);
            font-size: 13px;
          }

          .group-member-picker__close {
            width: 36px;
            height: 36px;
            border-radius: 12px;
            border: none;
            background: rgba(255, 255, 255, 0.06);
            color: #fff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .group-member-picker__search {
            margin: 16px 22px 0;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 14px;
            min-height: 48px;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: rgba(226, 232, 240, 0.72);
          }

          .group-member-picker__search input {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: #fff;
            font-size: 15px;
          }

          .group-member-picker__content {
            padding: 18px 22px 22px;
            overflow-y: auto;
          }

          .group-member-picker__state {
            padding: 16px;
            border-radius: 16px;
            background: rgba(255, 255, 255, 0.04);
            color: rgba(226, 232, 240, 0.72);
            font-size: 14px;
            margin-bottom: 12px;
          }

          .group-member-picker__state.error {
            color: #fecaca;
            background: rgba(127, 29, 29, 0.28);
          }

          .group-member-picker__results {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .group-member-picker__item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 14px;
            padding: 14px;
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.06);
          }

          .group-member-picker__identity {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
          }

          .group-member-picker__avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            overflow: hidden;
            background: linear-gradient(135deg, #3b82f6, #22c55e);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            flex-shrink: 0;
          }

          .group-member-picker__avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .group-member-picker__meta {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .group-member-picker__name-row {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
          }

          .group-member-picker__name {
            color: #fff;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .group-member-picker__bot-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 999px;
            background: rgba(56, 189, 248, 0.16);
            color: #7dd3fc;
            font-size: 11px;
            font-weight: 600;
            flex-shrink: 0;
          }

          .group-member-picker__username {
            color: rgba(226, 232, 240, 0.65);
            font-size: 13px;
          }

          .group-member-picker__add {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            height: 40px;
            padding: 0 14px;
            border-radius: 999px;
            border: none;
            background: linear-gradient(135deg, #2563eb, #4f46e5);
            color: #fff;
            font-weight: 600;
            cursor: pointer;
            flex-shrink: 0;
          }

          .group-member-picker__add:disabled {
            opacity: 0.7;
            cursor: progress;
          }

          @media (max-width: 640px) {
            .group-member-picker-overlay {
              padding: 12px;
              align-items: flex-end;
            }

            .group-member-picker {
              width: 100%;
              max-height: min(82dvh, 760px);
              border-radius: 24px 24px 16px 16px;
            }

            .group-member-picker__item {
              align-items: flex-start;
              flex-direction: column;
            }

            .group-member-picker__add {
              width: 100%;
              justify-content: center;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default GroupMemberPickerModal;
