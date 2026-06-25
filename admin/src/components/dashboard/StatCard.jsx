import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

function StatCard({ label, value, trend, trendUp = true, icon, iconBg, iconColor }) {
  return (
    <article className="stat-card">
      <div className="stat-card__icon" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="stat-card__body">
        <div className="stat-card__top">
          <p className="stat-card__value">{value}</p>
          {trend ? (
            <span className={`stat-card__trend stat-card__trend--${trendUp ? 'up' : 'down'}`}>
              {trendUp ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
              {trend}
            </span>
          ) : null}
        </div>
        <p className="stat-card__label">{label}</p>
      </div>
    </article>
  );
}

export default StatCard;
