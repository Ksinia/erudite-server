import { Router } from "express";
import appleSignin from "apple-signin-auth";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { toJWT } from "./jwt.js";
import User from "../models/user.js";
import { Sequelize } from "../models/index.js";
import { LOGIN_SUCCESS } from "../constants/outgoingMessageTypes.js";

const APPLE_AUDIENCE = ["com.xsenia.erudite"];
if (process.env.APPLE_SERVICE_ID) {
  APPLE_AUDIENCE.push(process.env.APPLE_SERVICE_ID);
}

const router = Router();

router.post("/auth/apple", async (req, res) => {
  const { identityToken, fullName, email } = req.body;

  if (!identityToken) {
    res.status(400).send({ message: "field_empty" });
    return;
  }

  try {
    const payload = await appleSignin.verifyIdToken(identityToken, {
      audience: APPLE_AUDIENCE,
      ignoreExpiration: false,
    });

    const appleUserId = payload.sub;

    let user = await User.findOne({ where: { appleId: appleUserId } });

    if (!user) {
      let userName = null;
      if (fullName?.givenName) {
        userName = fullName.givenName;
        if (fullName.familyName) {
          userName += " " + fullName.familyName;
        }
      }

      if (!userName) {
        userName = `Player_${crypto.randomUUID().slice(0, 8)}`;
      }

      const existingUser = await User.findOne({
        where: { name: { [Sequelize.Op.iLike]: userName } },
      });
      if (existingUser) {
        userName = `${userName}_${crypto.randomUUID().slice(0, 4)}`;
      }

      const randomPassword = bcrypt.hashSync(crypto.randomUUID(), 10);
      const userEmail = email || payload.email || null;

      user = await User.create({
        name: userName,
        password: randomPassword,
        email: userEmail,
        emailConfirmed: !!userEmail,
        appleId: appleUserId,
      });
    }

    const jwt = toJWT({ userId: user.id });
    const action = {
      type: LOGIN_SUCCESS,
      payload: {
        id: user.id,
        name: user.name,
        email: user.email || "",
        jwt,
        authMethod: "apple",
      },
    };
    res.send(JSON.stringify(action));
  } catch (err) {
    console.error("Apple sign-in error:", err);
    res.status(400).send({ message: "apple_signin_failed" });
  }
});

export default router;
