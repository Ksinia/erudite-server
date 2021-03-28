// for links to the games in the emails
const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
// for CORS in socket.io
let originUrls = [clientUrl];
if (process.env.ORIGIN_URLS) {
  originUrls = process.env.ORIGIN_URLS.replace(/ /g, "").split(",");
}
const serverPort = process.env.PORT || 4000;
module.exports = { clientUrl, serverPort, originUrls };
