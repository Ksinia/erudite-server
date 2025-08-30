import { Expo, ExpoPushMessage } from "expo-server-sdk";

// Create a new Expo SDK client
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
  useFcmV1: true, // Use FCM v1 API
});

// Store push tokens in memory for now (in production, use a proper database)
const userPushTokens = new Map<number, string>();

export function storePushToken(userId: number, pushToken: string) {
  if (Expo.isExpoPushToken(pushToken)) {
    userPushTokens.set(userId, pushToken);
    console.log(`Stored Expo push token for user ${userId}:`, pushToken);
  } else {
    console.warn(`Push token ${pushToken} is not a valid Expo push token`);
  }
}

export function removePushToken(userId: number) {
  userPushTokens.delete(userId);
  console.log(`Removed push token for user ${userId}`);
}

export function getPushToken(userId: number): string | undefined {
  return userPushTokens.get(userId);
}

export async function sendExpoPushNotification(
  userId: number,
  {
    title,
    body,
    data,
  }: { title: string; body?: string; data?: Record<string, unknown> }
) {
  const pushToken = userPushTokens.get(userId);

  if (!pushToken) {
    console.log(`No push token found for user ${userId}`);
    return;
  }

  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  // Construct message
  const messages: ExpoPushMessage[] = [
    {
      to: pushToken,
      sound: "default",
      title,
      body,
      data,
      // Add category for iOS interactive notifications
      categoryId: data?.type || "default",
    },
  ];

  // Send the push notification
  try {
    const tickets = await expo.sendPushNotificationsAsync(messages);
    console.log("Push notification sent successfully:", tickets);

    // Handle any errors
    for (const ticket of tickets) {
      if (ticket.status === "error") {
        console.error("Error sending push notification:", ticket.message);
        if (ticket.details && ticket.details.error === "DeviceNotRegistered") {
          // Remove invalid token
          removePushToken(userId);
        }
      }
    }

    return tickets;
  } catch (error) {
    console.error("Error sending push notification:", error);
    throw error;
  }
}

export async function sendBulkExpoPushNotifications(
  notifications: Array<{
    userId: number;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
  }>
) {
  const messages: ExpoPushMessage[] = [];

  for (const notification of notifications) {
    const pushToken = userPushTokens.get(notification.userId);

    if (pushToken && Expo.isExpoPushToken(pushToken)) {
      messages.push({
        to: pushToken,
        sound: "default",
        title: notification.title,
        body: notification.body,
        data: notification.data,
        categoryId: notification.data?.type || "default",
      });
    }
  }

  if (messages.length === 0) {
    console.log("No valid push tokens found for bulk notifications");
    return;
  }

  try {
    // Send notifications in chunks (Expo recommends chunks of 100)
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    console.log(`Sent ${messages.length} push notifications`);
    return tickets;
  } catch (error) {
    console.error("Error sending bulk push notifications:", error);
    throw error;
  }
}

// Get all stored push tokens (for debugging)
export function getAllPushTokens() {
  return Array.from(userPushTokens.entries());
}
