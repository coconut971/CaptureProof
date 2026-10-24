using System.Text.Json;
using Microsoft.Data.Sqlite;
using SkiaSharp;

namespace CaptureProof.Api;

public sealed class CaptureStore
{
    private readonly CaptureOptions options;
    private readonly TimeProvider clock;
    private readonly ReceiptSigner signer;
    private readonly IBusinessAuthorizer business;
    private readonly string connectionString;
    public string PhotoDirectory { get; }
    private long Now => clock.GetUtcNow().ToUnixTimeMilliseconds();
    private sealed record SessionRow(string Id, string OwnerId, string State, BusinessContext Context, CapturePolicy Policy, long CreatedAt, long ExpiresAt, string? InviteHash, long? InviteExpiresAt, string PhoneVersion, string? ConfirmationCode, string? ReceiptJws);

    public CaptureStore(CaptureOptions options, TimeProvider clock, ReceiptSigner signer, IBusinessAuthorizer business)
    {
        this.options = options; this.clock = clock; this.signer = signer; this.business = business;
        Directory.CreateDirectory(options.DataDirectory);
        PhotoDirectory = Path.Combine(options.DataDirectory, "photos");
        Directory.CreateDirectory(PhotoDirectory);
        connectionString = new SqliteConnectionStringBuilder { DataSource = Path.Combine(options.DataDirectory, "captureproof.db"), ForeignKeys = true, DefaultTimeout = 15, Pooling = false }.ToString();
        using var db = Open();
        Execute(db, null, "PRAGMA journal_mode=WAL;");
        using var tx = db.BeginTransaction(); // Immediate transaction: SQLite serializes writers, including reservations and finalization.
        Execute(db, tx, "CREATE TABLE IF NOT EXISTS SchemaMigrations(Version INTEGER PRIMARY KEY);");
        if (Scalar<long>(db, tx, "SELECT COUNT(*) FROM SchemaMigrations WHERE Version=1") == 0)
        {
            using var stream = typeof(CaptureStore).Assembly.GetManifestResourceStream("CaptureProof.Api.Migrations.001_initial.sql")!;
            using var reader = new StreamReader(stream);
            Execute(db, tx, reader.ReadToEnd());
            Execute(db, tx, "INSERT INTO SchemaMigrations VALUES(1)");
        }
        tx.Commit();
    }
    private SqliteConnection Open() { var db = new SqliteConnection(connectionString); db.Open(); return db; }
    private static SqliteCommand Command(SqliteConnection db, SqliteTransaction? tx, string sql, params (string, object?)[] args)
    {
        var command = db.CreateCommand(); command.Transaction = tx; command.CommandText = sql;
        foreach (var (name, value) in args) command.Parameters.AddWithValue("@" + name, value ?? DBNull.Value);
        return command;
    }
    private static int Execute(SqliteConnection db, SqliteTransaction? tx, string sql, params (string, object?)[] args)
    { using var command = Command(db, tx, sql, args); return command.ExecuteNonQuery(); }
    private static T Scalar<T>(SqliteConnection db, SqliteTransaction? tx, string sql, params (string, object?)[] args)
    { using var command = Command(db, tx, sql, args); return (T)Convert.ChangeType(command.ExecuteScalar()!, typeof(T)); }
    private T Transaction<T>(Func<SqliteConnection, SqliteTransaction, T> action)
    {
        using var db = Open(); using var tx = db.BeginTransaction();
        var result = action(db, tx); tx.Commit(); return result;
    }
    private SessionRow Get(SqliteConnection db, SqliteTransaction tx, string id)
    {
        Protocol.Require(Guid.TryParse(id, out _), 404, "not_found", "Session introuvable.");
        using var command = Command(db, tx, "SELECT Id,OwnerId,State,ContextJson,PolicyJson,CreatedAt,ExpiresAt,InviteHash,InviteExpiresAt,PhoneVersion,ConfirmationCode,ReceiptJws FROM Sessions WHERE Id=@id", ("id", id));
        using var row = command.ExecuteReader();
        if (!row.Read()) throw new ApiFault(404, "not_found", "Session introuvable.");
        var session = new SessionRow(row.GetString(0), row.GetString(1), row.GetString(2), JsonSerializer.Deserialize<BusinessContext>(row.GetString(3), Protocol.Json)!, JsonSerializer.Deserialize<CapturePolicy>(row.GetString(4), Protocol.Json)!, row.GetInt64(5), row.GetInt64(6), row.IsDBNull(7) ? null : row.GetString(7), row.IsDBNull(8) ? null : row.GetInt64(8), row.GetString(9), row.IsDBNull(10) ? null : row.GetString(10), row.IsDBNull(11) ? null : row.GetString(11));
        row.Close();
        if (session.ExpiresAt <= Now && session.State is not ("Finalized" or "Cancelled" or "Expired"))
        {
            Execute(db, tx, "UPDATE Sessions SET State='Expired',InviteHash=NULL WHERE Id=@id", ("id", id));
            session = session with { State = "Expired" };
        }
        return session;
    }
    private static void Owner(SessionRow session, Actor actor) => Protocol.Require(session.OwnerId == actor.OwnerId, 403, "forbidden", "Accès non autorisé.");
    private static bool HasPhone(SessionRow session, Actor actor) => actor.Phone?.SessionId == session.Id && actor.Phone.Version == session.PhoneVersion;
    private static void Reader(SessionRow session, Actor actor) => Protocol.Require(session.OwnerId == actor.OwnerId || HasPhone(session, actor), 403, "forbidden", "Accès non autorisé.");
    private static void Capturer(SessionRow session, Actor actor)
    {
        Protocol.Require(HasPhone(session, actor), 403, "phone_required", "Une autorisation de capture est requise.");
        Protocol.Require(session.State == "Capturing", 409, "invalid_state", "La session ne permet pas de modifier les photos.");
    }
    private PhotoView[] Photos(SqliteConnection db, SqliteTransaction tx, string sessionId)
    {
        using var command = Command(db, tx, "SELECT PhotoId,Sha256,Size,ReceivedAt,Id FROM Uploads WHERE SessionId=@id AND Status='Accepted' ORDER BY ReceivedAt,PhotoId", ("id", sessionId));
        using var rows = command.ExecuteReader(); var result = new List<PhotoView>();
        while (rows.Read()) result.Add(new(rows.GetString(0), rows.GetString(1), rows.GetInt64(2), "image/jpeg", DateTimeOffset.FromUnixTimeMilliseconds(rows.GetInt64(3)), $"/api/sessions/{sessionId}/photos/{rows.GetString(0)}", rows.GetString(4)));
        return result.ToArray();
    }
    private SessionView View(SqliteConnection db, SqliteTransaction tx, SessionRow session) => new(session.Id, session.State, session.Policy, session.Context, DateTimeOffset.FromUnixTimeMilliseconds(session.ExpiresAt), session.State == "PendingConfirmation" ? session.ConfirmationCode : null, session.State is "Capturing" or "PendingConfirmation" or "Finalized", Photos(db, tx, session.Id), session.ReceiptJws is not null);
    public SessionView Read(string id, Actor actor) => Transaction((db, tx) => { var session = Get(db, tx, id); Reader(session, actor); return View(db, tx, session); });
    public SessionView[] List(Actor actor) => Transaction((db, tx) =>
    {
        Protocol.Require(actor.OwnerId is not null, 401, "owner_required", "Initialisez votre session de démonstration.");
        using var command = Command(db, tx, "SELECT Id FROM Sessions WHERE OwnerId=@owner ORDER BY CreatedAt DESC LIMIT 100", ("owner", actor.OwnerId));
        using var rows = command.ExecuteReader(); var ids = new List<string>(); while (rows.Read()) ids.Add(rows.GetString(0)); rows.Close();
        return ids.Select(id => View(db, tx, Get(db, tx, id))).ToArray();
    });
    public (SessionView View, PhoneGrant? Grant) Create(CreateSessionRequest request, Actor actor) => Transaction((db, tx) =>
    {
        Protocol.Require(actor.OwnerId is not null, 401, "owner_required", "Initialisez votre session de démonstration.");
        Protocol.Require(request.Category is not null && options.Policies.ContainsKey(request.Category), 400, "unknown_policy", "Catégorie inconnue.");
        var policy = options.Policies[request.Category!];
        var context = business.Authorize(actor.OwnerId!, request.BusinessReference);
        Protocol.Require(Scalar<long>(db, tx, "SELECT COUNT(*) FROM Sessions WHERE OwnerId=@owner", ("owner", actor.OwnerId)) < options.MaxSessionsPerOwner, 429, "owner_quota", "Limite de sessions atteinte pour cette démonstration.");
        Protocol.Require(Scalar<long>(db, tx, "SELECT COUNT(*) FROM Sessions") < options.MaxSessions, 429, "session_quota", "Limite globale de sessions atteinte.");
        var id = Protocol.Id(); var version = Protocol.Token(); var expiry = Now + policy.SessionTtlSeconds * 1000L;
        Execute(db, tx, "INSERT INTO Sessions(Id,OwnerId,State,ContextJson,PolicyJson,CreatedAt,ExpiresAt,PhoneVersion) VALUES(@id,@owner,@state,@context,@policy,@now,@expires,@version)", ("id", id), ("owner", actor.OwnerId), ("state", request.Direct ? "Capturing" : "AwaitingPairing"), ("context", JsonSerializer.Serialize(context, Protocol.Json)), ("policy", JsonSerializer.Serialize(policy, Protocol.Json)), ("now", Now), ("expires", expiry), ("version", version));
        return (View(db, tx, Get(db, tx, id)), request.Direct ? new PhoneGrant(id, version, expiry / 1000) : null);
    });
    public object Invite(string id, Actor actor) => Transaction((db, tx) =>
    {
        var session = Get(db, tx, id); Owner(session, actor);
        Protocol.Require(session.State is "AwaitingPairing" or "PendingConfirmation" or "Capturing", 409, "invalid_state", "Invitation indisponible.");
        Protocol.Require(Photos(db, tx, id).Length == 0 && Scalar<long>(db, tx, "SELECT COUNT(*) FROM Uploads WHERE SessionId=@id AND Status='Reserved' AND ExpiresAt>@now", ("id", id), ("now", Now)) == 0, 409, "photos_present", "Créez une nouvelle session pour changer de téléphone après un dépôt.");
        var token = Protocol.Token(); var expiry = Math.Min(session.ExpiresAt, Now + 120000);
        Execute(db, tx, "UPDATE Sessions SET State='AwaitingPairing',InviteHash=@hash,InviteExpiresAt=@expiry,PhoneVersion=@version,ConfirmationCode=NULL WHERE Id=@id", ("id", id), ("hash", Protocol.Hash(token)), ("expiry", expiry), ("version", Protocol.Token()));
        return (object)new { url = $"{options.PublicOrigin.TrimEnd('/')}/capture/{id}#invite={token}", expiresAt = DateTimeOffset.FromUnixTimeMilliseconds(expiry) };
    });
    public (SessionView View, PhoneGrant Grant) Pair(PairRequest request) => Transaction((db, tx) =>
    {
        var session = Get(db, tx, request.SessionId);
        Protocol.Require(session.State == "AwaitingPairing" && session.InviteExpiresAt > Now && request.Secret is not null && Protocol.EqualHash(session.InviteHash, request.Secret), 409, "invitation_invalid", "Invitation expirée, déjà utilisée ou invalide.");
        var code = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000, 1000000).ToString(System.Globalization.CultureInfo.InvariantCulture);
        Execute(db, tx, "UPDATE Sessions SET State='PendingConfirmation',InviteHash=NULL,ConfirmationCode=@code WHERE Id=@id", ("id", session.Id), ("code", code));
        return (View(db, tx, Get(db, tx, session.Id)), new PhoneGrant(session.Id, session.PhoneVersion, session.ExpiresAt / 1000));
    });
    public SessionView Confirm(string id, bool accept, Actor actor) => Transaction((db, tx) =>
    {
        var session = Get(db, tx, id); Owner(session, actor);
        Protocol.Require(session.State == "PendingConfirmation", 409, "invalid_state", "Aucun appairage à confirmer.");
        Execute(db, tx, "UPDATE Sessions SET State=@state,ConfirmationCode=NULL,PhoneVersion=@version WHERE Id=@id", ("id", id), ("state", accept ? "Capturing" : "AwaitingPairing"), ("version", accept ? session.PhoneVersion : Protocol.Token()));
        return View(db, tx, Get(db, tx, id));
    });
    public SessionView Cancel(string id, Actor actor) => Transaction((db, tx) =>
    {
        var session = Get(db, tx, id); Owner(session, actor);
        Protocol.Require(session.State is "AwaitingPairing" or "PendingConfirmation" or "Capturing", 409, "invalid_state", "Annulation indisponible.");
        Execute(db, tx, "UPDATE Sessions SET State='Cancelled',InviteHash=NULL WHERE Id=@id", ("id", id));
        return View(db, tx, Get(db, tx, id));
    });
    public ReservationView Reserve(string id, string uploadId, Actor actor) => Transaction((db, tx) =>
    {
        var session = Get(db, tx, id); Capturer(session, actor);
        Protocol.Require(Guid.TryParse(uploadId, out _), 400, "invalid_upload", "Identifiant d’envoi invalide.");
        Protocol.Require(Scalar<long>(db, tx, "SELECT COUNT(*) FROM Uploads WHERE SessionId=@id AND Id=@upload AND Status!='Reserved'", ("id", id), ("upload", uploadId)) == 0, 409, "upload_exists", "Cet identifiant d’envoi est déjà consommé.");
        Protocol.Require(Scalar<long>(db, tx, "SELECT COUNT(*) FROM Uploads WHERE SessionId=@id", ("id", id)) < 512, 429, "reservation_quota", "Limite totale d’envois atteinte. Créez une nouvelle session.");
        var occupied = Scalar<long>(db, tx, "SELECT COUNT(*) FROM Uploads WHERE SessionId=@id AND Id!=@upload AND (Status='Accepted' OR (Status='Reserved' AND ExpiresAt>@now))", ("id", id), ("upload", uploadId), ("now", Now));
        Protocol.Require(occupied < session.Policy.MaxPhotos, 409, "photo_quota", "Nombre maximal de photos ou réservations atteint.");
        var stored = Scalar<long>(db, tx, "SELECT COALESCE(SUM(Size),0) FROM Uploads WHERE Status='Accepted'");
        var reserved = Scalar<long>(db, tx, "SELECT COALESCE(SUM(json_extract(s.PolicyJson,'$.maxBytesPerPhoto')),0) FROM Uploads u JOIN Sessions s ON s.Id=u.SessionId WHERE u.Status='Reserved' AND u.ExpiresAt>@now AND NOT (u.SessionId=@id AND u.Id=@upload)", ("now", Now), ("id", id), ("upload", uploadId));
        Protocol.Require(stored + reserved + session.Policy.MaxBytesPerPhoto <= options.MaxStoredBytes, 507, "storage_quota", "Capacité de stockage atteinte.");
        var token = Protocol.Token(); var expiry = Math.Min(session.ExpiresAt, Now + 120000);
        Execute(db, tx, "INSERT INTO Uploads(SessionId,Id,AuthorizationHash,ExpiresAt,Status) VALUES(@id,@upload,@hash,@expires,'Reserved') ON CONFLICT(SessionId,Id) DO UPDATE SET AuthorizationHash=excluded.AuthorizationHash,ExpiresAt=excluded.ExpiresAt WHERE Uploads.Status='Reserved'", ("id", id), ("upload", uploadId), ("hash", Protocol.Hash(token)), ("expires", expiry));
        return new ReservationView(uploadId, token, DateTimeOffset.FromUnixTimeMilliseconds(expiry));
    });
    public CapturePolicy AuthorizeUpload(string id, Actor actor) => Transaction((db, tx) => { var session = Get(db, tx, id); Capturer(session, actor); return session.Policy; });
    public PhotoView Upload(string id, string uploadId, string authorization, byte[] bytes, Actor actor)
    {
        var hash = Protocol.Hash(bytes);
        string? movedPath = null; var committed = false;
        try
        {
            var result = Transaction((db, tx) =>
            {
                var session = Get(db, tx, id); Capturer(session, actor);
                Protocol.Require(bytes.LongLength <= session.Policy.MaxBytesPerPhoto, 413, "photo_too_large", "La photo dépasse la taille autorisée.");
                using var command = Command(db, tx, "SELECT AuthorizationHash,ExpiresAt,Status,Sha256,PhotoId FROM Uploads WHERE SessionId=@id AND Id=@upload", ("id", id), ("upload", uploadId));
                using var row = command.ExecuteReader();
                Protocol.Require(row.Read(), 403, "upload_authorization", "Autorisation de dépôt invalide.");
                var authHash = row.GetString(0); var expires = row.GetInt64(1); var status = row.GetString(2); var priorHash = row.IsDBNull(3) ? null : row.GetString(3); var photo = row.IsDBNull(4) ? null : row.GetString(4); row.Close();
                Protocol.Require(expires > Now && Protocol.EqualHash(authHash, authorization), 403, "upload_authorization", "Autorisation de dépôt expirée ou invalide.");
                if (status == "Accepted")
                {
                    Protocol.Require(priorHash == hash, 409, "upload_conflict", "Cet envoi a déjà été utilisé avec des octets différents.");
                    return Photos(db, tx, id).Single(p => p.Id == photo);
                }
                Protocol.Require(status == "Reserved", 409, "upload_deleted", "Cet envoi a été supprimé.");
                ValidateJpeg(bytes);
                var photoId = Protocol.Id();
                var path = Path.Combine(PhotoDirectory, photoId + ".jpg");
                var temporary = path + ".tmp";
                try
                {
                    using (var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, FileOptions.WriteThrough)) { file.Write(bytes); file.Flush(true); }
                    File.Move(temporary, path); movedPath = path;
                }
                finally { if (File.Exists(temporary)) File.Delete(temporary); }
                Execute(db, tx, "UPDATE Uploads SET Status='Accepted',PhotoId=@photo,Sha256=@hash,Size=@size,ReceivedAt=@now WHERE SessionId=@id AND Id=@upload", ("id", id), ("upload", uploadId), ("photo", photoId), ("hash", hash), ("size", bytes.LongLength), ("now", Now));
                return Photos(db, tx, id).Single(p => p.Id == photoId);
            });
            committed = true; return result;
        }
        finally { if (!committed && movedPath is not null && File.Exists(movedPath)) File.Delete(movedPath); }
    }
    private static void ValidateJpeg(byte[] bytes)
    {
        Protocol.Require(bytes.Length >= 4 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[^2] == 0xff && bytes[^1] == 0xd9, 415, "invalid_jpeg", "Un JPEG complet est requis.");
        using var data = SKData.CreateCopy(bytes); using var codec = SKCodec.Create(data);
        Protocol.Require(codec is not null && codec.EncodedFormat == SKEncodedImageFormat.Jpeg, 415, "invalid_jpeg", "Le décodeur refuse ce JPEG.");
        var info = codec!.Info;
        Protocol.Require(info.Width > 0 && info.Height > 0 && info.Width <= 8192 && info.Height <= 8192 && (long)info.Width * info.Height <= 12000000, 413, "image_dimensions", "Dimensions ou nombre de pixels trop élevés.");
        using var bitmap = new SKBitmap(new SKImageInfo(info.Width, info.Height, SKColorType.Bgra8888, SKAlphaType.Opaque));
        Protocol.Require(codec.GetPixels(bitmap.Info, bitmap.GetPixels()) == SKCodecResult.Success, 415, "invalid_jpeg", "Le JPEG ne peut pas être décodé complètement.");
    }
    public void DeletePhoto(string id, string photoId, Actor actor)
    {
        Transaction((db, tx) =>
        {
            var session = Get(db, tx, id); Capturer(session, actor);
            Protocol.Require(Execute(db, tx, "UPDATE Uploads SET Status='Deleted' WHERE SessionId=@id AND PhotoId=@photo AND Status='Accepted'", ("id", id), ("photo", photoId)) == 1, 404, "not_found", "Photo introuvable.");
            return true;
        });
        // A crash after commit leaves an orphan, which the janitor removes; no available row points at a missing file.
        if (Guid.TryParse(photoId, out _)) File.Delete(Path.Combine(PhotoDirectory, photoId + ".jpg"));
    }
    public string FinalizeSession(string id, Actor actor) => Transaction((db, tx) =>
    {
        var session = Get(db, tx, id);
        Protocol.Require(HasPhone(session, actor), 403, "phone_required", "Une autorisation de capture est requise.");
        if (session.State == "Finalized") return session.ReceiptJws!;
        Capturer(session, actor);
        var photos = Photos(db, tx, id);
        Protocol.Require(photos.Length >= session.Policy.MinPhotos && photos.Length <= session.Policy.MaxPhotos, 409, "photo_count", "Le nombre de photos ne respecte pas la règle.");
        Protocol.Require(Scalar<long>(db, tx, "SELECT COUNT(*) FROM Uploads WHERE SessionId=@id AND Status='Reserved' AND ExpiresAt>@now", ("id", id), ("now", Now)) == 0, 409, "uploads_pending", "Un dépôt est encore réservé ou en cours.");
        foreach (var photo in photos) Protocol.Require(File.Exists(Path.Combine(PhotoDirectory, photo.Id + ".jpg")), 503, "storage_unavailable", "Un fichier de référence est indisponible.");
        var payload = JsonSerializer.Serialize(new
        {
            schemaVersion = 1, issuer = "CaptureProof demo", receiptId = Protocol.Id(), sessionId = id, context = session.Context,
            finalizedAt = clock.GetUtcNow(), policy = session.Policy, photoCount = photos.Length,
            files = photos.Select(p => new { p.Id, p.Sha256, p.Size, p.ContentType, p.ReceivedAt }),
            guarantees = new { integrity = true, hardwareCameraAttested = false, aiOriginAssessed = false }
        }, Protocol.Json);
        var jws = signer.Sign(payload);
        Execute(db, tx, "UPDATE Sessions SET State='Finalized',ReceiptJws=@jws,PayloadJson=@payload,InviteHash=NULL WHERE Id=@id", ("id", id), ("jws", jws), ("payload", payload));
        return jws;
    });
    public string Receipt(string id, Actor actor) => Transaction((db, tx) =>
    {
        var session = Get(db, tx, id); Reader(session, actor);
        Protocol.Require(session.ReceiptJws is not null, 409, "not_finalized", "Le reçu sera disponible après validation.");
        return session.ReceiptJws!;
    });
    public string PhotoPath(string id, string photoId, Actor actor) => Transaction((db, tx) =>
    {
        var session = Get(db, tx, id); Reader(session, actor);
        Protocol.Require(Photos(db, tx, id).Any(p => p.Id == photoId), 404, "not_found", "Photo introuvable.");
        var path = Path.Combine(PhotoDirectory, photoId + ".jpg");
        Protocol.Require(File.Exists(path), 503, "storage_unavailable", "Fichier indisponible."); return path;
    });
    public void Cleanup()
    {
        Transaction((db, tx) =>
        {
            Execute(db, tx, "UPDATE Sessions SET State='Expired',InviteHash=NULL WHERE ExpiresAt<=@now AND State NOT IN ('Finalized','Cancelled','Expired')", ("now", Now));
            Execute(db, tx, "DELETE FROM Sessions WHERE CreatedAt<@cutoff", ("cutoff", Now - options.RetentionHours * 3600000L));
            return true;
        });
        Transaction((db, tx) =>
        {
            var active = new HashSet<string>(StringComparer.Ordinal);
            using (var command = Command(db, tx, "SELECT PhotoId FROM Uploads WHERE Status='Accepted'"))
            using (var rows = command.ExecuteReader()) while (rows.Read()) active.Add(rows.GetString(0) + ".jpg");
            // The same SQLite write lock protects file moves in Upload against concurrent cleanup.
            foreach (var path in Directory.EnumerateFiles(PhotoDirectory))
                if (!active.Contains(Path.GetFileName(path))) File.Delete(path);
            return true;
        });
    }
}
