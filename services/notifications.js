const webpush = require("web-push");
const { Subscription, User, Subscription_User } = require("../models");

webpush.setVapidDetails(
  "https://erudit.ksinia.net",
  "BCuWzn-RCbRvgqOZ-YmJQ2h29nYRhKalJZ2m5ZfUJwkwdUqfX_EMpfVTzk3MeCv_yaVsMisl_9czEbjmx7T3JFc",
  process.env.VAPI_KEY || "ZGlatY9qBu2xGgbuOt1dIrwXzSDE-jBb1pnxfiwQDcY" // OOPS. Leaked key. But seriously don't do that. Generate new and save in heroku
);

async function addSubscription(userId, subscriptionDetails, userAgent) {
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
  await subscription.addUsers(user);

  return subscription;
}

async function notify(userId, { title, message, gameId } = {}) {
  try {
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
    if (Array.isArray(subscriptions)) {
      await Promise.all(
        subscriptions.filter(Boolean).map(async (subscription) => {
          console.log("Sending offline push message to", subscription);
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
            console.error("Sending offline push message failed:", e);
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
    }
  } catch (e) {
    console.error(e);
  }
}

module.exports = {
  addSubscription,
  notify,
};
