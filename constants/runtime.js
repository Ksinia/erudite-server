const dotenv = require("dotenv");
// to read the .env file by default
dotenv.config();
// to read env specific variables
dotenv.config({ path: `.env.${process.env.NODE_ENV}`, override: true });
dotenv.config({ path: `.env.${process.env.NODE_ENV}.local`, override: true });

// for links to the games in the emails
const clientUrl = process.env.CLIENT_URL;
// for CORS in socket.io
const originUrls = process.env.ORIGIN_URLS.replace(/ /g, "").split(",");
const serverPort = process.env.PORT || 4000;
const sendgridApiKey = process.env.SENDGRID_API_KEY;
const email = "noreply@ksinia.net";
module.exports = { clientUrl, serverPort, originUrls, sendgridApiKey, email };
