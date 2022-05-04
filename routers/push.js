const { Router } = require("express");
const { addSubscription } = require("../services/notifications");
const authMiddleware = require("../auth/middleware");

const router = new Router();

router.post("/subscribe", authMiddleware, async (req, res) => {
  if (!req.body.password) {
    //STORE IN THE DB!!!
    addSubscription(req.user.id, req.body);
    res.status(200).send({
      message: "OK",
    });
    return;
  }
});

module.exports = router;
