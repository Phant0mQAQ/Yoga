# Third-party payment brand assets

Payment logos are stored locally so the admin Web, member Web, Expo, and SwiftUI clients render the same stable assets without requesting third-party hosts at runtime.

- Most payment-method and card-network marks come from [elepay-payment-logos](https://github.com/elestyle/elepay-payment-logos). Its README describes the collection as free for commercial use and notes that all trademarks remain the property of their respective owners.
- The Samsung Pay mark comes from [Simple Icons](https://github.com/simple-icons/simple-icons), released under [CC0 1.0](https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md). Brand trademarks remain subject to their owners' policies.
- The PAYCO wordmark is extracted from the official [PAYCO Developers image resources](https://developers.payco.com/guide/image/resource), specifically the official PNG logo guide linked on that page. Keep the official red `#ff2233`, clear space, and minimum-size guidance intact.

The generic card glyph is project artwork. Do not recolor or reshape third-party brand marks in the generated outputs. If a brand asset is refreshed, regenerate the Web SVG, Expo PNG, and iOS imageset variants together so all clients stay visually aligned.
