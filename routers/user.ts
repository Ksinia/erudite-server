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
import { getFirstTurnWord } from "../services/lobby.js";
import { removePushToken } from "../services/expoPush.js";
import Message from "../models/message.js";
import { RequestWithUser } from "./game";

const router = Router();

const SHARED_EMAIL = "none@example.com";

router.post("/signup", async (req, res, next) => {
  if (!req.body.password) {
    res.status(400).send({
      message: "password_empty",
    });
    return;
  }
  if (!req.body.name) {
    res.status(400).send({
      message: "name_empty",
    });
    return;
  }
  if (!req.body.email) {
    res.status(400).send({
      message: "email_empty",
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
  const emailIsShared =
    req.body.email && req.body.email.toLowerCase() === SHARED_EMAIL;
  if (!emailIsShared) {
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
  }
  if (userWithSameName) {
    res.status(400).send({ message: "name_taken" });
  } else if (userWithSameEmail) {
    res.status(400).send({ message: "email_taken" });
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

router.post(
  "/change-password",
  authMiddleware,
  async (req: RequestWithUser, res, next) => {
    const currentUser = req.user;
    if (!req.body.password) {
      res.status(400).send({
        message: "password_empty",
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
  }
);

router.post(
  "/change-email",
  authMiddleware,
  async (req: RequestWithUser, res, next) => {
    const currentUser = req.user;
    const newEmail = req.body.email?.trim();
    if (!newEmail) {
      if (currentUser.email) {
        res.status(400).send({ message: "email_empty" });
      } else {
        res.status(400).send({ message: "email_empty" });
      }
      return;
    }
    if (!newEmail.includes("@")) {
      res.status(400).send({ message: "invalid_email" });
      return;
    }
    try {
      if (newEmail.toLowerCase() !== SHARED_EMAIL) {
        const userWithSameEmail = await User.findOne({
          where: {
            email: { [Sequelize.Op.iLike]: newEmail.toLowerCase() },
            id: { [Sequelize.Op.ne]: currentUser.id },
          },
        });
        if (userWithSameEmail) {
          res.status(400).send({ message: "email_taken" });
          return;
        }
      }
      await currentUser.update({ email: newEmail, emailConfirmed: false });
      const shortTermJwt = toJWT(
        { userId: currentUser.id, email: newEmail },
        true
      );
      const link = `${clientUrl}/confirm-email?jwt=${shortTermJwt}`;
      sendEmailConfirmationLink(currentUser, link);
      res.send({ email: newEmail });
    } catch (error) {
      next(error);
    }
  }
);

router.post("/generate-link", async (req, res, next) => {
  if (!req.body.name) {
    res.status(400).send({
      message: "field_empty",
    });
  } else {
    try {
      const input = req.body.name;
      const currentUser = await User.findOne({
        where: {
          [Sequelize.Op.or]: [{ name: input }, { email: input }],
        },
      });
      if (!currentUser) {
        res.status(400).send({
          message: "user_not_found",
        });
      } else {
        const shortTermJwt = toJWT({ userId: currentUser.id }, true);
        const link = `${clientUrl}/user?jwt=${shortTermJwt}`;
        if (currentUser.email) {
          try {
            await sendPasswordResetLink(currentUser, link);
            await currentUser.update({ link });
            res.send("Link sent");
          } catch (err) {
            console.error("Failed to send password reset email:", err);
            res.status(500).send({ message: "send_failed" });
          }
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

router.get(
  "/my/finished-games",
  authMiddleware,
  async (req: RequestWithUser, res, next) => {
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
          "turns",
        ],
        include: [
          {
            model: User,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });
      res.send(
        games.map((game) => {
          const { turns, ...rest } = game.toJSON();
          return { ...rest, centerWord: getFirstTurnWord(turns) };
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/my/archived-games",
  authMiddleware,
  async (req: RequestWithUser, res, next) => {
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
          "turns",
        ],
        include: [
          {
            model: User,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });
      const sortedGames = games.sort((_, b) => {
        if (b.activeUserId === currentUser.id) {
          return 1;
        } else {
          return -1;
        }
      });
      res.send(
        sortedGames.map((game) => {
          const { turns, ...rest } = game.toJSON();
          return { ...rest, centerWord: getFirstTurnWord(turns) };
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/confirm-email",
  authMiddleware,
  async (req: RequestWithUser, res, next) => {
    const currentUser = req.user;
    const auth =
      req.headers.authorization && req.headers.authorization.split(" ");
    let data: { email: string };
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
  }
);

router.post(
  "/delete-account",
  authMiddleware,
  async (req: RequestWithUser, res, next) => {
    const currentUser = req.user;
    if (!req.body.password) {
      res.status(400).send({ message: "password_empty" });
      return;
    }
    const passwordCorrect = bcrypt.compareSync(
      req.body.password,
      currentUser.password
    );
    if (!passwordCorrect) {
      res.status(401).send({ message: "wrong_password" });
      return;
    }
    try {
      removePushToken(currentUser.id);
      const userGames = await Game.findAll({
        where: {
          phase: { [Sequelize.Op.not]: "finished" },
          archived: false,
        },
        include: [
          {
            model: User,
            as: "users",
            attributes: ["id"],
            where: { id: currentUser.id },
            required: true,
          },
        ],
        attributes: ["id"],
      });
      const activeGames = await Game.findAll({
        where: { id: userGames.map((g) => g.id) },
        include: [{ model: User, as: "users", attributes: ["id"] }],
      });
      await Promise.all(
        activeGames.map(async (game) => {
          if (game.phase === "waiting" || game.phase === "ready") {
            await game.removeUser(currentUser);
            const remainingCount = game.users.length - 1;
            if (remainingCount === 0) {
              await game.update({ archived: true });
            } else if (
              game.phase === "ready" &&
              remainingCount < game.maxPlayers
            ) {
              await game.update({ phase: "waiting" });
            }
          } else {
            await game.update({ archived: true });
          }
        })
      );
      await Message.update(
        { name: "[deleted]" },
        { where: { UserId: currentUser.id } }
      );
      const randomPassword = bcrypt.hashSync(crypto.randomUUID(), 10);
      await currentUser.update({
        name: `[deleted_${currentUser.id}]`,
        email: null,
        password: randomPassword,
        link: null,
        emailConfirmed: false,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
