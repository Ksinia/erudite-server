import webpush from "web-push";
import Subscription from "../models/subscription.js";
import Subscription_User from "../models/subscription_user.js";
import User from "../models/user.js";
import { clientUrl } from "../constants/runtime.js";
import { sendExpoPushNotification, getPushToken } from "./expoPush.js";

webpush.setVapidDetails(
  clientUrl,
  "BCuWzn-RCbRvgqOZ-YmJQ2h29nYRhKalJZ2m5ZfUJwkwdUqfX_EMpfVTzk3MeCv_yaVsMisl_9czEbjmx7T3JFc",
  process.env.VAPI_KEY || "ZGlatY9qBu2xGgbuOt1dIrwXzSDE-jBb1pnxfiwQDcY" //TODO:  OOPS. Leaked key. But seriously don't do that. Generate new and save in heroku
);

export async function addSubscription(userId, subscriptionDetails, userAgent) {
  let subscription = await Subscription.findOne({
    where: {
      subscription: subscriptionDetails,
    },
  });
  if (!subscription) {
    subscription = await Subscription.create({
      subscription: subscriptionDetails,
      userAgent,
    });
  }
  const user = await User.findByPk(userId);
  await subscription.addUser(user);

  return subscription;
}

export async function notify(
  userId: number,
  { title, message = undefined, gameId }
) {
  try {
    // First, try Expo push notification (for React Native clients)
    const expoPushToken = getPushToken(userId);
    if (expoPushToken) {
      console.log(`Sending Expo push notification to user ${userId}`);
      try {
        await sendExpoPushNotification(userId, {
          title,
          body: message,
          data: {
            type: gameId ? "game_update" : "general",
            gameId: gameId,
          },
        });
        console.log("Expo push notification sent successfully");
        return; // Success, no need to try web push
      } catch (error) {
        console.error("Failed to send Expo push notification:", error);
        // Continue to web push as fallback
      }
    }

    // Fallback to web push notifications (for web clients)
    const subscriptions = await Subscription.findAll({
      include: [
        {
          model: User,
          attributes: [],
          as: "users",
          through: Subscription_User,
          where: { id: userId },
        },
      ],
    });

    if (Array.isArray(subscriptions) && subscriptions.length > 0) {
      console.log(`Sending web push notifications to user ${userId}`);
      await Promise.all(
        subscriptions.filter(Boolean).map(async (subscription) => {
          console.log("Sending offline web push message to", subscription.id);
          try {
            await webpush.sendNotification(
              subscription.subscription,
              JSON.stringify({ title, message, gameId })
            );
            await subscription.update({
              failureCount: 0,
              lastSuccess: new Date(),
            });
          } catch (e) {
            console.error("Sending offline web push message failed:", e);
            if (subscription.failureCount === 3) {
              await subscription.destroy();
            } else {
              await subscription.update({
                failureCount: subscription.failureCount + 1,
              });
            }
          }
        })
      );
    } else {
      console.log(`No push tokens (Expo or Web) found for user ${userId}`);
    }
  } catch (e) {
    console.error("Error in notify function:", e);
  }
}
