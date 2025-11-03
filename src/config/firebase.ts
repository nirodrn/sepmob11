import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB437jK903d6P-47Ig0TVlJg73EqDRGyV4",
  authDomain: "sepmzonline.firebaseapp.com",
  databaseURL: "https://sepmzonline-default-rtdb.firebaseio.com",
  projectId: "sepmzonline",
  storageBucket: "sepmzonline.firebasestorage.app",
  messagingSenderId: "948988754779",
  appId: "1:948988754779:web:1a09ac50084a8770c6f87e",
  measurementId: "G-NFVXRXS4X1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export const appId = firebaseConfig.appId;
export default app;