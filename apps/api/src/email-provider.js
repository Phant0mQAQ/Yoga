const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function createEmailProvider({
  apiKey = globalThis.__GOOD_VIBE_RESEND_API_KEY__ ?? process.env.RESEND_API_KEY,
  from = process.env.AUTH_EMAIL_FROM,
  deliveryMode = process.env.EMAIL_DELIVERY_MODE,
  nodeEnv = process.env.NODE_ENV,
  fetchImpl = globalThis.fetch
} = {}) {
  const consoleMode = deliveryMode === "console" && nodeEnv !== "production";
  const enabled = consoleMode || Boolean(apiKey?.trim() && from?.trim() && typeof fetchImpl === "function");

  return {
    provider: consoleMode ? "console" : "resend",
    enabled,
    async sendVerification({ to, code, locale = "en" }) {
      if (!enabled) throw emailProblem(503, "email_service_not_configured", "Email delivery is not configured");
      if (consoleMode) {
        console.log(`[email-verification] ${to} code=${code}`);
        return { id: "console-delivery" };
      }

      const copy = verificationCopy(locale, code);
      let response;
      try {
        response = await fetchImpl(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from,
            to: [to],
            subject: copy.subject,
            text: copy.text,
            html: copy.html
          })
        });
      } catch {
        throw emailProblem(502, "email_delivery_failed", "Unable to reach the email provider");
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.id) {
        const error = emailProblem(502, "email_delivery_failed", "Email provider rejected the message");
        error.details = { provider: "resend", status: response.status };
        throw error;
      }
      return { id: payload.id };
    }
  };
}

function verificationCopy(locale, code) {
  if (locale === "zh-Hans") {
    return {
      subject: "Good Vibe 邮箱验证码",
      text: `你的 Good Vibe 验证码是 ${code}。验证码 10 分钟内有效。请勿向任何人透露。`,
      html: verificationHtml("邮箱验证码", "请输入以下验证码完成 Good Vibe 注册：", code, "验证码 10 分钟内有效，请勿向任何人透露。")
    };
  }
  if (locale === "ko") {
    return {
      subject: "Good Vibe 이메일 인증 코드",
      text: `Good Vibe 인증 코드는 ${code}입니다. 코드는 10분 동안 유효합니다. 다른 사람에게 공유하지 마세요.`,
      html: verificationHtml("이메일 인증", "Good Vibe 가입을 완료하려면 다음 코드를 입력하세요:", code, "이 코드는 10분 동안 유효합니다. 다른 사람에게 공유하지 마세요.")
    };
  }
  return {
    subject: "Your Good Vibe verification code",
    text: `Your Good Vibe verification code is ${code}. It expires in 10 minutes. Do not share it with anyone.`,
    html: verificationHtml("Verify your email", "Enter this code to finish creating your Good Vibe account:", code, "This code expires in 10 minutes. Do not share it with anyone.")
  };
}

function verificationHtml(title, intro, code, note) {
  return `<!doctype html><html><body style="margin:0;background:#f7f4ec;font-family:Arial,sans-serif;color:#183124"><div style="max-width:520px;margin:0 auto;padding:40px 20px"><div style="background:#fffdf8;border:1px solid #d7dcd5;border-radius:16px;padding:32px"><p style="color:#e76553;font-weight:700;letter-spacing:1px">GOOD VIBE PILATES &amp; YOGA</p><h1 style="font-size:26px">${title}</h1><p>${intro}</p><p style="font-size:34px;font-weight:800;letter-spacing:8px;margin:28px 0">${code}</p><p style="color:#68736b;font-size:14px">${note}</p></div></div></body></html>`;
}

function emailProblem(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
