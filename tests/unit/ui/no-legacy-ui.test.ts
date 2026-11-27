import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Guards the v2 redesign: every page uses the shadcn system, none of the v1 hand-rolled styling. */
const SRC = path.resolve("src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") || p.endsWith(".ts") ? [p] : [];
  });
}

const LEGACY_CLASS = /className=\{?["`][^"`]*\b(btn|btn-primary|btn-secondary|btn-danger|btn-sm|input|link)\b/;
const LEGACY_TABLE = /className="data"/;
const LEGACY_IMPORT = /from "@\/components\/(ui|forms)"/;

describe("no v1 UI left", () => {
  const sources = files(SRC).filter((f) => !f.includes(`${path.sep}components${path.sep}ui${path.sep}`));

  it.each(sources.map((f) => [path.relative(SRC, f), f]))("%s uses no v1 classes or modules", (_rel, file) => {
    const text = readFileSync(file, "utf8");
    expect(text).not.toMatch(LEGACY_CLASS);
    expect(text).not.toMatch(LEGACY_TABLE);
    expect(text).not.toMatch(LEGACY_IMPORT);
  });

  it("the v1 component modules are gone", () => {
    expect(existsSync(path.join(SRC, "components/ui.tsx"))).toBe(false);
    expect(existsSync(path.join(SRC, "components/forms.tsx"))).toBe(false);
  });

  it("the v1 global CSS classes are gone", () => {
    const css = readFileSync(path.join(SRC, "app/globals.css"), "utf8");
    expect(css).not.toMatch(/^\.(btn|input|link)\b/m);
    expect(css).not.toMatch(/table\.data/);
  });
});
