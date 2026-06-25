import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HeadsetMicOutlinedIcon from '@mui/icons-material/HeadsetMicOutlined';
import Logo from '../components/landing/Logo';
import HeroWidgets from '../components/landing/HeroWidgets';
import LoginCard from '../components/landing/LoginCard';
import heroScene from '../assets/images/hero-scene.png';
import './Landing.css';

function Landing() {
  return (
    <div
      className="landing-page"
      style={{ '--hero-bg': `url(${heroScene})` }}
    >
      <div className="landing-page__bg" aria-hidden="true" />

      <header className="landing-header">
        <Logo />

        <nav className="landing-nav" aria-label="Support links">
          <a href="#help" className="landing-nav__link">
            <HelpOutlineOutlinedIcon />
            <span>Help</span>
          </a>
          <a href="#documentation" className="landing-nav__link">
            <DescriptionOutlinedIcon />
            <span>Documentation</span>
          </a>
          <a href="#support" className="landing-nav__link">
            <HeadsetMicOutlinedIcon />
            <span>Contact Support</span>
          </a>
        </nav>
      </header>

      <main className="landing-main">
        <section className="landing-content">
          <div className="landing-hero__copy">
            <h1>
              Smart <span className="landing-hero__accent">Logistics.</span>
              <br />
              Smarter Management.
            </h1>
            <p>
              Track, manage and optimize your luggage delivery operations from one powerful dashboard.
            </p>
          </div>

          <div className="landing-hero__stage">
            <HeroWidgets />
          </div>
        </section>

        <section className="landing-login">
          <LoginCard />
        </section>
      </main>

      <footer className="landing-footer">
        <span>© 2026 Smart Luggage. All rights reserved.</span>
        <div className="landing-footer__links">
          <a href="#privacy">Privacy Policy</a>
          <span className="landing-footer__divider" aria-hidden="true">|</span>
          <a href="#terms">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
