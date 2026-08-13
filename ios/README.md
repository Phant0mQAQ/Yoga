# iOS App

Create a new Xcode iOS App project named `GoodVibePilatesYogaApp`, set the minimum deployment target to iOS 16, then add the files in `GoodVibePilatesYogaApp/` to the target.

Recommended production packages:

- Stripe iOS SDK
- SwiftLint

The current source skeleton uses `URLSession` only, so it can be added before Stripe is installed. When Stripe SDK is available, wire `PaymentSheet` or Mobile Payment Element from the payment methods returned by `/api/v1/payments/methods`.

`APIClient` uses `http://localhost:8080/api/v1/` in Debug builds and the deployed
Cloudflare API in Release builds. To point an Xcode scheme at another environment,
add a `GOOD_VIBE_API_BASE_URL` string to the target's Info.plist. Keep the `/api/v1`
path; a trailing slash is normalized automatically.
