"use client";

/**
 * Last-resort boundary for errors in the root layout itself. It renders its own
 * <html> outside every provider and stylesheet, so it uses plain inline styles.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#fafafa", color: "#171717" }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>The application failed to load</h1>
          <p style={{ fontSize: 14, color: "#525252", margin: 0 }}>The error has been logged{error.digest ? ` (reference ${error.digest})` : ""}.</p>
          <button onClick={reset} style={{ marginTop: 24, padding: "8px 16px", borderRadius: 8, border: 0, background: "#3730a3", color: "#fff", fontSize: 14, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
