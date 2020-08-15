const { Router } = require("express");
const { User, Game, Sequelize } = require("../models");
const bcrypt = require("bcrypt");
const { login } = require("../auth/router");
const authMiddleware = require("../auth/middleware");
const { toJWT } = require("../auth/jwt");

const router = new Router();

router.post("/signup", async (req, res, next) => {
  if (!req.body.password) {
    res.status(400).send({
      message: "Password should not be empty",
    });
    return;
  }
  let userWithSameName = null;
  try {
    userWithSameName = await User.findOne({
      where: { name: req.body.name },
    });
  } catch (error) {
    next(error);
  }
  if (userWithSameName) {
    res.status(400).send({ message: "This name is already in use" });
  } else {
    const userData = {
      name: req.body.name,
      password: bcrypt.hashSync(req.body.password, 10),
    };
    try {
      const newUser = await User.create(userData);
      login(res, next, newUser.name, req.body.password);
    } catch (error) {
      if (error.name === "SequelizeValidationError") {
        console.log("Error errors[0] type:", typeof error.errors[0]);
        console.log("errors[0] class name:", error.errors[0].constructor.name);
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
    return;
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
    return;
  } else {
    try {
      const currentUser = await User.findOne({
        where: { name: req.body.name },
      });
      if (!currentUser) {
        res.status(400).send({
          message: "User with that name does not exist",
        });
        return;
      } else {
        const shortTermJwt = toJWT({ userId: currentUser.id }, true);
        const baseUrl = process.env.CLIENT_URL || "http://localhost:3000";
        const link = `${baseUrl}/user?jwt=${shortTermJwt}`;
        // TODO: send link by email
        await currentUser.update({ link });
        res.send("Link generated");
      }
    } catch (error) {
      next(error);
    }
  }
});

router.get("/my/finished-games", authMiddleware, async (req, res, next) => {
  const currentUser = req.user;
  try {
    const gameIds = await Game.findAll({
      order: [["updatedAt", "DESC"]],
      where: {
        phase: "finished",
      },
      attributes: ["id"],
      raw: true,
      include: [
        {
          model: User,
          as: "users",
          attributes: ["id"],
          raw: true,

          where: {
            id: {
              [Sequelize.Op.eq]: currentUser.id,
            },
          },
        },
      ],
    });
    res.send(gameIds.map((obj) => obj.id));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
