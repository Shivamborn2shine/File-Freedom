/**
 * CloudDrop — Firebase Configuration
 * Initializes Firebase App, Firestore, and Cloud Storage
 * Uses Firebase JS SDK v9+ (compat mode via CDN for simplicity)
 */

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAWpBvP-n4jiXxt37hjETRX6xgpYKlXD88",
  authDomain: "file-freedom-mini-project.firebaseapp.com",
  projectId: "file-freedom-mini-project",
  storageBucket: "file-freedom-mini-project.firebasestorage.app",
  messagingSenderId: "792750899552",
  appId: "1:792750899552:web:9e69a097c4d138e1f35e05",
  measurementId: "G-57ZRB61P0N"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export Firestore reference
const db = firebase.firestore();
