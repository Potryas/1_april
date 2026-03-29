const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const sharp = require("sharp");
const ffmpegPath = require("ffmpeg-static");

const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "docs");

const audioFiles = [
  "Audio/Character_1_Rhytm_track.wav",
  "Audio/Character_2_High_voice_track.wav",
  "Audio/Character_3_Bass_track.wav",
  "Audio/Character_4_Mid_voice_track.wav",
];

const imageFiles = [
  "BG.png",
  "Characters/Character_1/Tsoi_0_main.png",
  "Characters/Character_1/Tsoi_1.png",
  "Characters/Character_1/Tsoi_2.png",
  "Characters/Character_1/Tsoi_3.png",
  "Characters/Character_1/Tsoi_4.png",
  "Characters/Character_2/July_0_main.png",
  "Characters/Character_2/July_1.png",
  "Characters/Character_2/July_2.png",
  "Characters/Character_2/July_3.png",
  "Characters/Character_2/July_4.png",
  "Characters/Character_3/Jakl_0_main.png",
  "Characters/Character_3/Jakl_1.png",
  "Characters/Character_3/Jakl_2.png",
  "Characters/Character_3/Jakl_3.png",
  "Characters/Character_3/Jakl_4.png",
  "Characters/Character_3/Jakl_5.png",
  "Characters/Character_4/Gavr_0_main.png",
  "Characters/Character_4/Gavr_1.png",
  "Characters/Character_4/Gavr_2.png",
  "Characters/Character_4/Gavr_3.png",
];

const textFiles = ["index.html", "app.js", "styles.css", "visemes.json"];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanOutDir() {
  fs.rmSync(outDir, { recursive: true, force: true });
  ensureDir(outDir);
}

function rewriteAssetPaths(input) {
  return input
    .replaceAll("./BG.png", "./assets/BG.webp")
    .replaceAll("./Audio/", "./assets/audio/")
    .replaceAll(".wav", ".ogg")
    .replaceAll("./Characters/", "./assets/characters/")
    .replaceAll(".png", ".webp");
}

function copyTextFiles() {
  for (const relativePath of textFiles) {
    const src = path.join(rootDir, relativePath);
    const dest = path.join(outDir, relativePath);
    let text = fs.readFileSync(src, "utf8");
    if (/\.(html|js|css)$/i.test(relativePath)) {
      text = rewriteAssetPaths(text);
    }
    fs.writeFileSync(dest, text, "utf8");
  }

  fs.writeFileSync(path.join(outDir, ".nojekyll"), "", "utf8");
}

async function convertImages() {
  for (const relativePath of imageFiles) {
    const src = path.join(rootDir, relativePath);
    const outRelative = relativePath
      .replace(/^Characters\//, "assets/characters/")
      .replace(/^BG\.png$/, "assets/BG.webp")
      .replace(/\.png$/i, ".webp");
    const dest = path.join(outDir, outRelative);

    ensureDir(path.dirname(dest));

    const image = sharp(src);
    const metadata = await image.metadata();
    let pipeline = image;

    if (relativePath === "BG.png" && metadata.width && metadata.width > 1920) {
      pipeline = pipeline.resize({ width: 1920 });
    } else if (metadata.width && metadata.width > 1200) {
      pipeline = pipeline.resize({ width: 1200 });
    }

    await pipeline.webp({ quality: 84, effort: 6 }).toFile(dest);
  }
}

function convertAudio() {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static not available");
  }

  for (const relativePath of audioFiles) {
    const src = path.join(rootDir, relativePath);
    const outRelative = relativePath
      .replace(/^Audio\//, "assets/audio/")
      .replace(/\.wav$/i, ".ogg");
    const dest = path.join(outDir, outRelative);

    ensureDir(path.dirname(dest));

    const result = spawnSync(
      ffmpegPath,
      [
        "-y",
        "-i",
        src,
        "-c:a",
        "libvorbis",
        "-q:a",
        "4",
        dest,
      ],
      { stdio: "inherit" },
    );

    if (result.status !== 0) {
      throw new Error(`ffmpeg failed for ${relativePath}`);
    }
  }
}

function printSummary() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        files.push(full);
      }
    }
  };

  walk(outDir);

  const totalBytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  console.log(`Built docs output: ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MB total`);
}

async function main() {
  cleanOutDir();
  copyTextFiles();
  await convertImages();
  convertAudio();
  printSummary();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
