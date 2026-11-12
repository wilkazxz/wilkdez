// Isi dari Firebase Console > Project settings > Your apps > Web app
export const firebaseConfig = {
  apiKey: "ISI_API_KEY",
  authDomain: "ISI_PROJECT.firebaseapp.com",
  projectId: "ISI_PROJECT_ID",
  appId: "ISI_APP_ID"
};
export const configured = !firebaseConfig.apiKey.startsWith("ISI");
