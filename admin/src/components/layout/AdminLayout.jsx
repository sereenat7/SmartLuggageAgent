import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BookingAlertListener from '../notifications/BookingAlertListener';
import { useAuth } from '../../context/AuthContext';
import './AdminLayout.css';

function AdminLayout() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const isDashboard = pathname === '/dashboard';

  return (
    <div className="admin-layout">
      {isAuthenticated ? <BookingAlertListener /> : null}
      <Sidebar />
      <div className="admin-layout__main">
        {isDashboard ? <Navbar /> : null}
        <main className={`admin-layout__content${!isDashboard ? ' admin-layout__content--full' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
