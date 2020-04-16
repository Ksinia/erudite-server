const jwt = require("jsonwebtoken");

const secret =
  process.env.JWT_SECRET || "e9rp^&^*&@9sejg)DSUA)jpfds8394jdsfn,m";

function toJWT(data, shortTerm = false) {
  const expiresIn = shortTerm ? "1h" : "1w";
  return jwt.sign(data, secret, { expiresIn });
}

function toData(token) {
  return jwt.verify(token, secret);
}

module.exports = { toJWT, toData };
