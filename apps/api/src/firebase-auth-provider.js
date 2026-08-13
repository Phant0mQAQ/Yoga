const IDENTITY_TOOLKIT_BASE_URL = "https://identitytoolkit.googleapis.com/v1";
const SECURE_TOKEN_BASE_URL = "https://securetoken.googleapis.com/v1";

export function createFirebaseAuthProvider({
  apiKey = globalThis.__GOOD_VIBE_FIREBASE_WEB_API_KEY__ ?? process.env.FIREBASE_WEB_API_KEY,
  fetchImpl = globalThis.fetch,
  requestTimeoutMs = process.env.FIREBASE_REQUEST_TIMEOUT_MS ?? 10000
} = {}) {
  const normalizedApiKey = String(apiKey ?? "").trim();
  const normalizedRequestTimeoutMs = normalizeRequestTimeout(requestTimeoutMs);
  const enabled = Boolean(normalizedApiKey && typeof fetchImpl === "function");

  async function fetchFirebase(url, options) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(firebaseProblem(504, "firebase_auth_timeout", "Firebase Authentication timed out"));
      }, normalizedRequestTimeoutMs);
    });

    try {
      return await Promise.race([
        fetchImpl(url, { ...options, signal: controller.signal }),
        timeout
      ]);
    } catch (error) {
      if (error?.code === "firebase_auth_timeout") throw error;
      throw firebaseProblem(502, "firebase_auth_unavailable", "Unable to reach Firebase Authentication");
    } finally {
      clearTimeout(timer);
    }
  }

  async function request(path, body, locale) {
    if (!enabled) {
      throw firebaseProblem(503, "firebase_auth_not_configured", "Firebase Authentication is not configured");
    }

    const response = await fetchFirebase(
      `${IDENTITY_TOOLKIT_BASE_URL}/${path}?key=${encodeURIComponent(normalizedApiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(locale ? { "X-Firebase-Locale": firebaseLocale(locale) } : {})
        },
        body: JSON.stringify(body)
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw mapFirebaseError(payload, response.status);
    return payload;
  }

  async function refresh(refreshToken) {
    if (!enabled) {
      throw firebaseProblem(503, "firebase_auth_not_configured", "Firebase Authentication is not configured");
    }
    const response = await fetchFirebase(
      `${SECURE_TOKEN_BASE_URL}/token?key=${encodeURIComponent(normalizedApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }).toString()
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.id_token) throw mapFirebaseError(payload, response.status);
    return {
      uid: payload.user_id,
      idToken: payload.id_token,
      refreshToken: payload.refresh_token,
      expiresIn: Number(payload.expires_in ?? 3600)
    };
  }

  return {
    provider: "firebase",
    enabled,

    async signUp({ email, password, locale }) {
      const result = await request("accounts:signUp", {
        email,
        password,
        returnSecureToken: true
      }, locale);
      assertCredentialResponse(result);
      return credentialResult(result);
    },

    async signIn({ email, password, locale }) {
      const result = await request("accounts:signInWithPassword", {
        email,
        password,
        returnSecureToken: true
      }, locale);
      assertCredentialResponse(result);
      const account = await request("accounts:lookup", { idToken: result.idToken }, locale);
      const user = account.users?.[0];
      if (!user?.localId || !user.email) {
        throw firebaseProblem(502, "firebase_auth_invalid_response", "Firebase returned an invalid account response");
      }
      return {
        ...credentialResult(result),
        email: String(user.email).trim().toLowerCase(),
        emailVerified: user.emailVerified === true,
        disabled: user.disabled === true
      };
    },

    async sendEmailVerification({ idToken, locale }) {
      return request("accounts:sendOobCode", {
        requestType: "VERIFY_EMAIL",
        idToken
      }, locale);
    },

    async deleteCurrentUser({ idToken }) {
      return request("accounts:delete", { idToken });
    },

    async refreshSession({ refreshToken }) {
      if (!String(refreshToken ?? "").trim()) {
        throw firebaseProblem(401, "firebase_session_expired", "Firebase authentication has expired");
      }
      return refresh(String(refreshToken).trim());
    }
  };
}

function normalizeRequestTimeout(value) {
  const timeout = Number(value);
  if (!Number.isFinite(timeout) || timeout <= 0) return 10000;
  return Math.max(100, Math.min(timeout, 30000));
}

function credentialResult(result) {
  return {
    uid: result.localId,
    email: String(result.email ?? "").trim().toLowerCase(),
    idToken: result.idToken,
    refreshToken: result.refreshToken,
    expiresIn: Number(result.expiresIn ?? 3600)
  };
}

function assertCredentialResponse(result) {
  if (!result?.localId || !result?.idToken || !result?.refreshToken) {
    throw firebaseProblem(502, "firebase_auth_invalid_response", "Firebase returned an invalid authentication response");
  }
}

function firebaseLocale(locale) {
  if (locale === "zh-Hans") return "zh-CN";
  if (locale === "ko") return "ko";
  return "en";
}

function mapFirebaseError(payload, upstreamStatus) {
  const rawCode = String(payload?.error?.message ?? "").split(" : ")[0];
  const mapped = {
    EMAIL_EXISTS: [409, "email_already_in_use", "This email is already registered"],
    EMAIL_NOT_FOUND: [401, "invalid_credentials", "Email or password is incorrect"],
    INVALID_LOGIN_CREDENTIALS: [401, "invalid_credentials", "Email or password is incorrect"],
    INVALID_PASSWORD: [401, "invalid_credentials", "Email or password is incorrect"],
    INVALID_EMAIL: [400, "invalid_email", "Enter a valid email address"],
    MISSING_EMAIL: [400, "invalid_email", "Enter a valid email address"],
    MISSING_PASSWORD: [400, "invalid_login_request", "Email and password are required"],
    WEAK_PASSWORD: [400, "weak_password", "Password does not meet Firebase requirements"],
    OPERATION_NOT_ALLOWED: [503, "firebase_password_auth_disabled", "Email/password sign-in is disabled in Firebase"],
    USER_DISABLED: [403, "account_disabled", "This account has been disabled"],
    TOO_MANY_ATTEMPTS_TRY_LATER: [429, "too_many_auth_attempts", "Too many attempts. Try again later"],
    QUOTA_EXCEEDED: [429, "firebase_auth_quota_exceeded", "Authentication email quota has been exceeded"],
    INVALID_ID_TOKEN: [401, "firebase_session_expired", "Firebase authentication has expired"],
    INVALID_REFRESH_TOKEN: [401, "firebase_session_expired", "Firebase authentication has expired"],
    TOKEN_EXPIRED: [401, "firebase_session_expired", "Firebase authentication has expired"],
    USER_NOT_FOUND: [401, "invalid_credentials", "Email or password is incorrect"]
  }[rawCode];

  if (mapped) return firebaseProblem(...mapped);
  const status = upstreamStatus >= 500 ? 502 : 400;
  const error = firebaseProblem(status, "firebase_auth_failed", "Firebase Authentication rejected the request");
  error.details = { provider: "firebase", upstreamStatus, upstreamCode: rawCode || undefined };
  return error;
}

function firebaseProblem(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
