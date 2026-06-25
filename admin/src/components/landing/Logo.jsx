import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';

function Logo({ size = 'md', showSubtitle = true, centered = false }) {
  const isSm = size === 'sm';

  return (
    <div className={`landing-logo ${isSm ? 'landing-logo--sm' : ''} ${centered ? 'landing-logo--centered' : ''}`}>
      <div className="landing-logo__icon" aria-hidden="true">
        <FlightTakeoffIcon />
      </div>
      {showSubtitle ? (
        <div className="landing-logo__text">
          <span className="landing-logo__title">SMART LUGGAGE</span>
          <span className="landing-logo__subtitle">ADMIN</span>
        </div>
      ) : null}
    </div>
  );
}

export default Logo;
