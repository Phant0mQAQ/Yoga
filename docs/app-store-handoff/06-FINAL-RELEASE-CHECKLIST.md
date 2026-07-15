# 最终发布检查表

## 代码与构建

- [ ] `npm ci` 成功。
- [ ] `npm test` 成功。
- [ ] `npm run preflight` 成功。
- [ ] `npx expo-doctor` 无错误。
- [ ] `npx tsc --noEmit` 无错误。
- [ ] iOS export 检查成功。
- [ ] EAS production build 成功。
- [ ] Bundle ID 属于客户 Apple Team。
- [ ] App 图标无透明通道。
- [ ] 生产构建不预填演示邮箱或密码。

## 云端与安全

- [ ] API 使用 HTTPS 且 24 小时可用。
- [ ] `/health` 返回 `ok: true` 和 `database: supabase`。
- [ ] 客户控制 Supabase、Render、Vercel、Stripe 和域名。
- [ ] Render 使用生产环境，已移除公开 Demo 登录。
- [ ] Stripe 使用客户账号，Webhook 已验证。
- [ ] Expo/EAS 中只存客户端公开变量。
- [ ] ZIP、Git 和 Expo 客户端中没有服务端密钥或 Apple 私钥。

## 品牌上线

- [ ] App Store Connect 显示名称已改为 `Good Vibe Pilates & Yoga`，图标和截图均为新版。
- [ ] Stripe Dashboard 的商户公开名称、Checkout/收据 Logo 和品牌色已改为 Good Vibe。
- [ ] Vercel 管理端域名、邮件模板、隐私政策和支持页面不再显示旧品牌。
- [ ] 保留 Bundle ID、EAS Project ID、URL Scheme、Merchant ID、Render URL 与 Supabase 表名，除非已安排完整迁移。

## TestFlight

- [ ] 四种角色均可登录、退出和重新选择角色。
- [ ] 中英韩及 Dark Mode 正常。
- [ ] 预约、参与者头像、取消、改约和核销正常。
- [ ] 会员卡与 Admin 高风险操作正常且有审计日志。
- [ ] Stripe/Apple Pay 测试完成。
- [ ] 相机和相册权限仅在需要时请求。
- [ ] 无崩溃、无限加载、未处理 Promise 或 401 循环。

## App Store Connect

- [ ] 客户主体协议、税务和银行资料已处理。
- [ ] 中英韩商店文案已复核。
- [ ] 当前 iPhone 截图已上传。
- [ ] 隐私政策和支持 URL 可公开访问。
- [ ] App Privacy 包含第三方 SDK 的实际数据处理。
- [ ] 四个审核账号有效且不需要 OTP。
- [ ] 审核备注说明角色入口、测试路径和线下服务支付模式。
- [ ] 选择已通过内部 TestFlight 验收的构建。
- [ ] 出口合规回答与 `ITSAppUsesNonExemptEncryption=false` 一致。
