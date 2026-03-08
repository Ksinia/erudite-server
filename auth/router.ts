import { Router } from "express";
import { toJWT } from "./jwt.js";
import User from "../models/user.js";
import { Sequelize } from "../models/index.js";
import bcrypt from "bcrypt";
import authMiddleware from "./middleware.js";
import { LOGIN_SUCCESS } from "../constants/outgoingMessageTypes.js";
import { RequestWithUser } from "../routers/game";
import {
  generateRefreshToken,
  refreshAccessToken,
} from "../services/refreshToken.js";

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
        const jwt = toJWT({ userId: currentUser.id });
        const refreshToken = await generateRefreshToken(currentUser.id);
        const action = {
          type: LOGIN_SUCCESS,
          payload: {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email || "",
            jwt,
            refreshToken,
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

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).send({ message: "refresh_token_required" });
    return;
  }
  try {
    const result = await refreshAccessToken(refreshToken);
    if (!result) {
      res.status(401).send({ message: "invalid_refresh_token" });
      return;
    }
    const user = await User.findByPk(result.userId);
    if (!user) {
      res.status(401).send({ message: "user_not_found" });
      return;
    }
    const action = {
      type: LOGIN_SUCCESS,
      payload: {
        id: user.id,
        name: user.name,
        email: user.email || "",
        jwt: result.jwt,
        refreshToken: result.refreshToken,
        authMethod: user.appleId ? "apple" : "password",
      },
    };
    res.send(JSON.stringify(action));
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(500).send({ message: "internal_error" });
  }
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
