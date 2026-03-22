const MobileSidebarOverlay = ({ isOpen, onClose }) => {
  return (
    <div
      className={`sidebar-overlay${isOpen ? ' visible' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      style={{
        display: 'block',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 999,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
        touchAction: 'none'
      }}
    />
  )
}

export default MobileSidebarOverlay
