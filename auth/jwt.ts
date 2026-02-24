import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const secret = process.env.JWT_SECRET;

export function toJWT(data, shortTerm = false) {
  const expiresIn = shortTerm ? "1h" : "1w";
  return jwt.sign(data, secret, { expiresIn });
}

export function toData(token) {
  return jwt.verify(token, secret);
}
