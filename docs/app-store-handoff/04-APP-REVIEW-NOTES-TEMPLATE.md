# App Review Information 模板

提交前将所有方括号内容替换为真实值。不要把审核密码提交到 Git。

## Contact Information

```text
First name: [REVIEW CONTACT FIRST NAME]
Last name: [REVIEW CONTACT LAST NAME]
Phone: [PHONE WITH COUNTRY CODE]
Email: [MONITORED EMAIL]
```

## Demo accounts

```text
Student
Email: [STUDENT REVIEW EMAIL]
Password: [PASSWORD]

Coach
Email: [COACH REVIEW EMAIL]
Password: [PASSWORD]

Staff
Email: [STAFF REVIEW EMAIL]
Password: [PASSWORD]

Admin
Email: [ADMIN REVIEW EMAIL]
Password: [PASSWORD]
```

所有账号应满足：

- 审核期间始终有效。
- 不要求 OTP、短信验证码、VPN 或特定地区网络。
- Student 账号预置可用会员卡和预约数据，方便无真实扣款完成流程。
- Admin 账号只放测试数据，不包含真实客户资料。

## Suggested review notes (English)

```text
Good Vibe Pilates & Yoga is a role-based Pilates and yoga studio booking and operations app.

1. Select Student or Coach on the first screen. Staff and Admin access is available under "Studio Operations".
2. A role is locked for the current session. To test another role, use the logout button and sign in again with the corresponding review account.
3. The Student account includes a test membership card so reviewers can book a class without making a real payment.
4. Camera access is used only by authorized Staff users to scan booking check-in QR codes. Photo library access is used only by Admin users to upload coach, content, and product images.
5. Apple Pay is not integrated or offered as an in-app payment method in this version. The PassKit framework is included transitively by the third-party Stripe React Native SDK. The app currently offers card and PayPal checkout for eligible in-person classes and physical goods/services.
6. Stripe payments are only for goods and services consumed outside the app. The app does not sell digital content or unlock in-app digital functionality through Stripe.
7. The app supports English, Simplified Chinese, and Korean. Light and dark appearance controls are available on the login screen and main screens.

Suggested Student test path:
- Sign in with the Student account.
- Open the schedule and select a class.
- Review available capacity and participant avatars.
- Book using the preloaded membership card.
- Open My Bookings to view or cancel the eligible booking.

Suggested Admin test path:
- Log out, open Studio Operations, select Admin, and sign in.
- Review Dashboard, Members, Schedule, Content, Commerce, and Settings.
- High-risk actions require confirmation and are written to the audit log.

API status page: https://good-vibe-pilates-yoga.2316196563.workers.dev/health
Support: https://good-vibe-pilates-yoga.2316196563.workers.dev/support
```

Apple 当前审核规则明确：对 App 外消费的实体商品或服务，应使用 Apple Pay 或银行卡等非 IAP 支付。Good Vibe Pilates & Yoga 的 Stripe 支付说明必须始终与实际业务一致。

官方规则：https://developer.apple.com/app-store/review/guidelines/#goods-and-services-outside-of-the-app
