# ☁️ CloudDrop — Instant File & Text Sharing

A modern, serverless file and text sharing web application powered by **Firebase**.

## 🚀 Features

- **File Upload** — Drag & drop or browse files (up to 20 MB) and get an instant share link
- **Text/Code Sharing** — Paste any text, code, or notes and share with a unique link
- **Auto-Expiry** — Set content to expire after 1 hour, 24 hours, 7 days, 30 days, or never
- **Preview Support** — Images and videos render inline; text files display with formatting
- **Mobile Friendly** — Fully responsive design works on all devices
- **No Sign-up Required** — Share instantly without creating an account

## 🏗️ Architecture

This project uses a **Firebase Backend-as-a-Service** architecture:

| Component | Service |
|-----------|---------|
| **Data Storage** | Cloud Firestore (Files are stored directly as Base64 strings) |
| **Hosting** | Firebase Hosting (optional) or any static host |
| **CDN** | Firebase CDN (built-in) |

### Project Structure

```
File-Freedom/
├── index.html              # Main upload page
├── share.html              # Share/download page
├── css/
│   └── style.css           # All styles
├── js/
│   ├── firebase-config.js  # Firebase initialization
│   ├── app.js              # Upload & share logic
│   └── share.js            # Share page logic
└── README.md
```

## ⚙️ Firebase Setup

### 1. Firebase Console Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Open the project: **file-freedom-mini-project**
3. Enable **Cloud Firestore**:
   - Go to Firestore Database → Create Database
   - Choose a location (e.g., `asia-south1`)
   - Start in **test mode** (allows all reads/writes for 30 days)

### 2. Firestore Security Rules (for production)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shares/{shareCode} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }
  }
}
```

### Limitations

- **File Size**: Because files are encoded as Base64 and stored directly inside Firestore documents (which have a strict 1 MB size limit), uploads are hard-capped at **750 KB**.

## 🖥️ Running Locally

Simply open `index.html` in a browser, or use any local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using VS Code
# Install "Live Server" extension and click "Go Live"
```

Then navigate to `http://localhost:8000` (or whatever port your server uses).

## 📦 Deploying to Firebase Hosting (Optional)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize hosting
firebase init hosting

# Deploy
firebase deploy --only hosting
```

## 🔧 Configuration

The Firebase config is in `js/firebase-config.js`. If you need to change the Firebase project, update the config object there.

## 📝 How It Works

1. **Upload Flow**: User drops a file → file uploads to Firebase Storage → metadata saved to Firestore → share link generated
2. **Text Share Flow**: User pastes text → content saved to Firestore → share link generated
3. **View Flow**: Recipient opens share link → metadata fetched from Firestore → file/text rendered with preview → download available

## 📄 License

MIT License — feel free to use and modify for your own projects.
