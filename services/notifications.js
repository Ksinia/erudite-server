const webpush = require("web-push");

const subscriptions = {}; // SHOULD BE A DATABASE TABLE!!!

webpush.setVapidDetails(
  "https://erudit.ksinia.net",
  "BCuWzn-RCbRvgqOZ-YmJQ2h29nYRhKalJZ2m5ZfUJwkwdUqfX_EMpfVTzk3MeCv_yaVsMisl_9czEbjmx7T3JFc",
  process.env.VAPI_KEY || "ZGlatY9qBu2xGgbuOt1dIrwXzSDE-jBb1pnxfiwQDcY" // OOPS. Leaked key. But seriously don't do that. Generate new and save in heroku
);

function addSubscription(userId, subscription) {
  subscriptions[userId] = [subscription].concat(subscriptions[userId]);
}

function notify(userId, { title, message, gameId } = {}) {
  const subs = subscriptions[userId];
  if (Array.isArray(subs)) {
    subs.filter(Boolean).forEach(async (s) => {
      try {
        console.log("Sending offline push message to", s);
        await webpush.sendNotification(
          s,
          JSON.stringify({ title, message, gameId })
        );
      } catch (e) {
        console.error("uh oh", e);
      }
    });
  }
}

module.exports = {
  addSubscription,
  notify,
};
