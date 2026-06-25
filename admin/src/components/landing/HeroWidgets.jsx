import LocalMallOutlinedIcon from '@mui/icons-material/LocalMallOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MoreVertIcon from '@mui/icons-material/MoreVert';

function HeroWidgets() {
  return (
    <div className="hero-widgets">
      <article className="hero-widget hero-widget--booking">
        <div className="hero-widget__icon hero-widget__icon--orange">
          <LocalMallOutlinedIcon />
        </div>
        <div className="hero-widget__body">
          <span className="hero-widget__label">Booking Status</span>
          <span className="hero-widget__value">1,248</span>
          <span className="hero-widget__trend hero-widget__trend--up">
            <TrendingUpIcon fontSize="inherit" />
            12.5%
            <span className="hero-widget__trend-muted">from last week</span>
          </span>
          <svg className="hero-widget__sparkline" viewBox="0 0 120 28" preserveAspectRatio="none">
            <polyline
              points="0,24 18,20 36,22 52,14 68,16 84,8 100,10 120,4"
              fill="none"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </article>

      <article className="hero-widget hero-widget--tracking">
        <div className="hero-widget__icon hero-widget__icon--red">
          <LocationOnOutlinedIcon />
        </div>
        <div className="hero-widget__body">
          <span className="hero-widget__label">Live Tracking</span>
          <span className="hero-widget__value hero-widget__value--status">On the way</span>
          <span className="hero-widget__route">Mumbai → Delhi</span>
          <div className="hero-widget__progress">
            <div className="hero-widget__progress-fill" />
          </div>
        </div>
      </article>

      <article className="hero-widget hero-widget--notifications">
        <div className="hero-widget__icon hero-widget__icon--soft-red">
          <NotificationsNoneOutlinedIcon />
        </div>
        <div className="hero-widget__body">
          <span className="hero-widget__label">New Notifications</span>
          <span className="hero-widget__value">8</span>
          <span className="hero-widget__trend-muted">Unread alerts</span>
        </div>
        <MoreVertIcon className="hero-widget__more" />
      </article>

      <article className="hero-widget hero-widget--revenue">
        <div className="hero-widget__icon hero-widget__icon--soft-orange">
          <BarChartOutlinedIcon />
        </div>
        <div className="hero-widget__body">
          <span className="hero-widget__label">Revenue Overview</span>
          <span className="hero-widget__value">₹12,48,000</span>
          <span className="hero-widget__trend hero-widget__trend--up">
            <TrendingUpIcon fontSize="inherit" />
            8.4%
            <span className="hero-widget__trend-muted">from last month</span>
          </span>
          <div className="hero-widget__bars">
            {[42, 58, 48, 72, 62, 88, 76].map((height, index) => (
              <span key={index} className="hero-widget__bar" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

export default HeroWidgets;
