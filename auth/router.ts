import { Router } from "express";
import { toJWT } from "./jwt.js";
import User from "../models/user.js";
import { Sequelize } from "../models/index.js";
import bcrypt from "bcrypt";
import authMiddleware from "./middleware.js";
import { LOGIN_SUCCESS } from "../constants/outgoingMessageTypes.js";
import { RequestWithUser } from "../routers/game";

export async function login(res, next, name = null, password = null) {
  if (!name || !password) {
    res.status(400).send({
      message: "login_fields_empty",
    });
  } else {
    try {
      const input = name.toLowerCase();
      const currentUser = await User.findOne({
        where: {
          [Sequelize.Op.or]: [
            { name: { [Sequelize.Op.iLike]: input } },
            { email: { [Sequelize.Op.iLike]: input } },
          ],
        },
      });
      if (!currentUser) {
        res.status(400).send({
          message: "user_not_found",
        });
      }
      // 2. use bcrypt.compareSync to check the password against the stored hash
      else if (bcrypt.compareSync(password, currentUser.password)) {
        // 3. if the password is correct, return a JWT with the userId of the user (user.id)
        const jwt = toJWT({ userId: currentUser.id });
        const action = {
          type: LOGIN_SUCCESS,
          payload: {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email || "",
            jwt: jwt,
            authMethod: currentUser.appleId ? "apple" : "password",
          },
        };
        const string = JSON.stringify(action);
        res.send(string);
      } else {
        res.status(400).send({
          message: "wrong_password",
        });
      }
    } catch (err) {
      next(err);
    }
  }
}

export const router = Router();

router.post("/login", (req, res, next) => {
  const name = req.body.name?.trim();
  const password = req.body.password;
  login(res, next, name, password);
});

router.get("/profile", authMiddleware, async (req: RequestWithUser, res) => {
  const currentUser = req.user;
  const jwt = req.headers.authorization.split(" ")[1];
  const action = {
    type: LOGIN_SUCCESS,
    payload: {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email || "",
      jwt: jwt,
      authMethod: currentUser.appleId ? "apple" : "password",
    },
  };
  const string = JSON.stringify(action);
  res.send(string);
});
