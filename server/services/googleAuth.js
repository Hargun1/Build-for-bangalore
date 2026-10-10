const axios = require("axios");
const env = require("../config/env");
const { HttpError } = require("../middleware/errors");

const TOKENINFO = "https://oauth2.googleapis.com/tokeninfo";
const USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";
const VALID_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

/**
 * Verifies a Google credential with Google itself and returns a trusted profile.
 * Accepts either an ID token (JWT from "Sign in with Google") or an OAuth access
 * token (from the implicit flow the login button uses).
 *
 * The audience check is the important part: without it, a token issued to ANY
 * other Google app would be accepted here and let its holder sign in as that user.
 */
async function verifyGoogleCredential(token) {
  if (!env.googleClientId) {
    throw new HttpError(503, "Google sign-in is not configured on this server.");
  }
  if (typeof token !== "string" || token.length < 20) {
    throw new HttpError(400, "Missing Google credential.");
  }

  const isIdToken = token.split(".").length === 3;
  let info;
  try {
    const { data } = await axios.get(TOKENINFO, {
      params: isIdToken ? { id_token: token } : { access_token: token },
      timeout: 8000,
    });
    info = data;
  } catch {
    throw new HttpError(401, "Google could not verify this sign-in. Please try again.");
  }

  const audience = info.aud || info.azp;
  if (audience !== env.googleClientId) {
    throw new HttpError(401, "This Google sign-in was issued for a different app.");
  }
  if (isIdToken && !VALID_ISSUERS.has(info.iss)) {
    throw new HttpError(401, "Unexpected Google token issuer.");
  }
  const emailVerified = info.email_verified === true || info.email_verified === "true";
  if (!info.email || !emailVerified) {
    throw new HttpError(401, "Your Google account email is not verified.");
  }

  let name = info.name;
  let picture = info.picture;
  if (!isIdToken && (!name || !picture)) {
    // Access-token tokeninfo has no name/picture; fetch them (best effort).
    try {
      const { data } = await axios.get(USERINFO, { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 });
      name = name || data.name;
      picture = picture || data.picture;
    } catch {
      /* profile details are optional */
    }
  }

  return {
    googleId: String(info.sub),
    email: String(info.email).toLowerCase(),
    name: name || String(info.email).split("@")[0],
    picture: picture || "",
  };
}

module.exports = { verifyGoogleCredential };
