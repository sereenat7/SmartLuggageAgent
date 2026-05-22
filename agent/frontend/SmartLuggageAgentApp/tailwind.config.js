/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx}',
    './SplashScreen.jsx',
    './LandingPage.jsx',
    './LoginPage.jsx',
    './SignupPage.jsx',
    './screens/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './navigation/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#ff6600',
        brandDark: '#d43620',
        brandLight: '#ff8a80',
      }
    },
  },
  plugins: [],
}

