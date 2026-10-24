CREATE TABLE Sessions (
 Id TEXT PRIMARY KEY,
 OwnerId TEXT NOT NULL,
 State TEXT NOT NULL CHECK(State IN ('AwaitingPairing','PendingConfirmation','Capturing','Finalized','Cancelled','Expired')),
 ContextJson TEXT NOT NULL,
 PolicyJson TEXT NOT NULL,
 CreatedAt INTEGER NOT NULL,
 ExpiresAt INTEGER NOT NULL,
 InviteHash TEXT,
 InviteExpiresAt INTEGER,
 PhoneVersion TEXT NOT NULL,
 ConfirmationCode TEXT,
 ReceiptJws TEXT,
 PayloadJson TEXT
);
CREATE INDEX Sessions_Owner ON Sessions(OwnerId);
CREATE TABLE Uploads (
 SessionId TEXT NOT NULL REFERENCES Sessions(Id) ON DELETE CASCADE,
 Id TEXT NOT NULL,
 AuthorizationHash TEXT NOT NULL,
 ExpiresAt INTEGER NOT NULL,
 Status TEXT NOT NULL CHECK(Status IN ('Reserved','Accepted','Deleted')),
 PhotoId TEXT,
 Sha256 TEXT,
 Size INTEGER,
 ReceivedAt INTEGER,
 PRIMARY KEY(SessionId,Id)
);
CREATE UNIQUE INDEX Uploads_Photo ON Uploads(PhotoId);
CREATE INDEX Uploads_Quota ON Uploads(SessionId,Status,ExpiresAt);
