const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
require("dotenv").config();

const app = express();

// IMPORTANT: allow cookies from React (origin 3000)
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Config
const PORT = process.env.PORT || 5000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev_secret_change_me";

const GOOGLE_OAUTH_URL =
  process.env.GOOGLE_OAUTH_URL ||
  "https://accounts.google.com/o/oauth2/v2/auth";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_ACCESS_TOKEN_URL =
  process.env.GOOGLE_ACCESS_TOKEN_URL || "https://oauth2.googleapis.com/token";

const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  `http://localhost:${PORT}/google/callback`;

const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

app.listen(PORT,(req,res)=>{
  console.log(`server started at port ${PORT}`);

});
app.get("/auth/google", (req, res) => {
  const state = "some_state"; // TODO: random & store if you want CSRF protection

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    access_type: "offline",
    response_type: "code",
    state,
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    prompt: "consent",
  });

  const consentUrl = `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  return res.redirect(consentUrl);
});
app.get("/google/callback", async (req, res) => {
  try {
    console.log("entered") ;
    const { code, error } = req.query;

    if (error) {
      return res.status(400).send(`Google OAuth Error: ${error}`);
    }

    if (!code) {
      return res.status(400).send("Missing 'code' in query params");
    }
    console.log(code) ;

    // 1) Exchange code for tokens
    const tokenParams = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_CALLBACK_URL,
      grant_type: "authorization_code",
    });

    const tokenResponse = await fetch(GOOGLE_ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error("Token error:", tokenData);
      return res
        .status(500)
        .json({ error: "Failed to fetch tokens", details: tokenData });
    }

    const accessToken = tokenData.access_token;

    // 2) Get user info
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const userInfo = await userInfoRes.json();

    // 3) Create JWT with minimal user info
    const payload = {
      sub: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
    };

    const jwtToken = jwt.sign(payload, SESSION_SECRET, { expiresIn: "7d" });

    // 4) Set HTTP-only cookie
    res.cookie("auth_token", jwtToken, {
      httpOnly: true,
      secure: false, // true in production with HTTPS
      sameSite: "lax",
    });

    // 5) Redirect to React app
    return res.redirect("http://localhost:3000/dashboard");
  } catch (err) {
    console.error("Error in /google/callback:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

function authMiddleware(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, SESSION_SECRET);
    req.user = decoded; // { sub, email, name, picture }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.post("/logout", (req, res) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: false,   // set true in production (HTTPS)
    sameSite: "lax",
  });

  return res.json({ message: "Logged out successfully" });
});

