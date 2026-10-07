# HomeStock

> Household pantry and shopping list. **Local first**. Works offline. Syncing is optional.

---

## Purpose

A simple app to keep the household pantry and the shopping list that comes out of it:

- ✅ Works **offline** on your phone
- ✅ Your data **stays on your device**, unless you choose to sync
- ✅ Does not depend on the internet, a cloud, or an external service
- ✅ Syncing with another phone is **optional**, through your own computer
- ✅ No tracking, no data analysis, no mandatory account
- ✅ Starts as an installable **PWA**, then grows step by step into a **native app** on the Google Play Store and the App Store

You can use HomeStock for years on a single phone, without turning on a computer and without uploading anything to a cloud.

---

## Philosophy

HomeStock follows the same principles as [HomeFinance](https://github.com/LuizFer1/homefinance):

- **Local first.** Your data belongs to you. It stays on your device.
- **Offline first.** The whole daily loop works without a network.
- **No external services.** No Google, Apple, Firebase, or any backend. The store only distributes the app.
- **Optional sync.** One phone is enough. Another phone joins when you want, with your computer as the hub.
- **PWA first, native over time.** The phone app starts as a PWA. A native app replaces it in steps, on the Google Play Store and the App Store. The pantry, the list, and the data on the device stay the same through that change.

Publishing to a store adds no account, no analytics, and no change to where the data lives.

---

## How It Works

### One device (the default)

Everything runs on your phone. There is no server.

```
┌─────────────────────┐
│   PWA (phone)       │
│                     │
│ • Pantry            │
│ • Shopping list     │
│                     │
│  On-device data     │
└─────────────────────┘
```

The native app takes this same place later. Until then, the PWA is the app.

### Sync (more than one device)

The household computer is **HubStock**. It stores the latest version of each row the phones send and returns to each phone what it has not seen yet. When the computer is off, the phones keep working. Nothing leaves the local network.

```
        Computer
        (HubStock)
            │
       SQLite + sync
            │
      ┌─────┴─────┐
      │           │
   Phone 1     Phone 2
   (app)       (app)
```

HubStock is its own repository and its own binary. It is not a backend the app depends on.

---

## The daily loop

The pantry drives the list.

Each pantry item has a name, a unit, a quantity on hand, a minimum, and a usual purchase quantity.

- A quantity **below the minimum** puts the item on the list. The suggestion is the usual purchase quantity.
- Confirming the purchase **adds** that quantity to the stock. The number can be edited before it is confirmed.
- Once the quantity is back at the minimum or above it, the item **leaves the list**.
- Lowering the quantity on the item itself is what can put it on the list again.
- A minimum of zero keeps the item in the pantry without putting it on the list on its own.

An extra list item is a name on the list. It does not live in the pantry. Marking it bought removes it from the list and does not create stock.

---

## Planned features

- Record what you have at home, with unit, quantity, minimum, and usual purchase quantity
- See what is below the minimum
- Confirm a purchase and restock
- Lower the quantity when something is used
- Add an extra item to the list
- Work offline
- Install as a PWA
- Sync through HubStock, once it exists
- Grow into a native app on the Google Play Store and the App Store

---

## Outside the foundation

Expiry dates, where something is kept (fridge, cupboard), barcodes, turning an extra list item into a pantry item, the HubStock binary, the native app, and the store listing. The data model is born ready for sync and for the later native app, so neither one needs a migration of the pantry.

---

## Intended stack

The foundation picks the tools. The constraints below already hold.

**Phone**

- Starts as an installable PWA, offline, with data on the device
- TypeScript, with tests and lint in CI
- An on-device database
- No account SDK, no analytics SDK, no backend SDK
- Evolves in steps into a native app for the Google Play Store and the App Store. The foundation does not start as a store binary.

**HubStock**

- Rust
- SQLite
- A single binary, on the owner's computer
- The same role as the HomeFinance hub: it relays rows on the local network

**Size and dependencies.** Every new dependency has to fit an app that works with no network and no telemetry.

---

## Data model

Data lives on the device. The automatic list **is not a table**. It is the pantry filtered to quantities below the minimum. What gets stored is the item. Two phones converge because they sync that row, not a copy of the list.

An extra list item is its own row. It has no pantry item.

Every stored row carries what HubStock will need:

- `updatedAt` — a hybrid logical clock (HLC), not the raw wall clock, so a phone with a fast clock cannot win every conflict. Conflicts are **last-write-wins per row**.
- `deletedAt` — a logical delete. The row stays, marked, so the other phone can receive the deletion.
- `dirty` — changed since the last sync.

A row that must be born identical on every device gets a stable id. HomeStock has no seeded catalog yet.

---

## Why This Way?

**Privacy.** Your data does not leave the device unless you ask it to.

**Autonomy.** The app depends on no one to open, record use, or build the list.

**Control.** You decide whether to sync, and with which computer.

**Simplicity.** No account, no password, no service in the middle. The app on your phone and, if you want it, HubStock on your network.

---

## Status

This repository starts with this README. There is no app yet, and no HubStock yet.

The next delivery is the **foundation**: a PWA that opens offline and stores data on the device. The native app and the store listings come later, in steps. HubStock comes after the foundation.

Design notes, when they exist, live outside this repository, in the workspace folder. This README does not link to them. Such a link would be broken for anyone cloning the repo.

---

## Links

- [Repository](https://github.com/LuizFer1/HomeStock)
- [HomeFinance](https://github.com/LuizFer1/homefinance), the sibling finance app, with the same principles
