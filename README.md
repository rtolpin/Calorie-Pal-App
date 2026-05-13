# CaloriePal - AI Meal Tracker 🥗

# Now Available on the Apple App Store!! [https://apps.apple.com/us/app/caloriepal-ai-meal-tracker/id6763131173] It has an orange icon that has the letters CP.

A colorful, intuitive food and macro/calorie tracking iOS app built with React Native (Expo). Snap a photo of your meal, let AI analyze the nutrition, and track your progress over time.

---

## Features

- 📷 **Snap & Analyze** — Take a photo of any meal; GPT-4o Vision identifies food items and estimates nutrition
- 📊 **Full Macro Tracking** — Calories, Protein, Carbs, Fat, Fiber, Sugar, Sodium, Cholesterol, Saturated Fat
- 📓 **Food Journal** — Chronological log with search, filtering, and photo thumbnails
- 🤖 **AI Suggestions** — Personalized nutrition advice powered by Claude AI
- 👤 **User Profiles** — TDEE-based calorie goals, macro targets, and onboarding flow
- 🔔 **Reminders** — Customizable daily meal logging notifications
- 👻 **Guest Mode** — Full access to camera scanning without an account (local storage only)
- ☁️ **Cloud Sync** — All data synced via Supabase for authenticated users

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | https://nodejs.org |
| Expo CLI | Latest | `npm install -g expo-cli` |
| EAS CLI | Latest | `npm install -g eas-cli` |
| Xcode | 15+ | Mac App Store (required for iOS builds) |
| Apple Developer Account | — | https://developer.apple.com |

---

## Setup Instructions

### 1. Clone and Install

```bash
cd /home/rebeccatolpin/caloriepal
npm install
```

### 2. Create Your .env File

```bash
cp .env.example .env
```

Edit `.env` and fill in your API keys:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-openai-key
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
```

### 3. Set Up Supabase

1. Go to https://supabase.com and create a new project
2. Copy your **Project URL** and **anon public** key into `.env`
3. In Supabase Dashboard → SQL Editor, run the migration:
   ```
   supabase/migrations/001_initial.sql
   ```
4. Verify tables `profiles` and `food_logs` were created
5. Verify the `meal-photos` storage bucket was created (Dashboard → Storage)

### 4. Get API Keys

**OpenAI (GPT-4o Vision for meal analysis):**
1. Go to https://platform.openai.com/api-keys
2. Create a new key, add it to `.env` as `EXPO_PUBLIC_OPENAI_API_KEY`
3. Ensure your account has GPT-4o access (requires paid tier)

**Anthropic Claude (AI nutrition suggestions):**
1. Go to https://console.anthropic.com
2. Create a new API key, add it to `.env` as `EXPO_PUBLIC_ANTHROPIC_API_KEY`

### 5. Add App Assets

Place these files in `/assets/`:
- `icon.png` — 1024×1024 px app icon
- `splash.png` — 1242×2688 px splash screen
- `notification-icon.png` — 96×96 px notification icon (white on transparent)

See `assets/ASSETS_NEEDED.md` for quick ImageMagick commands to generate placeholders.

### 6. Run in Development

```bash
npx expo start
```

Scan the QR code with **Expo Go** on your iPhone to preview the app instantly (some features like camera work best on a real device).

---

## Building for iOS (TestFlight & App Store)

### Step 1: Configure EAS

```bash
eas login
eas build:configure
```

This creates an EAS project. Copy the project ID into `app.json` under `extra.eas.projectId`.

### Step 2: Update eas.json with Your Apple Info

Edit `eas.json` → `submit.production.ios`:
```json
{
  "appleId": "your-apple-id@icloud.com",
  "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
  "appleTeamId": "YOUR_10_CHAR_TEAM_ID"
}
```

Find these at:
- Apple ID: your Apple Developer account email
- ASC App ID: App Store Connect → App → App Information → Apple ID
- Team ID: developer.apple.com → Account → Membership

### Step 3: Build for TestFlight

```bash
# Preview build (for TestFlight)
npm run build:preview

# OR production build (for App Store)
npm run build:ios
```

EAS will:
1. Upload your code to Expo's build servers
2. Compile the iOS `.ipa` file (takes ~10–15 minutes)
3. Provide a download link when complete

### Step 4: Submit to TestFlight

```bash
# Option A: Auto-submit via EAS
eas submit --platform ios

# Option B: Manual upload
# 1. Download the .ipa from EAS
# 2. Open Xcode → Window → Organizer
# 3. Drag .ipa → Distribute App → App Store Connect
```

### Step 5: Add Family Members to TestFlight

1. Open **App Store Connect** at https://appstoreconnect.apple.com
2. Select your CaloriePal app
3. Click **TestFlight** in the top navigation
4. Under **Internal Testing**, create a group (e.g., "Family")
5. Click **Add Testers** → enter email addresses for each family member
6. Each person will receive an email with:
   - A link to install the **TestFlight app** from the App Store
   - An invitation code to access CaloriePal
7. They open TestFlight on their iPhone → accept invitation → install CaloriePal

**Family members need:**
- An iPhone running iOS 16.0 or later
- The free TestFlight app installed from the App Store

### Step 6: Invite via TestFlight Public Link (Easiest Method)

1. In TestFlight → your app → Internal Testing group
2. Enable **Public Link**
3. Share the link — anyone with it can install directly via TestFlight
4. No individual email invitations needed!

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous public key |
| `EXPO_PUBLIC_OPENAI_API_KEY` | ✅ | OpenAI API key (needs GPT-4o access) |
| `EXPO_PUBLIC_ANTHROPIC_API_KEY` | ✅ | Anthropic API key for Claude |

> **Security Note:** These keys are embedded in the app bundle. For a public App Store release, consider proxying API calls through a backend (e.g., Supabase Edge Functions) to keep keys server-side.

---

## Project Structure

```
caloriepal/
├── app/
│   ├── _layout.tsx          # Root layout, font loading, auth init
│   ├── index.tsx            # Auth redirect
│   ├── snap-result.tsx      # Meal analysis results modal
│   ├── edit-entry/[id].tsx  # Edit journal entry
│   ├── (auth)/              # Authentication screens
│   │   ├── welcome.tsx
│   │   ├── sign-in.tsx
│   │   ├── create-account.tsx
│   │   └── onboarding.tsx
│   └── (tabs)/              # Main app tab screens
│       ├── index.tsx        # Home / Dashboard
│       ├── journal.tsx      # Food Journal
│       ├── snap.tsx         # Camera screen
│       ├── insights.tsx     # Charts & AI suggestions
│       └── profile.tsx      # User profile
├── components/              # Reusable UI components
├── lib/                     # API clients & utilities
│   ├── supabase.ts          # Supabase client
│   ├── openai.ts            # GPT-4o meal analysis
│   ├── claude.ts            # Claude AI suggestions
│   ├── tdee.ts              # Calorie calculator
│   ├── asyncStorage.ts      # Guest mode local storage
│   └── notifications.ts     # Push notifications
├── store/                   # Zustand state management
│   ├── authStore.ts
│   └── foodLogStore.ts
├── constants/Colors.ts      # Design system colors
├── types/index.ts           # TypeScript types
└── supabase/migrations/     # Database schema SQL
```

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React Native + Expo SDK 51 | Mobile app framework |
| Expo Router | File-based navigation |
| Supabase | Auth, database, file storage |
| OpenAI GPT-4o | Meal photo analysis |
| Anthropic Claude | Personalized nutrition suggestions |
| Zustand | Global state management |
| react-native-gifted-charts | Donut, bar, pie charts |
| react-native-reanimated | Smooth animations |
| Expo Camera | Camera access |
| AsyncStorage | Guest mode local data |
| NativeWind/StyleSheet | Styling |
| EAS Build | Cloud iOS build service |

---

## Troubleshooting

**Build fails: "Missing icon.png"**
→ Create placeholder assets (see `assets/ASSETS_NEEDED.md`)

**Camera doesn't work in Expo Go**
→ Camera requires a development build. Run `eas build --profile development` and install the dev client on your iPhone.

**Supabase RLS errors**
→ Make sure you ran the full migration SQL. Check Supabase Dashboard → Authentication → Policies.

**OpenAI analysis returns empty/invalid JSON**
→ Ensure your OpenAI account has GPT-4o access. The model must support vision. Check your API usage limits.

**App won't submit to App Store**
→ Make sure your `eas.json` has correct Apple credentials. You need an active Apple Developer Program membership ($99/year).

---

## License

MIT — built with ❤️ for personal family use.
