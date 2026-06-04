# App icon source

- **`gov_uk.webp`** – GOV.UK logo used in the web app (favicon and header).
- **`icon-only.png`** – 1024×1024 PNG used by `@capacitor/assets` to generate Android and iOS app icons. Generated from `gov_uk.webp`.

To regenerate mobile app icons after changing the logo:

1. Update `icon-only.png` (must be PNG, at least 1024×1024). From the repo root with ImageMagick:  
   `magick frontend/assets/gov_uk.webp -resize 1024x1024 frontend/assets/icon-only.png`
2. Run:  
   `bun run cap:icons`

This updates `android/.../res/mipmap-*/` and `ios/App/App/Assets.xcassets/AppIcon.appiconset/`.
