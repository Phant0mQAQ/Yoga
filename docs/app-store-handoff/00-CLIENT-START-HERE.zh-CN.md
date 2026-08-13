# Good Vibe Pilates & Yoga 客户上架交接说明

交付日期：2026-07-15

这份交付包用于让客户在没有 Mac 的情况下，使用自己的 Expo 账号、Apple Developer 账号和 App Store Connect 账号完成 EAS 云构建、TestFlight 测试及 App Store 上架。

## 先理解交付边界

- ZIP 包会包含 Expo iOS 源码、API/后台源码、数据库迁移、测试、图标源文件和 App Store 文案模板。
- ZIP 包不会包含 `.env`、Supabase 服务端密钥、Stripe Secret Key、Apple `.p8` 私钥、证书、Provisioning Profile、登录令牌或现有云平台账号密码。
- 源码交付不等于账号和云资源转移。长期独立运营需要持续控制 Cloudflare、Stripe、Expo、Apple Developer、域名和邮箱服务。
- 当前生产 API 地址为 `https://good-vibe-pilates-yoga.2316196563.workers.dev/api/v1`，使用 Cloudflare Worker 与 D1。
- 当前 Expo 项目已绑定 `@yogayoga/good-vibe-pilates-yoga`，EAS Project ID 为 `cf7a295f-471a-4efb-9931-bed4b2236f7d`。

## 目录说明

```text
Good-Vibe-AppStore-Handoff/
  00-READ-ME-FIRST.md
  source/
    apps/mobile-expo/    iOS/Expo 应用，上架操作在这里执行
    apps/api/            Node API
    apps/admin/          Web 管理后台
    db/                  PostgreSQL 结构草案
    supabase/            Supabase 配置和迁移
    docs/                API、部署和本交接资料
    tests/               后端与 Web 自动化测试
  app-store-materials/
    icon/                无透明背景的 App 图标源文件
    screenshots/         截图规格和待放置目录
    metadata/            中英韩商店文案
    legal/               隐私政策与支持页模板
  checksums/             文件校验值
```

## 1. 客户需要准备的账号

1. Apple Developer Program 会员账号。App Store 发布必须使用客户自己的开发者主体。
2. App Store Connect 权限。建议客户账号拥有 `Account Holder` 或 `Admin/App Manager` 权限。
3. Expo 账号。EAS Build 和 EAS Submit 使用该账号。
4. Stripe 账号及可用于 iOS 的 Publishable Key。Stripe Secret Key 只放在 API 服务端。
5. 可公开访问的 HTTPS API、隐私政策 URL 和支持 URL。
6. 四个审核专用账号：Student、Coach、Staff、Admin。账号必须长期有效，且不能要求短信验证码。

## 2. 解压与安装

Windows 建议解压到较短路径，例如：

```powershell
C:\GoodVibeRelease
```

安装 Node.js 20 LTS 或 22 LTS，然后执行：

```powershell
cd C:\GoodVibeRelease\source\apps\mobile-expo
npm ci
npx expo-doctor
npx tsc --noEmit
```

不要运行 `npm audit fix --force`。它可能把 Expo SDK 54 的依赖升级到不兼容版本。

## 3. 绑定客户自己的 Expo 项目

```powershell
cd C:\GoodVibeRelease\source\apps\mobile-expo
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest init
```

选择在客户自己的 Expo 账号下创建新项目。`eas init` 会向 `app.json` 写入新的 `extra.eas.projectId`，不要恢复交付前的旧 ID。

## 4. 确认 Apple 标识符

当前默认值：

```text
Bundle ID: com.goodvibe.pilatesyoga
Apple Pay Merchant ID: merchant.com.goodvibe.pilatesyoga
URL Scheme: goodvibe
```

客户必须确认 Bundle ID 和 Merchant ID 能在自己的 Apple Developer Team 中注册。如果已被其他团队占用，应在第一次生产构建前同时修改：

- `source/apps/mobile-expo/app.json` 中的 `ios.bundleIdentifier`。
- `source/apps/mobile-expo/app.json` 中 Stripe 插件的 `merchantIdentifier`。
- EAS 环境变量 `EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER`。
- Stripe Dashboard 中的 Apple Pay 配置。

Bundle ID 一旦随已上架版本发布，不应再更改。

## 5. 设置 EAS 生产环境变量

在 Expo Dashboard 的 Project settings > Environment variables 中建立 `production` 环境，或执行：

```powershell
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_BASE_URL --value https://good-vibe-pilates-yoga.2316196563.workers.dev/api/v1 --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_live_REPLACE_WITH_CLIENT_KEY --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER --value merchant.com.goodvibe.pilatesyoga --visibility plaintext
npx eas-cli@latest env:list --environment production
```

这些 `EXPO_PUBLIC_*` 值会进入 App 安装包，本来就是客户端可见信息。绝不能放入 `STRIPE_SECRET_KEY`、`SUPABASE_SECRET_KEY`、`APP_SECRET` 或 Apple 私钥。

## 6. 本地发布检查

```powershell
cd C:\GoodVibeRelease\source
npm test
npm run preflight

cd apps\mobile-expo
npx expo-doctor
npx tsc --noEmit
$env:EXPO_PUBLIC_API_BASE_URL="https://good-vibe-pilates-yoga.2316196563.workers.dev/api/v1"
$env:EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_REPLACE_WITH_CLIENT_KEY"
$env:EXPO_PUBLIC_STRIPE_MERCHANT_IDENTIFIER="merchant.com.goodvibe.pilatesyoga"
npx expo export --platform ios --output-dir dist-ios-check
```

`dist-ios-check` 只是验证 JavaScript 能否导出，不是可提交 App Store 的 IPA。

## 7. 创建 App Store Connect 应用记录

在 App Store Connect 新建 App：

- Platforms：iOS。
- Name：Good Vibe Pilates & Yoga。
- Primary Language：可选 English (U.S.)，然后增加简体中文和韩语本地化。
- Bundle ID：必须与 `app.json` 完全一致。
- SKU：客户自定义，例如 `GOODVIBE-IOS-001`。
- User Access：按客户团队权限设置。

填写 `app-store-materials` 中的文案、隐私、审核和截图资料。隐私政策 URL 是必填项。

## 8. 构建并上传 TestFlight

```powershell
cd C:\GoodVibeRelease\source\apps\mobile-expo
npx eas-cli@latest build --platform ios --profile production
```

第一次构建时，EAS 会询问 Apple 登录和证书。建议让 EAS 创建并管理 Distribution Certificate 与 Provisioning Profile。构建成功后：

```powershell
npx eas-cli@latest submit --platform ios --profile production
```

EAS Submit 只负责把构建上传到 App Store Connect，不会自动完成商店文案、截图、隐私问卷或最终送审。

## 9. TestFlight 验收

先添加内部测试员，至少完整测试：

- Student、Coach、Staff、Admin 四种角色登录和退出。
- 登录后不可直接切换角色，退出后才能切换。
- 中英韩切换和 Dark Mode。
- 课程列表、预约、参与者头像、取消和改约。
- 会员卡扣次、冻结、延期、转增和升级。
- Staff 核销。
- Admin 会员、课程、排课、内容、商品、订单、支付、退款和审计日志。
- Stripe PaymentSheet、Apple Pay 和重定向支付返回。
- 相机和相册权限说明。
- API 服务重启后数据仍然存在。

内部测试通过后再建立 External Testing Group。外部 TestFlight 首个版本通常需要 Beta App Review。

## 10. App Store 送审

1. 上传 1 至 10 张真实 iPhone 截图，不能带透明通道。
2. 填写中英韩名称、副标题、描述、关键词和版本说明。
3. 填写支持 URL、隐私政策 URL、版权和联系信息。
4. 完成 App Privacy 问卷，并包含 Stripe 等第三方 SDK 的数据实践。
5. 在 App Review Information 中提供四个可用审核账号和操作说明。
6. 在审核备注中说明 Stripe 用于支付线下消费的瑜伽课程和实体商品，不用于解锁 App 内数字内容。
7. 选择 TestFlight 已验证的构建，处理出口合规问题，然后 Submit for Review。

## 官方资料

- Expo iOS 提交：https://docs.expo.dev/submit/ios/
- Expo EAS 环境变量：https://docs.expo.dev/eas/environment-variables/
- Apple App Review Guidelines：https://developer.apple.com/app-store/review/guidelines/
- Apple App Privacy：https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Apple 截图规格：https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
- Stripe Apple Pay：https://docs.stripe.com/apple-pay?platform=react-native
