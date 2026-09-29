# Product Passport Marketplace

Marketplace UI for buying and selling second-hand products with product passports, ownership history, and service records.

## Run locally

Use Node.js 24 or newer for the built-in SQLite backend. Install dependencies once, then run the API and UI in separate terminals:

```bash
npm install
```

```bash
npm run api
```

```bash
npm run dev
```

The API stores accounts, passports, listings, seller applications, evidence metadata/files, sessions, and admin audit events in `.data/marketplace.sqlite` and `.data/evidence/`. The Vite dev server proxies `/api` to the API. Wallet sign-in uses a one-time server nonce and an EVM signature; signatures do not send transactions. Add public admin wallet addresses to `ADMIN_WALLETS` in the ignored local `.env` file.

The React screens still use the browser store for their catalog and demo workflows. The API exposes authenticated write endpoints, but those screens have not yet been migrated to load and mutate the shared records. Do not mistake local display data for shared marketplace data.

### Backend API

- `GET /api/health`, `POST /api/auth/nonce`, `POST /api/auth/verify`, `POST /api/auth/logout`, `GET /api/me`, and `PATCH /api/me`
- `GET /api/passports`, `GET /api/passports/:id`, and authenticated `POST /api/passports`
- `GET /api/listings` and seller-authenticated `POST /api/listings` (new listings enter admin review)
- `POST /api/seller-applications`, admin-only `GET /api/admin/review-queue`, `PATCH /api/admin/listings/:id`, and `PATCH /api/admin/sellers/:wallet`
- Authenticated private evidence upload/download and admin audit-log endpoints

The local SQLite database is suitable for development on one machine. Before a public launch, move it to a managed PostgreSQL database and private object storage, add migrations and backups, and deploy the API behind HTTPS.

## MST Testnet transactions

The app targets MST Testnet (`https://testnetrpc.mstblockchain.com`, chain ID `91562037`, tMSTC). Connect an EVM wallet from the header. Each real write asks the connected wallet to approve the transaction. Without a connected wallet, actions are stored as `LOCAL_ONLY` and have no transaction hash.

To deploy the included contracts:

1. Copy `.env.example` to `.env` and set `PRIVATE_KEY` to a testnet-only deployment key. Keep it secret and never add it to a `VITE_*` variable.
2. Fund that account with test MSTC from the MST Testnet faucet.
3. Run `npx hardhat compile` and `npx hardhat run scripts/deploy.ts --network testnet`.
4. Copy the printed registry addresses into `.env.local` using the `VITE_MST_*` variable names in `.env.example`, then restart Vite.

The contract addresses in the browser are intentionally blank until a deployment is configured. No contracts are deployed by this repository setup. Listing and warranty events use `LifecycleRegistry`; they are not separate contracts. Marketplace listings themselves remain local data.

## Before a public launch

- Migrate React screens from browser storage to the API; the API currently exists alongside the local demo store.
- Configure a real payment provider adapter, signed webhooks, settlements, refunds, cancellations, chargebacks, and disputes. Checkout is intentionally disabled until an adapter is implemented.
- Add an on-chain event indexer and reconciliation worker after deploying and configuring the registry contracts.
- Keep the two-party on-chain ownership transfer flow configured against reviewed deployments. Passport creation now submits passport registration, initial ownership, and identity attestation transactions; sellers initiate transfers and buyers confirm them. Listing records and marketplace discovery still use browser-local data and are not synchronized across devices.
- Replace local SQLite/files with managed PostgreSQL and private object storage; configure backups, monitoring, rate limits, abuse reporting, and data-retention procedures.
- Review and secure the contracts before mainnet use. Some on-chain registry write methods still lack issuer/admin access controls.
- Validate deployed contract addresses and source code on the explorer; define admin-key rotation, incident response, and recovery procedures.

This repository now includes a local backend foundation and optional wallet-to-contract path. The marketplace UI, checkout, event indexing, and deployed contracts are not yet production-ready.
