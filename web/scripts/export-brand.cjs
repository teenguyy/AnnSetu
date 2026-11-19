// Writes the AnnSetu brand variants to public/brand (SVG) and renders PNGs with Playwright.
// Usage: node scripts/export-brand.cjs
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const out = path.join(__dirname, "..", "public", "brand");
const WAVE = "M8 70 C 26 52, 48 54, 74 78 C 88 90, 104 88, 114 72";

function mark({ pylon, cable, deck, node = "#FFE28A", nodeStroke = "#102F46" }) {
  return `
  <g stroke="${cable}" stroke-width="1.6" stroke-linecap="round">
    <path d="M63 16 L22 66"/><path d="M63 16 L33 62"/><path d="M63 16 L44 60"/>
    <path d="M66 16 L84 66"/><path d="M66 16 L95 72"/><path d="M66 16 L105 78"/>
  </g>
  <g fill="${pylon}">
    <path d="M58 10 h7 L35 100 h-7 Z"/><path d="M62 10 h12 L90 100 h-13 Z"/>
    <rect x="20" y="99" width="24" height="4.5" rx="1"/><rect x="72" y="99" width="27" height="4.5" rx="1"/>
  </g>
  <path d="${WAVE}" fill="none" stroke="${deck}" stroke-width="7" stroke-linecap="round"/>
  <circle cx="74" cy="78" r="6.5" fill="${node}" stroke="${nodeStroke}" stroke-width="3"/>`;
}

const variants = {
  color: { pylon: "#164B70", cable: "#287FA6", deck: "#287FA6" },
  reverse: { pylon: "#F4ECD8", cable: "#82C5DF", deck: "#82C5DF" },
  mono: { pylon: "#102F46", cable: "#102F46", deck: "#102F46", node: "none", nodeStroke: "#102F46" },
};

const svg = (inner, vb = "0 0 120 120") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>\n`;
const write = (name, content) => fs.writeFileSync(path.join(out, name), content);

write("logo-mark.svg", svg(mark(variants.color)));
write("logo-mark-reverse.svg", svg(mark(variants.reverse)));
write("logo-mark-mono.svg", svg(mark(variants.mono)));
const tile = (size = 120) => `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#102F46"/>`;
write("favicon.svg", svg(`${tile()}<g transform="translate(10 8) scale(.84)">${mark(variants.reverse)}</g>`));

function full(dark) {
  return svg(
    `${dark ? '<rect width="460" height="140" rx="24" fill="#102F46"/>' : ""}
    <g transform="translate(14 10)">${mark(dark ? variants.reverse : variants.color)}</g>
    <path d="M150 44 C 200 26, 280 26, 330 36" fill="none" stroke="#FFE28A" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M336 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#FFE28A"/>
    <text x="148" y="88" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="600" font-size="52">
      <tspan fill="${dark ? "#F4ECD8" : "#102F46"}">Ann</tspan><tspan fill="${dark ? "#FFE28A" : "#164B70"}">Setu</tspan>
    </text>
    <text x="150" y="116" font-family="'Space Grotesk', Arial, sans-serif" font-size="12.5" letter-spacing="4.2" fill="${dark ? "#A8D9E9" : "#3A5C74"}">CONNECT · SHARE · NOURISH</text>`,
    "0 0 460 140",
  );
}
write("logo-full.svg", full(false));
write("logo-full-reverse.svg", full(true));
// Android adaptive icon: foreground inside the 66% safe zone, background colour separate
write("android-adaptive-foreground.svg", svg(`<g transform="translate(25 24) scale(.58)">${mark(variants.reverse)}</g>`, "0 0 120 120"));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const png = async (file, w, h, html) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><body style="margin:0">${html}</body></html>`);
    await page.screenshot({ path: path.join(out, file), omitBackground: true });
  };
  const img = (f, s) => `<img src="data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(path.join(out, f))).toString("base64")}" style="${s}">`;
  await png("apple-touch-icon.png", 180, 180, img("favicon.svg", "width:180px;height:180px;display:block"));
  await png("icon-512.png", 512, 512, img("favicon.svg", "width:512px;height:512px;display:block"));
  await png("android-adaptive-foreground.png", 432, 432, img("android-adaptive-foreground.svg", "width:432px;height:432px;display:block"));
  await png(
    "og.png",
    1200,
    630,
    `<div style="width:1200px;height:630px;background:#102F46;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box;font-family:Georgia,serif;color:#F4ECD8">
      ${img("logo-full-reverse.svg", "width:520px")}
      <div style="font-size:68px;line-height:1.05;margin-top:40px;font-weight:600">Good food deserves a<br><i style="color:#FFE28A">second journey.</i></div>
    </div>`,
  );
  await browser.close();
  console.log("brand assets written to", out);
})();
