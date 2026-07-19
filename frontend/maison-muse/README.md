# Maison Muse

A luxury-positioned marketplace concept for licensing bespoke AI "muses" (personas)
and curated content packs to creators running AI-influencer accounts on platforms
like Fanvue.

This is a front-end MVP: mock data, in-memory state, no real backend/payments/auth.
It demonstrates the product surface — browsing, persona detail + licensing tiers,
a creator submission studio, checkout, and a Trust & Compliance page — so the
concept and flows can be validated before wiring up real infrastructure.

## Stack

Vite + React + Tailwind CSS, matching the pattern used by `frontend/expense-ledger`
elsewhere in this repo.

## Run it

```bash
npm install
npm run dev
```

## Product model

- **Muse (persona)** — a named AI character with a bio, style/category tags, and
  two license tiers:
  - *Exclusive* — sold once, buyer gets sole rights, persona is retired from the
    marketplace.
  - *Shared* — non-exclusive, can be licensed to multiple buyers at a lower price.
- **Content pack** — a pre-generated media collection from a given muse, sold as
  a standalone download/usage license without transferring rights to the muse
  itself.

## Trust & Compliance (see `src/components/TrustPolicy.jsx`)

Every listing path requires creators to attest to: fully-synthetic origin or
documented model-release consent for any real-person likeness, zero tolerance
for depicting minors, and compliance with the destination platform's AI-content
disclosure rules. This is UI-level scaffolding only — a production build needs
real identity/age verification and human moderation review behind it before
accepting live listings.
