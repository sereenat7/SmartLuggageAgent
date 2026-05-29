# Smart Luggage Agent App (Frontend)

This is the mobile application for Airline Luggage Agents, built with **React Native** and **Expo**. It allows agents to register, complete KYC verification (with address autocomplete), and manage luggage delivery tasks.

## 🚀 Prerequisites

- **Node.js** (v16 or later) installed.
- **Expo Go** app installed on your physical Android/iOS device (optional, for testing content on real devices).
- A valid **Google Maps API Key** (for address autocomplete features).

## 🛠️ Installation & Setup

1.  **Navigate to the project directory:**
    ```bash
    cd agent/frontend/SmartLuggageAgentApp
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure Environment Variables (IMPORTANT):**

    ### A. Google Maps API Key
    This app uses Google Places Autocomplete for address verification.
    1.  Get an API Key from the [Google Cloud Console](https://console.cloud.google.com/).
    2.  Enable the **Places API** and **Geocoding API**.
    3.  Open `components/steps/Step3AddressProof.js`.
    4.  Replace `'YOUR_GOOGLE_MAPS_API_KEY'` with your actual API key:
        ```javascript
        const GOOGLE_API_KEY = 'AIzaSyA...'; 
        ```

    ### B. Backend API URL
    1.  Find your computer's local IP address (e.g., `10.159.173.44`).
    2.  Open `config.js`.
    3.  Update the `API_URL` to point to your backend server:
        ```javascript
        export const API_URL = 'http://10.159.173.44:4000'; // Replace with your IP
        ```

## 🏃 Running the App

1.  **Start the development server:**
    ```bash
    npm start
    # or
    npx expo start
    ```

2.  **Launch on Device/Simulator:**
    -   **Physical Device:** Scan the QR code with the **Expo Go** app (Android) or Camera app (iOS).
    -   **Android Emulator:** Press `a` in the terminal.
    -   **iOS Simulator:** Press `i` in the terminal (macOS only).
    -   **Web:** Press `w` to run in the browser.

## 📱 Features

-   **Agent Registration & Login**: Use email/password to sign up.
-   **KYC Verification**: Upload documents and verify identity.
-   **Address Autocomplete**: Powered by Google Places API.
-   **Task Management**: View assigned luggage pickups and deliveries.
-   **Profile Management**: Update personal details.

## ⚠️ Troubleshooting

-   **"Network Error" or Connection Refused**: Ensure your phone remains on the same Wi-Fi network as your computer, and you have updated `config.js` with the correct local IP address instead of `localhost`.
-   **Google Maps Error**: Ensure your API key has billing enabled (required for Google Maps Platform) and the correct APIs (Places, Geocoding) are enabled in the Google Cloud Console.
