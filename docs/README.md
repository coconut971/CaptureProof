# Documentation

**English** · [Français](fr/README.md) · [Project overview](../README.md)

The reference demo is one composition of independent modules. Choose the parts that fit your interface, backend and workflow.

| Your goal | Read |
| --- | --- |
| Use the engine with your own screen | [Integration](integration.md), [capture package](../packages/capture-web/README.md) |
| Embed the supplied component | [Plain HTML example](../examples/vanilla/README.md) |
| Build or replace a backend | [Architecture](architecture.md), [HTTP protocol](protocol.md) |
| Issue or independently verify receipts | [Receipt format](receipt.md), [verifier](../packages/receipt-verifier/README.md) |
| Test on a real mobile browser | [Trusted HTTPS](https.md), [validation record](testing.md) |
| Run or containerize the reference API | [Operations](operations.md) |
| Preserve and restore a stopped data store | [Backup and restore](backup-restore.md) |
| Understand the guarantees | [Threat model](threat-model.md), [security](../SECURITY.md) |
| Review dependencies and licensing | [Inventory](dependencies.md), [NOTICE](../NOTICE), [LICENSE](../LICENSE) |
| Contribute an improvement | [Contributing](../CONTRIBUTING.md) |

An alternative backend must implement the transport and receipt rules for the guarantees to hold. Local `capture-only` integrations do not produce signed server receipts.
