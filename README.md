# SpendLite

A private, offline expense tracker built with React Native + Expo (SDK 58, Expo Router). Near-black with a `#35B7A5` main color, amounts in BZD (or USD), and locked behind your device fingerprint. All data stays on the device.

## Features

- **Security**: unlocks with your phone's own fingerprint (or Face ID) from the first launch. No separate app PIN. If the sensor fails, the system prompt can fall back to your device screen lock. Auto-locks when the app is backgrounded (immediately, 30s, 1 min or 5 min).
- **Multiple accounts**: bank, cash, card, savings, e-wallet and other accounts, each with its own starting balance, color, note, and an option to archive it.
- **Income & expenses**: record money in and out with a category, date and note. The category field remembers what you have typed before and suggests matches as you type. Each account and the home screen show **money in**, **spent**, and the **balance** (starting balance + in − out).
- **Search, filter, sort**: search by category, note, account, amount or date; filter by type, date range (presets or custom), account and category; sort by date, amount or category. Available on the Activity tab and on each account.
- **Plans**: start with an amount (or pull in an account's balance), add planned expenses and income, and see what you'll have **left after the plan**, how much of your money is allocated, and whether you're over budget. Tick items off as done to track *spent so far* and *available now*. If the plan is linked to an account, a done item can be recorded there as a transaction in the same step.
- **Summary tab**: total balance, a period's in/out/net and savings rate, a summary card per account, income vs. expenses for the last 6 months, and spending/income by category.
- **Import / export**: full JSON backup (accounts, transactions, plans, settings) and CSV export of transactions. Import a JSON backup (merge, or replace everything) or a CSV (`date, account, type, category, amount, note`). CSV imports create missing accounts by name and skip duplicate rows.

## Running it

```bash
npm install
npx expo start
```

Then open it on your phone:

- **Expo Go (fastest)**: scan the QR code. Fingerprint unlock (Android), storage, import and export all work. Face ID on iOS isn't supported in Expo Go; there the prompt uses your device passcode instead.
- **Development build (full native features, including Face ID)**: `npx expo run:android` / `npx expo run:ios` (needs Android Studio / Xcode locally).

To install it permanently on an Android phone, build an APK with EAS (free Expo account needed): `npx eas-cli@latest build -p android --profile preview`. When it finishes, open the download link on your phone and install the APK. The `preview` profile in `eas.json` is set up to produce an APK.

The app icon, Android adaptive/themed icon and splash image live in `assets/`.

## Project layout

```
src/
  app/                    Expo Router screens
    (tabs)/               Accounts · Activity · Plans · Summary · Settings
    account/[id].tsx      Account detail with filtered transaction list
    plan/[id].tsx         Plan detail and its line items
    *-form.tsx            Modal forms for accounts, transactions and plans
    plan-item.tsx         Add/edit a planned expense or income
  components/             UI kit (incl. keyboard-aware FormScroll), lock screen, lists, charts
  lib/
    auth.tsx              Device fingerprint unlock, auto-lock
    store.tsx             App data (AsyncStorage-persisted) and its mutations
    calc.ts               Totals, balances, plan and summary math
    filters.ts            Search / filter / sort
    backup.ts             JSON + CSV import/export
```

Money is stored as integer cents to avoid floating-point rounding errors.

## Scripts

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
npx expo-doctor    # dependency health
```
