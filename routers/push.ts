import { Router } from "express";
import { addSubscription } from "../services/notifications.js";
import authMiddleware from "../auth/middleware.js";
import { RequestWithUser } from "./game";

const router = Router();

router.post("/subscribe", authMiddleware, async (req: RequestWithUser, res) => {
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

export default router;
