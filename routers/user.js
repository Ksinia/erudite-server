import { Router } from "express";
import Game from "../models/game.js";
import User from "../models/user.js";
import { Sequelize } from "../models/index.js";
import bcrypt from "bcrypt";
import { login } from "../auth/router.js";
import authMiddleware from "../auth/middleware.js";
import { toData, toJWT } from "../auth/jwt.js";
import { clientUrl } from "../constants/runtime.js";
import {
  sendEmailConfirmationLink,
  sendPasswordResetLink,
} from "../services/mail.js";

const router = Router();

router.post("/signup", async (req, res, next) => {
  if (!req.body.password) {
    res.status(400).send({
      message: "Password should not be empty",
    });
    return;
  }
  if (!req.body.name) {
    res.status(400).send({
      message: "Name should not be empty",
    });
    return;
  }
  if (!req.body.email) {
    res.status(400).send({
      message: "Email should not be empty",
    });
    return;
  }
  const userData = {
    name: req.body.name.trim(),
    password: bcrypt.hashSync(req.body.password, 10),
    email: req.body.email.trim(),
  };
  let userWithSameName = null;
  try {
    userWithSameName = await User.findOne({
      where: {
        name: {
          [Sequelize.Op.iLike]: userData.name.toLowerCase(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
  let userWithSameEmail = null;
  try {
    userWithSameEmail = await User.findOne({
      where: {
        email: {
          [Sequelize.Op.iLike]: req.body.email.toLowerCase(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
  if (userWithSameName) {
    res.status(400).send({ message: "This name is already in use" });
  } else if (userWithSameEmail) {
    res.status(400).send({ message: "This email is already in use" });
  } else {
    try {
      const newUser = await User.create(userData);
      await login(res, next, newUser.name, req.body.password);
      const shortTermJwt = toJWT(
        { userId: newUser.id, email: newUser.email },
        true
      );
      const link = `${clientUrl}/confirm-email?jwt=${shortTermJwt}`;
      sendEmailConfirmationLink(newUser, link);
    } catch (error) {
      if (error.name === "SequelizeValidationError") {
        res.status(400).send({
          message: error.errors[0].message,
        });
      } else {
        next(error);
      }
    }
  }
});

router.post("/change-password", authMiddleware, async (req, res, next) => {
  const currentUser = req.user;
  if (!req.body.password) {
    res.status(400).send({
      message: "Password should not be empty",
    });
  } else {
    const newPassword = bcrypt.hashSync(req.body.password, 10);
    try {
      await currentUser.update({ password: newPassword });
      res.send("Password changed");
    } catch (error) {
      next(error);
    }
  }
});

router.post("/generate-link", async (req, res, next) => {
  if (!req.body.name) {
    res.status(400).send({
      message: "Name should not be empty",
    });
  } else {
    try {
      const currentUser = await User.findOne({
        where: { name: req.body.name },
      });
      if (!currentUser) {
        res.status(400).send({
          message: "User with that name does not exist",
        });
      } else {
        const shortTermJwt = toJWT({ userId: currentUser.id }, true);
        const link = `${clientUrl}/user?jwt=${shortTermJwt}`;
        if (currentUser.email) {
          await sendPasswordResetLink(currentUser, link);
          await currentUser.update({ link });
          res.send("Link sent");
        } else {
          await currentUser.update({ link });
          res.send("Link generated");
        }
      }
    } catch (error) {
      next(error);
    }
  }
});

router.get("/my/finished-games", authMiddleware, async (req, res, next) => {
  const currentUser = req.user;
  try {
    const games = await Game.findAll({
      order: [["updatedAt", "DESC"]],
      where: {
        phase: "finished",
        turnOrder: {
          [Sequelize.Op.contains]: currentUser.id,
        },
      },
      attributes: [
        "id",
        "phase",
        "turnOrder",
        "language",
        "maxPlayers",
        "result",
      ],
      include: [
        {
          model: User,
          as: "users",
          attributes: ["id", "name"],
        },
      ],
    });
    res.send(games);
  } catch (error) {
    next(error);
  }
});

router.get("/my/archived-games", authMiddleware, async (req, res, next) => {
  const currentUser = req.user;
  try {
    const games = await Game.findAll({
      order: [["updatedAt", "DESC"]],
      where: {
        archived: true,
        turnOrder: {
          [Sequelize.Op.contains]: currentUser.id,
        },
      },
      attributes: [
        "id",
        "phase",
        "turnOrder",
        "language",
        "maxPlayers",
        "turn",
        "activeUserId",
      ],
      include: [
        {
          model: User,
          as: "users",
          attributes: ["id", "name"],
        },
      ],
    });
    const sortedGames = games.sort((a, b) => {
      if (b.activeUserId === currentUser.id) {
        return 1;
      } else {
        return -1;
      }
    });
    res.send(sortedGames);
  } catch (error) {
    next(error);
  }
});

router.get("/confirm-email", authMiddleware, async (req, res, next) => {
  const currentUser = req.user;
  const auth =
    req.headers.authorization && req.headers.authorization.split(" ");
  let data;
  try {
    data = toData(auth[1]);
  } catch (error) {
    console.log("problem retrieving user:", error);
    next(error);
  }
  const emailFromJwt = data.email;
  if (emailFromJwt !== currentUser.email) {
    res.status(401).send({
      message: "Email does not match",
    });
  } else {
    try {
      await currentUser.update({ emailConfirmed: true });
      res.send("Email confirmed");
    } catch (error) {
      next(error);
    }
  }
});

export default router;
