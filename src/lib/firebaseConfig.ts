import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyB904wL5tEZoDqx2FO5VMyP4rTjIHVdp6Q',
  authDomain: 'kamigikai-wakisaka.firebaseapp.com',
  projectId: 'kamigikai-wakisaka',
  storageBucket: 'kamigikai-wakisaka.appspot.com',
  messagingSenderId: '975308656981',
  appId: '1:975308656981:web:7203724c50890ef0fe9fdc',
  measurementId: 'G-1XQT0X75N2'
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);