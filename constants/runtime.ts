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

/**
 * An entry may be a full origin or a pattern with one * standing for a
 * single subdomain label, which is how a host names its branch and preview
 * deployments: https://*--erudit.netlify.app covers every branch of that
 * site without opening the API to the web at large.
 */
const originMatchers = originUrls.filter(Boolean).map((entry) => {
  if (!entry.includes("*")) {
    return (origin: string) => origin === entry;
  }
  const pattern = new RegExp(
    "^" +
      entry
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^./]+") +
      "$"
  );
  return (origin: string) => pattern.test(origin);
});

export const isAllowedOrigin = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void => {
  // a request without an Origin header is not a browser cross-origin call
  if (!origin || originMatchers.some((matches) => matches(origin))) {
    callback(null, true);
    return;
  }
  callback(null, false);
};
export const serverPort = parseInt(process.env.PORT) || 4000;
export const resendApiKey = process.env.RESEND_API_KEY;
export const fromEmail = "Erudite <noreply@ksinia.net>";
