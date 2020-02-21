const { Router } = require("express");
const { toJWT } = require("./jwt");
const { User, Melody, Dictation, Sequelize } = require("../models");
const bcrypt = require("bcrypt");
const authMiddleware = require("../auth/middleware");

async function login(res, next, name = null, password = null) {
  if (!name || !password) {
    res.status(400).send({
      message: "Please supply a valid name and password"
    });
  } else {
    try {
      const user = await User.findOne({
        where: { name: name },
        group: ["User.id", "Melodies.id"],
        include: {
          model: Melody,
          attributes: {
            include: [
              [
                Sequelize.fn("COUNT", Sequelize.col("Melodies.Dictations.id")),
                "dictationsCount"
              ]
            ]
          },
          include: [
            {
              model: Dictation,
              attributes: []
            }
          ]
        }
      });
      if (!user) {
        res.status(400).send({
          message: "User with that name does not exist"
        });
      }
      // 2. use bcrypt.compareSync to check the password against the stored hash
      else if (bcrypt.compareSync(password, user.password)) {
        // 3. if the password is correct, return a JWT with the userId of the user (user.id)
        const jwt = toJWT({ userId: user.id });
        const action = {
          type: "LOGIN_SUCCESS",
          payload: {
            id: user.id,
            name: user.name,
            jwt: jwt,
            melodies: user.Melodies
          }
        };
        const string = JSON.stringify(action);
        res.send(string);
      } else {
        res.status(400).send({
          message: "Password was incorrect"
        });
      }
    } catch (err) {
      next(err);
    }
  }
}

const router = new Router();

router.post("/login", (req, res, next) => {
  const name = req.body.name;
  const password = req.body.password;
  login(res, next, name, password);
});

router.get(
  "/profile", //is it ok to have this url without user id?
  authMiddleware,
  async (req, res, next) => {
    const userId = req.user.id;
    const jwt = req.headers.authorization.split(" ")[1];
    try {
      // I need to get user again, because I need to include all the user's information
      const user = await User.findByPk(userId, {
        group: ["User.id", "Melodies.id"],
        include: {
          model: Melody,
          attributes: {
            include: [
              [
                Sequelize.fn("COUNT", Sequelize.col("Melodies.Dictations.id")),
                "dictationsCount"
              ]
            ]
          },
          include: [
            {
              model: Dictation,
              attributes: []
            }
          ]
        }
      });
      if (!user) {
        res.status(400).send({
          message: "Invalid token"
        });
      } else {
        const action = {
          type: "LOGIN_SUCCESS",
          payload: {
            id: user.id,
            name: user.name,
            jwt: jwt,
            melodies: user.Melodies
          }
        };
        const string = JSON.stringify(action);
        res.send(string);
      }
    } catch (error) {
      next(error);
    }
  }
);

module.exports = { router, login };
