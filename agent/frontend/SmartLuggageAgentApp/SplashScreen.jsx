import React from 'react';

// The CSS styles are added to styles.css to handle the animations

export default function SplashScreen() {
  return (
    <div id="splash">
      <div className="sp-ring">
        <div className="sp-logo-box">
          {/* Logo SVG */}
          <svg width="44" height="44" viewBox="0 0 80 80" fill="none">
            <path d="M12 18 L38 12 L38 66 L12 72 Z" stroke="white" strokeWidth="5" strokeLinejoin="round" fill="none"/>
            <path d="M38 12 L68 18 L68 72 L38 66 Z" stroke="white" strokeWidth="5" strokeLinejoin="round" fill="none"/>
            <line x1="38" y1="12" x2="38" y2="66" stroke="white" strokeWidth="4"/>
            <path d="M52 28 Q63 28 63 37 Q63 46 52 46 Q41 46 41 55 Q41 59 46 61"
                  stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          </svg>
        </div>
      </div>

      <div className="sp-wordmark">
        <h1>Smart Luggage</h1>
        <p>Agent Portal</p>
      </div>

      <div className="sp-bar-wrap">
        <div className="sp-bar"></div>
      </div>
    </div>
  );
}
