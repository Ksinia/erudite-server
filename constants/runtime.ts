import dotenv from "dotenv";
// to read the .env file by default
dotenv.config();
// to read env specific variables
dotenv.config({ path: `.env.${process.env.NODE_ENV}`, override: true });
dotenv.config({ path: `.env.${process.env.NODE_ENV}.local`, override: true });

// for links to the games in the emails
export const clientUrl = process.env.CLIENT_URL;
// for CORS in socket.io
export const originUrls = process.env.ORIGIN_URLS.replace(/ /g, "").split(",");
export const serverPort = parseInt(process.env.PORT) || 4000;
export const resendApiKey = process.env.RESEND_API_KEY;
export const fromEmail = "Erudite <noreply@ksinia.net>";
