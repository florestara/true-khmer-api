import admin from "firebase-admin";
import { env } from "../config/env";

let cachedApp: admin.app.App | undefined = undefined;

export function getFirebaseApp(): admin.app.App {
  if (cachedApp) {
    return cachedApp;
  }

  const existingApps = admin.apps;
  if (existingApps.length > 0 && existingApps[0]) {
    cachedApp = existingApps[0];
    return cachedApp;
  }

  if (
    !env.FIREBASE_PROJECT_ID ||
    !env.FIREBASE_CLIENT_EMAIL ||
    !env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error(
      "Firebase is not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  cachedApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });

  return cachedApp;
}

export function getMessaging(): admin.messaging.Messaging {
  return getFirebaseApp().messaging();
}
