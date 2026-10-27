// Try the extraction on local files without WhatsApp or Excel:
//   ANTHROPIC_API_KEY=... bun run extract path/to/screenshot.jpg [more files]
import { readFileSync } from "node:fs";
import { extractDeals } from "./extract";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: bun run extract <image-or-pdf> [...]");
  process.exit(1);
}

const media = files.map((f) => ({
  mediaType: TYPES[f.split(".").pop()!.toLowerCase()] ?? "image/jpeg",
  data: readFileSync(f),
}));
console.log(
  JSON.stringify(await extractDeals({ media, text: "", messageDate: new Date() }), null, 2),
);
