import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Door 2: a etiqueta é impressa uma vez e vive na prateleira, então o gerador do QR não pode
// mudar por baixo num `npm install`. Versão exata, sem `^` nem `~` (regra do AGENTS.md).
describe("qrcode.react dependency", () => {
  it("pins qrcode.react to an exact version", () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };

    expect(manifest.dependencies?.["qrcode.react"]).toBe("4.2.0");
  });
});
