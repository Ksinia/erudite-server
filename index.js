const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const signupRouter = require("./routers/user");
const { router: loginRouter } = require("./auth/router");

const app = express();
const port = process.env.PORT || 4000;

const bodyParserMiddleware = bodyParser.json();
const corsMiddleware = cors();

app.use(corsMiddleware);
app.use(bodyParserMiddleware);

app.use(signupRouter);
app.use(loginRouter);

app.listen(port, () => console.log(`Listening on port: ${port}`));
