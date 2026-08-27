# Shop Payment Service

Payment microservice for a **Shop** site deployed by [ShopHub](https://github.com/DevOps-siit-master).
It verifies that a buyer's cryptocurrency payment actually happened on chain, and only then marks the
order as paid. Built with NestJS in its own repository.

The service never moves funds and holds no keys: the buyer's wallet sends the tokens directly to the
shop's address, and this service is the party that checks the transaction.

## Tech stack

- NestJS 11 + TypeScript
- [ethers](https://docs.ethers.org/v6/) v6 for reading the chain (Sepolia testnet by default)
- `prom-client` for metrics, OpenTelemetry for tracing
- Jest (unit) + Testcontainers with a real EVM node (integration)
- Docker

## How a payment is verified

```
storefront                 payment service              chain            order service
    │                            │                        │                    │
    │ MetaMask: USDT transfer ──────────────────────────▶  │                    │
    │ ◀── txHash                 │                        │                    │
    │ POST /payments/verify ───▶ │                        │                    │
    │                            │ GET /orders/:id ───────────────────────────▶ │
    │                            │ ◀── total              │                    │
    │                            │ getTransactionReceipt ▶│                    │
    │                            │ ◀── receipt + logs     │                    │
    │                            │ PATCH status=PAID ─────────────────────────▶ │
    │ ◀── { status: 'PAID' }     │                        │                    │
```

A transaction is accepted only when **all** of these hold:

1. the receipt exists and its status is success,
2. it contains an ERC-20 `Transfer` log emitted by the configured token contract,
3. the recipient is the shop's wallet address,
4. the transferred amount is at least the order total.

Anything else is rejected with `400`, and the order stays `PENDING`.

## Local development

Requirements: Node.js 22+, Docker (only for the integration tests).

```bash
# 1. Install dependencies
npm ci

# 2. Create your local env file and fill in the addresses
cp .env.example .env

# 3. Run the service in watch mode
npm run start:dev
```

- API: http://localhost:3001
- Metrics: http://localhost:3001/metrics

For `SEPOLIA_RPC_URL` use any Sepolia endpoint (Infura, Alchemy, or a public one). To work entirely
offline, run a local node instead and point the service at it:

```bash
docker run --rm -p 8545:8545 ghcr.io/foundry-rs/foundry:latest "anvil --host 0.0.0.0"
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run start:dev` | Run in watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run lint` | ESLint check |
| `npm test` | Unit tests |
| `npm run test:e2e` | Integration tests (Testcontainers + a real EVM node) |

## API

| Method & path | Body | Result |
| --- | --- | --- |
| `POST /payments/verify` | `{ orderId, txHash }` | `201` + `{ orderId, status: 'PAID', txHash }` when the transfer checks out; `400` when the order is unknown, the transaction is missing or unconfirmed, the recipient is wrong, or the amount is too low |
| `GET /metrics` | — | `200` + Prometheus exposition format |

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SEPOLIA_RPC_URL` | `http://127.0.0.1:8545` | JSON-RPC endpoint the receipts are read from |
| `USDT_ADDRESS` | — | Token contract whose `Transfer` events count as payment |
| `SHOP_WALLET_ADDRESS` | — | The shop's payout address; transfers to any other address are rejected |
| `ORDER_SERVICE_URL` | `http://localhost:3000` | Where orders are read and their status patched |
| `PORT` | `3001` | HTTP port |
| `CORS_ORIGIN` | `*` | Allowed origin for storefront requests |
| `OTEL_SERVICE_NAME` | `shop-payment-service` | Service name reported in traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318/v1/traces` | OTLP collector endpoint |

The RPC provider is built from configuration through Nest's DI (`ETH_PROVIDER`), which is what lets the
integration tests point it at a throwaway chain.

## Observability

`/metrics` exposes, alongside the Node.js defaults:

| Metric | Meaning |
| --- | --- |
| `http_requests_total` | Requests by method, route and status — the 24h totals, successes and failures required by spec 4.1 |
| `http_request_duration_seconds` | Request latency histogram |
| `http_response_size_bytes_total` | Bytes served, for the total traffic volume |
| `unique_visitors_total` | Distinct visitors (client IP + browser) per 24h window |

Traces are exported over OTLP. Because the service calls the order service over HTTP, a checkout shows
up as a single trace spanning the storefront, this service and the order service.

## Testing

- **Unit** — `npm test` builds `Transfer` logs by hand and drives `verify()` against a mocked provider:
  the happy path plus an unconfirmed transaction, a wrong recipient and an amount that is too low.
- **Integration** — `npm run test:e2e` starts a real EVM node with Testcontainers, compiles and deploys
  a 6-decimal ERC-20, makes an actual transfer, and drives the API over HTTP. The order service is
  stubbed, and the test asserts it received the `PAID` patch. Both suites run on every pull request (spec 5.2).

## CI/CD

- **Pull requests** — conventional PR title check, TruffleHog secret scan, Trivy config scan, build,
  unit and integration tests, container image build and a Dockle image scan. A red pipeline blocks the merge.
- **`main`** — the release workflow derives the next version from the conventional commits
  ([SemVer](https://semver.org/)) and publishes the image to Docker Hub.

## Current limitations

- There is no `/health` endpoint yet, so Kubernetes probes have nothing to call.
- In the cluster, `SEPOLIA_RPC_URL`, `USDT_ADDRESS` and `SHOP_WALLET_ADDRESS` are meant to come from the
  Shop's `Wallet` custom resource through the shop-operator; that wiring is still being finished.

## Contributing (Trunk Based Development)

- `main` is the single trunk; work happens on short-lived branches (`feat/...`, `fix/...`, `chore/...`).
- Every change goes through a Pull Request; direct pushes to `main` are blocked.
- Each PR must pass CI and be approved by at least one teammate.
- Squash merge only, so `main` keeps a linear history.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

## Project structure

```
src/
├── payments/   # verification: controller, service, DTO, ETH_PROVIDER factory
├── metrics/    # Prometheus registry, HTTP middleware, visitor tracking
└── tracing.ts  # OpenTelemetry SDK, imported first in main.ts
```


