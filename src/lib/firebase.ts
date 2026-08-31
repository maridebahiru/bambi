
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCD16UqssGbq-9wf-ja9QaiYrAXBhCjP50",
  authDomain: "mafimobile-58de0.firebaseapp.com",
  projectId: "mafimobile-58de0",
  storageBucket: "mafimobile-58de0.firebasestorage.app",
  messagingSenderId: "260409971626",
  appId: "1:260409971626:web:7776c07f2e4c8b2ab191d3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
