# App Privacy 数据清单草案

此文件用于协助客户填写 App Store Connect 的 App Privacy 问卷，不是法律意见。客户必须按最终生产版本、服务器日志、Stripe 设置、通知服务和其他第三方服务复核。

## 建议申报的数据类型

| Apple 数据类别 | 本项目可能涉及的数据 | 是否与身份关联 | 主要用途 |
| --- | --- | --- | --- |
| Contact Info | 姓名、邮箱、可选手机号 | 是 | 账号认证、会员与客户支持 |
| Identifiers | 内部 User ID、Session ID | 是 | 账号、权限、安全与 App 功能 |
| Purchases | 订单、会员卡购买、退款和交易状态 | 是 | App 功能、支付与客户支持 |
| Health & Fitness | 用户主动录入的体测或身体指标 | 是 | App 功能 |
| User Content | 评价、头像、管理员上传的内容图片 | 通常是 | App 功能与内容管理 |
| Other Usage Data | 预约、取消、核销和角色操作记录 | 是 | App 功能、安全与审计 |
| Financial Info / Payment Info | Stripe 处理的支付资料 | 需按 Stripe 最终集成复核 | 支付处理 |

## 当前代码没有主动用于以下目的

- 第三方广告。
- 跨 App 或网站跟踪。
- 出售个人数据。
- 精确位置或粗略位置采集。
- 通讯录、日历、麦克风或健康 App 数据读取。

如果客户以后接入分析、崩溃报告、广告、地图、短信、邮件营销或新的支付 SDK，必须更新隐私政策和 App Privacy 回答。

## 相机与相册

- Camera：仅供 Staff 扫描预约核销二维码。
- Photo Library：仅供授权 Admin 上传教练、内容或商品图片。
- 权限用途文案已在 `app.json` 的 `ios.infoPlist` 中配置。

## Stripe 注意事项

- API 服务器只应保存 Stripe PaymentIntent/Checkout Session/Charge 等标识、支付方式代码、金额、币种和状态。
- 不应在 Good Vibe Pilates & Yoga 数据库中保存完整卡号、CVC 或网银凭据。
- Stripe SDK 属于第三方代码。Apple 要求申报开发者及第三方合作方的数据实践，因此客户必须按实际启用的 Stripe 支付方式和 Stripe 最新文档复核 Payment Info 的回答。

## 建议的目的选项

大多数上述数据建议选择：

- App Functionality。
- Account Management。
- Customer Support（适用于联系资料、订单和退款）。
- Fraud Prevention, Security and Compliance（仅适用于实际用于安全或反欺诈的数据）。

不要勾选 Advertising 或 Third-Party Advertising，除非生产版本确实接入此用途。

## Apple 官方说明

- https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- https://developer.apple.com/app-store/app-privacy-details/
