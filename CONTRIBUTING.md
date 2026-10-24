# Contributing and adapting CaptureProof

**English** · [Français](CONTRIBUTING.fr.md)

You can use and adapt individual modules under [Apache-2.0](LICENSE). Custom screens, workflows and backends do not require the React demo. Keep applicable license and dependency notices when redistributing code.

## Find the right layer

- `packages/capture-web`: controller, typed transport and optional Web Component. Use `/headless` for your own interface.
- `packages/receipt-verifier`: independent receipt and exact-file verification, with an optional CLI.
- `src/CaptureProof.Api`: reference backend, signing keys, storage, business authorization and HTTP contract.
- `apps/web`: one React demonstration of the modules.
- `examples/vanilla`: a plain HTML component integration.

See the [integration guide](docs/integration.md) for extension points. Your identity integration, business rules and navigation belong to your product. The integrity guarantees require server-side enforcement and explicitly trusted verification keys.

## Validate a change

Use Node.js 24 and the .NET SDK selected in `global.json`. Follow [the setup commands](README.md#run-the-reference-demo) and [testing guide](docs/testing.md), including the interoperability fixture variables.

Run `npm run typecheck`, `npm run lint`, `npm run build`, `dotnet test`, `npm test`, `npm run test:e2e` and `npm run audit:public` as appropriate to the change, and the full checks before a release. Select a physical-device test for browser-specific camera, permission or lifecycle behavior. Documentation and wording changes do not require repeating captures.

## Keep contributions reviewable

Describe the concrete problem, resulting behavior and checks actually executed. Keep identifiers in English. English is the canonical documentation language; update the corresponding French guide when a contract or guarantee changes.

Preserve mobile-only capture, exact-byte receipt binding, explicit key trust, retry idempotency and camera cleanup. UI preferences cannot weaken server authorization or limits. Document compatibility changes and exercise the affected boundary with a regression test.

Use synthetic photos and throwaway stores. Do not submit real capture files, keys, databases, credentials or local working notes. Follow [SECURITY.md](SECURITY.md) for sensitive security reports.

Accounts, shops, marketplaces, AI detection and native apps are outside the reference implementation. A receipt does not establish physical camera origin, object authenticity, AI absence or independently trusted time.
