const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");

admin.initializeApp();

function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

exports.kakaoLogin = onRequest(
  {
    region: "asia-northeast3",
    cors: false,
  },
  async (req, res) => {
    setCors(res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const { code, redirectUri } = req.body || {};

      if (!code || !redirectUri) {
        res.status(400).json({ error: "code and redirectUri are required" });
        return;
      }

      const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;
      const kakaoClientSecret = process.env.KAKAO_CLIENT_SECRET || "";

      if (!kakaoRestApiKey) {
        res.status(500).json({ error: "KAKAO_REST_API_KEY is missing" });
        return;
      }

      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: kakaoRestApiKey,
        redirect_uri: redirectUri,
        code,
      });

      if (kakaoClientSecret) {
        tokenParams.set("client_secret", kakaoClientSecret);
      }

      const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body: tokenParams.toString(),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.access_token) {
        res.status(401).json({
          error: "Failed to exchange kakao token",
          detail: tokenData,
        });
        return;
      }

      const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
      });

      const userData = await userResponse.json();

      if (!userResponse.ok || !userData.id) {
        res.status(401).json({
          error: "Failed to fetch kakao user profile",
          detail: userData,
        });
        return;
      }

      const uid = `kakao:${userData.id}`;
      const email = userData.kakao_account?.email || undefined;
      const nickname = userData.properties?.nickname || "Kakao User";

      try {
        await admin.auth().getUser(uid);
      } catch {
        await admin.auth().createUser({
          uid,
          displayName: nickname,
          email,
        });
      }

      const customToken = await admin.auth().createCustomToken(uid, {
        provider: "kakao",
        kakaoId: String(userData.id),
      });

      res.status(200).json({
        customToken,
        uid,
        profile: {
          nickname,
          email: email || "",
        },
      });
    } catch (error) {
      console.error("kakaoLogin error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: error.message || "unknown",
      });
    }
  }
);