// Config web app Firebase (aman terlihat publik; keamanan ada di firestore.rules)
export const firebaseConfig = {
  apiKey: "AIzaSyAXv967LeRViTOfVbDqoKCI6lMWVTKVq7U",
  authDomain: "wilkdezdev.firebaseapp.com",
  projectId: "wilkdezdev",
  storageBucket: "wilkdezdev.firebasestorage.app",
  messagingSenderId: "236757107711",
  appId: "1:236757107711:web:2eb5391509c5d940dd5dca",
  measurementId: "G-Q3WN9334DN"
};
export const configured = !firebaseConfig.apiKey.startsWith("ISI");
