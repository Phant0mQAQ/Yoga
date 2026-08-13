# Good Vibe UI direction

These concept images are implementation references rather than production assets:

- `admin-dashboard-concept.png` — Web administration workspace
- `ios-student-concept.png` — native iPhone student experience

## Shared design inventory

- Background: warm porcelain `#F6F4EE`
- Surface: soft white `#FFFEFA`
- Primary: forest `#31513F`; deep forest `#183124`
- Action: coral `#E76553`
- Supporting surface: sage `#E6ECE6`
- Border: `#D7DCD5`
- Display type: system editorial serif; UI type: system sans serif
- Shape: 5–12 pt radii, thin borders, restrained shadow
- Spacing: 4, 8, 12, 16, 20, 24, 32, 48

## Fidelity ledger

1. Both clients use the same porcelain, forest, sage, coral, and line colors.
2. Editorial serif headlines create the same calm hierarchy on Web and iOS.
3. Web navigation is a light rail with a sage active state and coral index accent.
4. The Web overview keeps four open, outlined metrics above three operational panels.
5. The iOS membership card uses a deep-forest hero with prominent remaining credits.
6. iOS class rows use a date rail, coach/time metadata, capacity, and a coral booking action.
7. Both clients use thin separators, low shadows, and modest radii instead of pill-heavy cards.
8. Web layout collapses from three columns to two and one; iOS uses a native three-tab shell.
9. The original supplied Good Vibe logo remains unchanged on the Web login/rail and is reused byte-for-byte in the native iOS asset catalog.

## Intentional deviations

- The decorative botanical photography in the iPhone concept is represented by an SF Symbol leaf so the native app remains lightweight and does not introduce an unlicensed raster asset.
- The Web payment panel renders the live methods returned by the API, so its row count can differ from the static concept.
- Existing product copy and API-backed values remain authoritative; concept text was not copied when it would imply unavailable data.

## Verification artifacts

- `admin-dashboard-live.jpg` — authenticated Cloudflare deployment in the default desktop viewport.
- `admin-mobile-live.jpg` — authenticated Cloudflare deployment with a 390 × 844 browser viewport override; CSS client width was 375 px and no horizontal document overflow was detected.
- `login-refined-desktop.jpg` — login screen after removing the oversized duplicate logo from the content panel while retaining the shell brand mark.
- `login-refined-mobile.jpg` — the same login hierarchy at a 390 × 844 viewport with no horizontal overflow.
- Web navigation, field labels, operational copy, localization keys, and API-backed values were kept unchanged. The iOS shell adds the native tab labels Home, Bookings, and Account while preserving the existing booking and logout actions.
