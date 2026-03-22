import { Navigate } from 'react-router-dom';
import { getAccessToken, clearTokens } from '../api/auth.js';

export const ProtectedRoute = ({
  user,
  requireOwner = false,
  ownerId = String(import.meta?.env?.VITE_OWNER_ID || '').trim(),
  unauthorized = '404', // '404' | 'login' | 'redirect'
  children,
}) => {
  const token = getAccessToken();
  if (!token) {
    try { clearTokens(); } catch {}
    return <Navigate to="/login" replace />;
  }

  if (!user?.id) {
    return <Navigate to="/login" replace />;
  }

  if (requireOwner && String(user.id) !== String(ownerId)) {
    if (unauthorized === 'login') return <Navigate to="/login" replace />;
    if (unauthorized === 'redirect') return <Navigate to="/chat" replace />;
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>404</div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;

