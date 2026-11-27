"use client";

/** Last-resort boundary for errors in the root layout itself. Must render its own <html>. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem", textAlign: "center" }}>
        <h1>The application failed to load</h1>
        <p>The error has been logged{error.digest ? ` (ref ${error.digest})` : ""}.</p>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
