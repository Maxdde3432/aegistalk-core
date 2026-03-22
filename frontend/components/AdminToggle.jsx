import { useState } from 'react';

/**
 * Визуальный Toggle-переключатель
 */
export const AdminToggle = ({ enabled, onToggle }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    onToggle(!enabled);
    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <div
      className={`admin-toggle ${enabled ? 'on' : 'off'} ${isAnimating ? 'animating' : ''}`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="toggle-knob"></div>
      
      <style>{`
        .admin-toggle {
          position: relative;
          width: 34px;
          height: 18px;
          border-radius: 9px;
          transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
        }

        .admin-toggle.on {
          background: #007bff;
        }

        .admin-toggle.off {
          background: #3d3d3d;
        }

        .admin-toggle.animating {
          pointer-events: none;
        }

        .toggle-knob {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 14px;
          height: 14px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .admin-toggle.on .toggle-knob {
          transform: translateX(16px);
        }

        .admin-toggle.off .toggle-knob {
          transform: translateX(0);
        }

        .admin-toggle:hover {
          opacity: 0.8;
        }

        .admin-toggle:active .toggle-knob {
          transform: scale(0.9);
        }
      `}</style>
    </div>
  );
};
