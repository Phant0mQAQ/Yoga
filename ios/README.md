# iOS App

Create a new Xcode iOS App project named `YogaBookingApp`, set the minimum deployment target to iOS 16, then add the files in `YogaBookingApp/` to the target.

Recommended production packages:

- Stripe iOS SDK
- SwiftLint

The current source skeleton uses `URLSession` only, so it can be added before Stripe is installed. When Stripe SDK is available, wire `PaymentSheet` or Mobile Payment Element from the payment methods returned by `/api/v1/payments/methods`.
