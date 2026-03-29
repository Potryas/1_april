const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const docsDir = path.join(rootDir, "docs");
const outputFile = path.join(rootDir, "Choir-Standalone.html");

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".png") return "image/png";
  if (ext === ".json") return "application/json";
  return "application/octet-stream";
}

function toDataUri(filePath) {
  const buffer = fs.readFileSync(filePath);
  return `data:${getMimeType(filePath)};base64,${buffer.toString("base64")}`;
}

function collectAssets(dir) {
  const map = {};

  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        const relativePath = `./${path.relative(docsDir, fullPath).replace(/\\/g, "/")}`;
        map[relativePath] = toDataUri(fullPath);
      }
    }
  };

  walk(path.join(docsDir, "assets"));
  return map;
}

function buildStandaloneHtml() {
  const html = fs.readFileSync(path.join(docsDir, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(docsDir, "styles.css"), "utf8");
  const js = fs.readFileSync(path.join(docsDir, "app.js"), "utf8");
  const visemes = fs.readFileSync(path.join(docsDir, "visemes.json"), "utf8");
  const assetMap = collectAssets(docsDir);
  const inlineAssetPath = (source) => assetMap[source] || source;
  const inlineQuotedAssets = (source) =>
    source.replace(/(["'])(\.\/assets\/[^"']+)\1/g, (match, quote, assetPath) => {
      const replacement = inlineAssetPath(assetPath);
      return `${quote}${replacement}${quote}`;
    });

  const inlinedHtml = html.replace(
    /(src|href)="(\.\/assets\/[^"]+)"/g,
    (match, attribute, assetPath) => `${attribute}="${inlineAssetPath(assetPath)}"`,
  );

  const inlinedJs = inlineQuotedAssets(js);

  let output = inlinedHtml;
  output = output.replace(
    '<link rel="stylesheet" href="./styles.css" />',
    `<style>\n${css}\n</style>`,
  );

  output = output.replace(
    '<script src="./app.js" type="module"></script>',
    `<script>\nwindow.__CHOIR_ASSET_MAP__ = {};\nwindow.__CHOIR_VISEMES__ = ${visemes};\n</script>\n<script type="module">\n${inlinedJs}\n</script>`,
  );

  fs.writeFileSync(outputFile, output, "utf8");
}

buildStandaloneHtml();
console.log(`Built standalone file: ${outputFile}`);
