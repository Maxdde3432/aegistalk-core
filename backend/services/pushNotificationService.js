import admin from 'firebase-admin';

let firebaseApp = null;

const HIGH_IMPORTANCE_CHANNEL_ID = 'high_importance_channel';

const readServiceAccount = () => {
  const rawJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (rawJson) {
    try {
      return JSON.parse(rawJson);
    } catch (error) {
      console.error('[Push] FIREBASE_SERVICE_ACCOUNT_JSON parse error:', error.message);
      return null;
    }
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n')
    .trim();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey
  };
};

const getMessaging = () => {
  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  if (!firebaseApp) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('[Push] Firebase Admin initialized');
  }

  return admin.messaging(firebaseApp);
};

const toStringMap = (data = {}) =>
  Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );

export const sendChatPushNotification = async ({
  token,
  senderName,
  body,
  data = {}
}) => {
  const messaging = getMessaging();
  if (!messaging || !token) {
    return false;
  }

  const payload = {
    token,
    data: toStringMap({
      type: 'new_message',
      title: senderName || 'AegisTalk',
      body: body || 'Новое сообщение',
      ...data
    }),
    android: {
      priority: 'high',
      notification: {
        channelId: HIGH_IMPORTANCE_CHANNEL_ID
      }
    },
    apns: {
      headers: {
        'apns-priority': '10'
      },
      payload: {
        aps: {
          contentAvailable: true,
          sound: 'default'
        }
      }
    }
  };

  try {
    await messaging.send(payload);
    return true;
  } catch (error) {
    console.error('[Push] sendChatPushNotification error:', error);
    return false;
  }
};

export const sendIncomingCallPush = async ({
  token,
  callerName,
  data = {}
}) => {
  const messaging = getMessaging();
  if (!messaging || !token) {
    return false;
  }

  const payload = {
    token,
    data: toStringMap({
      type: 'incoming_call',
      ...data
    }),
    android: {
      priority: 'high',
      notification: {
        channelId: HIGH_IMPORTANCE_CHANNEL_ID
      }
    },
    apns: {
      headers: {
        'apns-push-type': 'background',
        'apns-priority': '10'
      },
      payload: {
        aps: {
          contentAvailable: true,
          sound: 'default'
        }
      }
    }
  };

  try {
    await messaging.send(payload);
    console.log('[Push] Incoming call push sent:', {
      callerName,
      callId: data.callId,
      targetUserId: data.targetUserId
    });
    return true;
  } catch (error) {
    console.error('[Push] sendIncomingCallPush error:', error);
    return false;
  }
};

export { HIGH_IMPORTANCE_CHANNEL_ID };
