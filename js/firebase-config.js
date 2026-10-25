import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDpbXnQ5px7keruQxjxfkHkNzAx_334Z5M",
  authDomain: "maumin-fashion.firebaseapp.com",
  projectId: "maumin-fashion",
  storageBucket: "maumin-fashion.firebasestorage.app",
  messagingSenderId: "119033603735",
  appId: "1:119033603735:web:4560aaa263d97d45e16bd2",
  measurementId: "G-E39RD3255N"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
