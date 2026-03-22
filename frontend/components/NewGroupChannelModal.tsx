import React, { useEffect, useMemo, useState } from "react";

type GroupType = "group" | "channel";
type ChannelVisibility = "public" | "private";

export type NewGroupChannelModalCreatePayload = {
  name: string;
  description: string;
  type: GroupType;
  isPublic?: boolean;
};

export type NewGroupChannelModalProps = {
  onClose: () => void;
  onCreate: (payload: NewGroupChannelModalCreatePayload) => void | Promise<void>;
};

type OptionCardProps = {
  active: boolean;
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
};

function OptionCard({ active, icon, title, desc, onClick }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`aegis-option-card${active ? " aegis-option-card--active" : ""}`}
    >
      <div className="aegis-option-card-inner">
        <div
          className={`aegis-option-icon${
            active ? " aegis-option-icon--active" : ""
          }`}
          aria-hidden="true"
        >
          <span className="aegis-option-icon-emoji">{icon}</span>
        </div>

        <div className="aegis-option-text">
          <div className="aegis-option-title">{title}</div>
          <div className="aegis-option-desc">{desc}</div>
        </div>
      </div>
    </button>
  );
}

export default function NewGroupChannelModal({
  onClose,
  onCreate,
}: NewGroupChannelModalProps) {
  // Local state: keeps the modal self-contained and predictable.
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("group");
  const [channelVisibility, setChannelVisibility] =
    useState<ChannelVisibility>("public");

  const showChannelSettings = groupType === "channel";

  const canCreate = useMemo(() => name.trim().length > 0, [name]);

  useEffect(() => {
    // Close on Escape for expected modal UX.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    // When switching away from Channel, reset channel-only settings.
    if (!showChannelSettings) setChannelVisibility("public");
  }, [showChannelSettings]);

  const handleCreate = async () => {
    if (!canCreate) return;

    await onCreate({
      name: name.trim(),
      description: description.trim(),
      type: groupType,
      ...(groupType === "channel"
        ? { isPublic: channelVisibility === "public" }
        : {}),
    });
  };

  return (
    <div
      className="aegis-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Новая группа / канал"
      onMouseDown={onClose}
    >
      <div
        className="aegis-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="aegis-modal-header">
          <div className="aegis-modal-title">Новая группа / канал</div>

          <button
            type="button"
            onClick={onClose}
            className="aegis-modal-close"
            aria-label="Закрыть"
            title="Закрыть"
          >
            <span>×</span>
          </button>
        </div>

        <div className="aegis-modal-body">
          <div className="aegis-field-group">
            <div>
              <div className="aegis-field-label">Название</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название группы или канала"
                className="aegis-input"
              />
            </div>

            <div>
              <div className="aegis-field-label">Описание</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Краткое описание..."
                className="aegis-textarea"
              />
            </div>
          </div>

          <div className="aegis-section">
            <div className="aegis-section-label">Тип</div>

            <div className="aegis-option-grid">
              <OptionCard
                active={groupType === "group"}
                icon="👥"
                title="Группа"
                desc="Общение"
                onClick={() => setGroupType("group")}
              />
              <OptionCard
                active={groupType === "channel"}
                icon="📢"
                title="Канал"
                desc="Рассылка"
                onClick={() => setGroupType("channel")}
              />
            </div>
          </div>

          {showChannelSettings && (
            <div className="aegis-section aegis-section--channel">
              <div className="aegis-section-label">Тип канала</div>

              <div className="aegis-option-grid">
                <OptionCard
                  active={channelVisibility === "public"}
                  icon="🌐"
                  title="Публичный"
                  desc="Виден в поиске"
                  onClick={() => setChannelVisibility("public")}
                />
                <OptionCard
                  active={channelVisibility === "private"}
                  icon="🔒"
                  title="Закрытый"
                  desc="По приглашению"
                  onClick={() => setChannelVisibility("private")}
                />
              </div>
            </div>
          )}

          <div className="aegis-modal-footer">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate}
              className={`aegis-primary-pill-btn${
                !canCreate ? " aegis-primary-pill-btn--disabled" : ""
              }`}
            >
              СОЗДАТЬ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
