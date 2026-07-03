import User from "../models/user.js";
import { toData } from "./jwt.js";

/**
 * Extracts the token from an "Authorization: Bearer <token>" header,
 * or null when it is missing or malformed
 */
export function getBearerToken(req): string | null {
  const parts =
    req.headers.authorization && req.headers.authorization.split(" ");
  if (parts && parts[0] === "Bearer" && parts[1]) {
    return parts[1];
  }
  return null;
}

export default function auth(req, res, next) {
  const token = getBearerToken(req);
  if (token) {
    try {
      const data = toData(token);
      User.findByPk(data.userId)
        .then((user) => {
          if (!user) {
            res.status(401).send({
              message: "User does not exist",
            });
          } else {
            req.user = user;
            next();
          }
        })
        .catch(next);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        res.status(401).send({ message: "token_expired" });
      } else {
        res.status(400).send({
          message: `Error ${error.name}: ${error.message}`,
        });
      }
    }
  } else {
    res.status(401).send({
      message: "Please login",
    });
  }
}
