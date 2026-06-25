import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PeopleOutlineOutlinedIcon from '@mui/icons-material/PeopleOutlineOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import StarOutlineOutlinedIcon from '@mui/icons-material/StarOutlineOutlined';
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

export const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardOutlinedIcon },
  { to: '/bookings', label: 'Bookings', icon: Inventory2OutlinedIcon },
  { to: '/users', label: 'Users', icon: PeopleOutlineOutlinedIcon },
  { to: '/agents', label: 'Agents', icon: BadgeOutlinedIcon },
  { to: '/complaints', label: 'Complaints', icon: ReportProblemOutlinedIcon, badgeKey: 'complaints' },
  { to: '/reviews', label: 'Reviews', icon: StarOutlineOutlinedIcon },
  { to: '/mailbox', label: 'Mailbox', icon: MailOutlineOutlinedIcon, badgeKey: 'mailbox' },
  { to: '/payments', label: 'Payments', icon: CreditCardOutlinedIcon },
  { to: '/settings', label: 'Settings', icon: SettingsOutlinedIcon },
];

export function getPageTitle(pathname) {
  const item = navItems.find((nav) => nav.to === pathname);
  return item?.label ?? 'Dashboard';
}
