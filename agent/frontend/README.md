# Smart Luggage Agent App — Frontend

A **React Native (Expo)** mobile application for delivery agents in the AirlineLuggage ecosystem. Agents use this app to log in, complete KYC verification, view and manage luggage pickup/delivery tasks, upload live luggage photos, and manage their profiles.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.79 + Expo SDK 54 |
| Navigation | React Navigation 7 (Native Stack) |
| Camera | expo-camera, expo-image-picker |
| File Handling | expo-document-picker |
| UI | expo-linear-gradient, @expo/vector-icons (Ionicons) |

---

## 📂 Project Structure

```
SmartLuggageAgentApp/
├── App.js                     # Root component (NavigationContainer + providers)
├── app.json                   # Expo configuration
├── package.json
├── assets/                    # App icons, splash screen
├── constants/
│   └── colors.js              # Centralized color system
├── navigation/
│   └── index.js               # Stack navigator (Login → Dashboard → Tasks → Profile)
├── screens/
│   ├── LoginScreen.js         # Login / Sign-up with mobile + password
│   ├── GuestScreen.js         # Guest mode info screen
│   ├── KYCFormScreen.js       # 8-step KYC verification wizard
│   ├── DashboardScreen.js     # Task list with Assigned / In Progress / Completed tabs
│   ├── TaskDetailsScreen.js   # Task detail view + status update + luggage photo upload
│   └── ProfileScreen.js       # Agent profile with responsive layout + logout
└── components/
    ├── AnimatedBackground.js
    ├── AnimatedCheckbox.js     # Checkbox with spring animation
    ├── AnimatedInput.js        # Text input with animated label
    ├── CameraSelfie.js         # Camera component for facial verification
    ├── CheckboxField.js
    ├── FileUploadBox.js        # File/image upload with gallery, camera & document picker
    ├── FileUploadField.js
    ├── ProgressStepper.js      # KYC step indicator with interactive hover effect
    ├── StepContainer.js
    ├── TextInputField.js
    └── steps/
        ├── Step1PersonalInfo.js
        ├── Step2GovernmentID.js
        ├── Step3AddressProof.js
        ├── Step4FacialRecognition.js
        ├── Step5BankDetails.js
        ├── Step6VehicleDetails.js
        ├── Step7EmergencyContact.js
        └── Step8Consent.js
```

---

## ⚡ Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** or **yarn**
- **Expo CLI** (`npx expo`)
- iOS Simulator / Android Emulator / Expo Go on a physical device

### Install & Run

```bash
cd agent/frontend/SmartLuggageAgentApp

# Install dependencies
npm install

# Start the Expo dev server
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS), or press `i` / `a` to open a simulator.

---

## 🖥️ Screens Overview

### 1. Login / Sign-Up
- Toggle between Login and Sign-Up forms.
- Login redirects to **Dashboard**; Sign-Up redirects to **KYC Form**.
- "Continue as Guest" option available.

### 2. KYC Form (8 Steps)
| Step | Content |
|------|---------|
| 1 | Personal Info (name, email, phone, DOB, nationality) |
| 2 | Government ID (type, number, front/back upload) |
| 3 | Address Proof (address fields + document upload) |
| 4 | Facial Recognition (selfie via device camera) |
| 5 | Bank Details (account name, bank, account number, IFSC) |
| 6 | Vehicle Details *(optional)* |
| 7 | Emergency Contact |
| 8 | Terms & Consent |

- Animated progress stepper with **interactive hover/press effect** on step circles.
- Per-step validation with inline error messages.

### 3. Dashboard
- Tab-filtered task list: **Assigned**, **In Progress**, **Completed**.
- Stats cards showing counts per status.
- Navigate to Task Details or Profile.

### 4. Task Details
- Customer info, pickup/drop addresses, time slot, luggage count.
- **Status update** dropdown (Assigned → In Progress → Completed).
- **Luggage weight** input and update.
- **📸 Luggage Photo Upload** — capture live photos via camera or select from gallery. Photos are displayed in a grid with remove functionality.

### 5. Profile
- Responsive layout that scales correctly on small screens.
- Displays personal info, ID, address, bank, and emergency contact.
- **Fixed logout button** always visible at the bottom, ensuring accessibility on all device sizes.
- Logout resets navigation stack to the **Sign-In** screen.

---

## 🎨 Design System

All colors are centralized in `constants/colors.js`:

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#E53935` | Brand red, buttons, active states |
| `primaryDark` | `#B71C1C` | Gradient end, pressed states |
| `success` | `#43A047` | Completed status, checkmarks |
| `warning` | `#FB8C00` | Assigned status, optional notes |
| `error` | `#D32F2F` | Validation errors, logout button |
| `info` | `#1E88E5` | In-progress status |

---

## 📱 Responsive Design

- Uses `Dimensions.get('window')` to detect screen size.
- Small device breakpoint (`< 380px` width) scales fonts, padding, and avatar sizes.
- Platform-specific adjustments for iOS safe areas and Android padding.
- Logout button is fixed outside ScrollView to remain visible on all devices.

---

## 📄 License

This project is private and part of the AirlineLuggage system.
