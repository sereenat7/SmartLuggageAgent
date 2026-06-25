import { useEffect, useMemo, useState } from 'react';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import MoreHorizOutlinedIcon from '@mui/icons-material/MoreHorizOutlined';
import { fetchUsers } from '../services/users';
import './Users.css';

const userStatusStyles = {
  Active: { bg: '#dcfce7', color: '#15803d' },
  Inactive: { bg: '#f3f4f6', color: '#6b7280' },
};

function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      try {
        setError('');
        const data = await fetchUsers();
        if (active) setUsers(data);
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              err.message ||
              'Failed to load users. Make sure the backend is running.',
          );
          setUsers([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUsers();
    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return users;

    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.phone.includes(query),
    );
  }, [users, search]);

  return (
    <div className="users-page">
      <div className="users-page__header">
        <div className="users-page__intro">
          <h2>Users</h2>
          <p>
            {loading
              ? 'Loading users...'
              : `${users.length} registered user${users.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <div className="users-page__search">
          <span className="users-page__search-icon" aria-hidden="true">
            <SearchOutlinedIcon />
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users..."
            aria-label="Search users"
            disabled={loading}
          />
        </div>
      </div>

      {error ? <p className="users-page__error">{error}</p> : null}

      <div className="users-panel">
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th className="users-table__phone-col">Phone</th>
                <th>Bookings</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="users-table__empty">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="users-table__empty">
                    {users.length === 0 ? 'No users registered yet.' : 'No users match your search.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const statusStyle = userStatusStyles[user.status] || userStatusStyles.Inactive;

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="users-table__user">
                          <span
                            className="users-table__avatar"
                            style={{ background: user.color }}
                            aria-hidden="true"
                          >
                            {user.initials}
                          </span>
                          <span className="users-table__name">{user.name}</span>
                        </div>
                      </td>
                      <td className="users-table__email">{user.email}</td>
                      <td className="users-table__phone">{user.phone}</td>
                      <td className="users-table__bookings">
                        <strong>{user.bookings}</strong> <span>trips</span>
                      </td>
                      <td>
                        <span
                          className="users-status"
                          style={{ background: statusStyle.bg, color: statusStyle.color }}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="users-table__action">
                        <button type="button" className="users-table__menu-btn" aria-label={`Actions for ${user.name}`}>
                          <MoreHorizOutlinedIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Users;
