const { Router } = require("express");
const { addSubscription } = require("../services/notifications");
const authMiddleware = require("../auth/middleware");

const router = new Router();

router.post("/subscribe", authMiddleware, async (req, res) => {
  const { subscription, userAgent } = req.body;
  const user = req.user;
  try {
    const savedSubscriptionForUser = await addSubscription(
      user.id,
      subscription,
      userAgent
    );
    res.send({ subscriptionId: savedSubscriptionForUser.id });
  } catch (error) {
    res.status(400).send({
      message: error.message,
    });
  }
});

module.exports = router;
