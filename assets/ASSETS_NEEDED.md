# Required Assets

Before building, you need these image assets in this folder:

## icon.png
- 1024x1024 px, PNG
- Your app icon (no transparency for iOS)
- Tip: Use a food/nutrition theme with orange/teal colors

## splash.png
- 1242x2688 px, PNG
- Splash screen image
- Background color: #FF6B35 (set in app.json)
- Simple centered logo/text works great

## notification-icon.png
- 96x96 px, PNG, white on transparent background
- Used for push notification icon on Android

## Quick way to create placeholder assets (macOS/Linux):
```
# Install ImageMagick if needed: brew install imagemagick
magick -size 1024x1024 xc:#FF6B35 -fill white -gravity center \
  -font Arial-Bold -pointsize 180 -annotate 0 "CP" icon.png

magick -size 1242x2688 xc:#FF6B35 -fill white -gravity center \
  -font Arial-Bold -pointsize 200 -annotate 0 "CaloriePal" splash.png

magick -size 96x96 xc:transparent -fill white -gravity center \
  -font Arial-Bold -pointsize 40 -annotate 0 "CP" notification-icon.png
```
