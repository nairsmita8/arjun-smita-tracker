// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyACYB0OH8SjhQn490BjZFzkx6-B_tyqQ_I",
  authDomain: "day-challenge-84370.firebaseapp.com",
  projectId: "day-challenge-84370",
  storageBucket: "day-challenge-84370.firebasestorage.app",
  messagingSenderId: "627968710299",
  appId: "1:627968710299:web:a55f15895f755d8d96d83e",
  measurementId: "G-R5KNJEH5MZ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
