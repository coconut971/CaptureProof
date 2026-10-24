English · [Français](fr/architecture.md)

# Architecture and integration

CaptureProof contains two strict TypeScript packages, a React/Vite demonstration and one ASP.NET Core reference API. Images stay on disk outside the web root. SQLite stores sessions, frozen policies, reservations, digests and receipts. The embedded SQL migration `001_initial.sql` runs in a transaction on first startup and is recorded in `SchemaMigrations`. Restarting does not replay it.

`CaptureController` coordinates the camera, captures and abstract transport. The Web Component renders that state. The capture package does not import React. Mobile-browser detection only guides the interface; a modified client can bypass it while the server continues to enforce authorization and quotas.

## Choose the parts you need

| Part | Responsibility | Integration choice |
| --- | --- | --- |
| `CaptureController` | Camera lifecycle, JPEG capture, upload state and retry coordination | Connect your own interface and workflow |
| Capture Web Component | A small ready-made view over the controller | Use it when its interface fits your application |
| `CaptureTransport` | Typed boundary between capture and a server | Implement the adapter for your backend |
| ASP.NET Core API | Reference pairing, authorization, quotas, storage and signing | Adopt it or implement the documented protocol |
| Receipt verifier | Local signature, file-set and context verification | Use independently of capture and the reference API |
| React application | Demonstration of pairing, capture and verification | Optional example rather than a required application shell |

The built demonstration is served by the backend under the same origin as REST and SignalR. The Vite proxy is for development only. SignalR carries only an invalidation notification, `{sessionId}`. Each notification, reconnect and periodic recovery rereads authorized REST state. JPEGs travel over HTTP, never over SignalR. The API is authoritative.

## Identity and business references

`DemoIdentity` creates a random owner identifier protected by ASP.NET Data Protection in an HttpOnly cookie. It creates no account or password and is not production business authentication. The phone cookie carries only a session identifier, a revocable version and an expiry; it does not grant owner permissions.

An integration must replace identity resolution and `IBusinessAuthorizer`. That implementation must obtain the real authenticated user on the server, check permission to act on the requested reference, and return the expected integration space and business reference. The demonstration accepts only simple alphanumeric references in the `demo` space. Category selects a server policy; it does not determine identity.

`CaptureProof:Policies` is loaded from trusted configuration. For example:

```json
{
  "CaptureProof": {
    "PublicOrigin": "https://capture.example.invalid",
    "DataDirectory": "/private/captureproof",
    "Policies": {
      "vinyl": { "MinPhotos": 1, "MaxPhotos": 3, "MaxBytesPerPhoto": 5242880, "SessionTtlSeconds": 600 },
      "three-required": { "MinPhotos": 3, "MaxPhotos": 3, "MaxBytesPerPhoto": 5242880, "SessionTtlSeconds": 600 }
    }
  }
}
```

The server selects and copies the policy when creating the session. Policy fields added to a client POST do not alter that copy. The demonstration uses the `vinyl` rule of one to three photos; an integrator can require exactly three. The component allows completion at any permitted count and does not turn a display preference into a new quota.

## Transactions and persistence

Mutations use Microsoft.Data.Sqlite immediate transactions with real foreign keys and SQLite constraints. The write lock covers quota calculation and reservation, invitation acceptance, final upload acceptance and finalization. Authorization and state are checked again after the HTTP body is read. This reference server runs as one process with a local disk database; SQLite on a network share is unsupported.

Quota usage includes accepted photos and active reservations. The global storage budget adds accepted file sizes and the maximum size of each reservation under its frozen policy. Expired reservations no longer occupy capacity. Accepted or deleted upload identifiers cannot be reused for a new capture.

The server fully decodes JPEGs with SkiaSharp, then stores the exact bytes it received. It does not store a reencoded image under the original digest. The interface scales images visually without creating a derived server file. The canvas-produced JPEG is itself the reference file. Any future thumbnail would be a derivative and should be identified as such and stripped of unnecessary metadata.

Writing proceeds through a temporary file, synchronization to disk, a move to an internal filename and a transactional availability record. Failure before commit removes the file when possible; a sudden stop can leave an orphan for later cleanup. Cleanup commits row deletion before removing orphan files under the SQLite lock. No accepted row is created before the file move. External storage failure or modification remains possible and is reported on access or by the verifier.

## Version choices

SDK 10.0.402 and runtime 10.0.13 were used for the .NET 10 patch available when this implementation was built. Microsoft.Data.Sqlite and OpenAPI use 10.0.13. jose-jwt signs JWS receipts in .NET and `jose` verifies them in TypeScript to exercise interoperability between libraries. SkiaSharp performs real JPEG decoding with a maintained native dependency. React remains limited to the demonstration. Exact versions, declared licenses and transitive components are listed in the [dependency inventory](dependencies.md).

References: [.NET support](https://dotnet.microsoft.com/en-us/platform/support/policy), [Media Capture](https://www.w3.org/TR/mediacapture-streams/), [SignalR authorization](https://learn.microsoft.com/en-us/aspnet/core/signalr/authn-and-authz?view=aspnetcore-10.0), [jose-jwt](https://github.com/dvsekhvalnov/jose-jwt).
