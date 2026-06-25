import { useLocation } from 'react-router-dom';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { getPageTitle } from './navConfig';

function Navbar() {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);

  return (
    <header className="admin-navbar">
      <h1 className="admin-navbar__title">{title}</h1>

      <div className="admin-navbar__search">
        <span className="admin-navbar__search-icon" aria-hidden="true">
          <SearchOutlinedIcon />
        </span>
        <input type="search" placeholder="Search bookings, users, agents..." aria-label="Search" />
      </div>

      <div className="admin-navbar__actions">
        <button type="button" className="admin-navbar__avatar" aria-label="Admin profile">
          AD
        </button>
      </div>
    </header>
  );
}

export default Navbar;
