# 客户必须填写的值

不要把完成后的表格连同真实密钥发到公开聊天或提交到 Git。

| 项目 | 当前默认/状态 | 客户最终值 | 放置位置 |
| --- | --- | --- | --- |
| Apple Developer 法律主体 | 未提供 | `[填写]` | Apple Developer |
| Apple Team ID | 未提供 | `[填写]` | EAS Credentials |
| Expo 用户名/组织 | 交付版已解绑 | `[填写]` | `eas init` |
| EAS Project ID | 交付版已移除 | 由 `eas init` 生成 | `app.json` |
| App 名称 | Good Vibe Pilates & Yoga | `[确认]` | `app.json` / App Store Connect |
| Bundle ID | `com.yomiyoga.studio` | `[确认可注册或修改]` | `app.json` / Apple |
| Apple Pay Merchant ID | `merchant.com.yomiyoga.studio` | `[确认可注册或修改]` | `app.json` / Apple / Stripe |
| URL Scheme | `yomiyoga` | `[确认]` | `app.json` |
| 生产 API URL | 当前为 Render URL | `[填写客户控制的 HTTPS URL]` | EAS production env |
| Stripe Publishable Key | 未打包 | `pk_live_...` | EAS production env |
| Stripe Secret Key | 未打包 | `sk_live_...` | 仅 API 服务端 |
| Stripe Webhook Secret | 未打包 | `whsec_...` | 仅 API 服务端 |
| Supabase URL | 未打包真实值 | `[填写]` | 仅 API 服务端 |
| Supabase Secret Key | 未打包 | `[填写]` | 仅 API 服务端 |
| App Store Connect Apple ID | 未创建/未提供 | `[填写数字 ID]` | EAS Submit 可选 |
| App Store SKU | 未提供 | 例如 `GOODVIBE-IOS-001` | App Store Connect |
| 隐私政策 URL | 缺失 | `[必须是公开 HTTPS URL]` | App Store Connect |
| 支持 URL | 缺失 | `[公开 HTTPS URL]` | App Store Connect |
| 市场网站 URL | 可选 | `[填写]` | App Store Connect |
| 审核联系人姓名 | 未提供 | `[填写]` | App Review Information |
| 审核联系人邮箱/电话 | 未提供 | `[填写]` | App Review Information |
| Student 审核账号 | 未提供 | `[填写]` | App Review Information |
| Coach 审核账号 | 未提供 | `[填写]` | App Review Information |
| Staff 审核账号 | 未提供 | `[填写]` | App Review Information |
| Admin 审核账号 | 未提供 | `[填写]` | App Review Information |

## 不应出现在 Expo 客户端的值

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_SECRET`
- App Store Connect `.p8` 私钥内容
- Apple 账号密码或 App-specific password
