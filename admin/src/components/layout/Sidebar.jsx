import { NavLink, useNavigate } from 'react-router-dom';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import LuggageOutlinedIcon from '@mui/icons-material/LuggageOutlined';
import { navItems } from './navConfig';
import { useComplaintCount } from '../../hooks/useComplaintCount';
import { useMailboxUnreadCount } from '../../hooks/useMailboxUnreadCount';
import { useAuth } from '../../context/AuthContext';

function getInitials(name) {
  const parts = String(name || 'Admin')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return 'AD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function Sidebar() {
  const navigate = useNavigate();
  const { admin, logout } = useAuth();
  const pendingComplaints = useComplaintCount();
  const unreadMail = useMailboxUnreadCount();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const getBadge = (item) => {
    if (item.badgeKey === 'complaints') {
      return pendingComplaints > 0 ? String(pendingComplaints) : null;
    }
    if (item.badgeKey === 'mailbox') {
      return unreadMail > 0 ? String(unreadMail) : null;
    }
    return item.badge ?? null;
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <div className="admin-sidebar__logo" aria-hidden="true">
          <LuggageOutlinedIcon />
        </div>
        <div className="admin-sidebar__brand-text">
          <span className="admin-sidebar__brand-title">Smart Luggage</span>
          <span className="admin-sidebar__brand-subtitle">Admin Console</span>
        </div>
      </div>

      <nav className="admin-sidebar__nav" aria-label="Admin navigation">
        <ul className="admin-sidebar__list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const badge = getBadge(item);
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`
                  }
                >
                  <Icon />
                  <span className="admin-sidebar__label">{item.label}</span>
                  {badge ? <span className="admin-sidebar__badge">{badge}</span> : null}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="admin-sidebar__footer">
        <div className="admin-sidebar__profile">
          <div className="admin-sidebar__avatar" aria-hidden="true">
            {getInitials(admin?.name)}
          </div>
          <div className="admin-sidebar__profile-info">
            <div className="admin-sidebar__profile-name">{admin?.name || 'Admin User'}</div>
            <div className="admin-sidebar__profile-role">{admin?.role || 'Super Admin'}</div>
          </div>
        </div>
        <button type="button" className="admin-sidebar__logout" onClick={handleLogout}>
          <LogoutOutlinedIcon fontSize="small" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
