
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAOkHlelDiXHliQx3krat3ZGYKJShV772Q",
  authDomain: "bambi-8a6b0.firebaseapp.com",
  projectId: "bambi-8a6b0",
  storageBucket: "bambi-8a6b0.firebasestorage.app",
  messagingSenderId: "470050533670",
  appId: "1:470050533670:web:9257e1ede8e68da5df91e7",
  measurementId: "G-RBMK9LWKZS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
