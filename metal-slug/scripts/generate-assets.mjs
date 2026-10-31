import { fal } from "@fal-ai/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const file = path.join(root, ".env");
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function redact(value) {
  let s = String(value?.stack || value?.message || value);
  for (const key of [process.env.FAL_KEY, process.env.ELEVENLABS_API_KEY, process.env.GEMINI_API_KEY]) {
    if (key) s = s.split(key).join("[key]");
  }
  return s.slice(0, 500);
}

function exists(rel, minBytes) {
  const file = path.join(root, rel);
  return fs.existsSync(file) && fs.statSync(file).size >= minBytes;
}

function save(rel, buf) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = `${file}.part`;
  fs.writeFileSync(part, buf);
  fs.renameSync(part, file);
  console.log("salvo", rel, buf.length);
}

async function download(url, rel) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${rel}`);
  save(rel, Buffer.from(await res.arrayBuffer()));
}

async function uploadLocal(rel, type) {
  const buf = fs.readFileSync(path.join(root, rel));
  const file = new File([new Uint8Array(buf)], path.basename(rel), { type });
  return fal.storage.upload(file);
}

function firstUrl(data) {
  if (!data || typeof data !== "object") return "";
  return (
    data.model_glb?.url ||
    data.model_urls?.glb?.url ||
    data.model_mesh?.url ||
    data.image?.url ||
    data.images?.[0]?.url ||
    ""
  );
}

async function subscribe(endpoint, input) {
  console.log("fal", endpoint);
  const result = await fal.subscribe(endpoint, {
    input,
    logs: true,
    onQueueUpdate(update) {
      if (update.status === "IN_PROGRESS") {
        for (const log of update.logs ?? []) {
          if (log.message) console.log(" ", log.message.slice(0, 180));
        }
      } else if (update.status) {
        console.log(" ", update.status);
      }
    },
  });
  const url = firstUrl(result.data);
  if (!url) throw new Error(`sem arquivo em ${endpoint}`);
  return url;
}

async function genImage(prompt, aspect, format) {
  try {
    return await subscribe("fal-ai/nano-banana", {
      prompt,
      aspect_ratio: aspect,
      num_images: 1,
      output_format: format,
    });
  } catch (err) {
    console.log("imagem alternativa", redact(err));
    const size = aspect === "9:16" ? "portrait_16_9" : aspect === "1:1" ? "square_hd" : "landscape_16_9";
    return subscribe("fal-ai/flux/dev", {
      prompt,
      image_size: size,
      num_images: 1,
      output_format: format,
      num_inference_steps: 28,
      guidance_scale: 3.5,
    });
  }
}

async function ensurePlayer() {
  if (exists("public/models/player.glb", 20_000)) {
    console.log("modelo do piloto já existe");
    return;
  }
  const imageUrl = await uploadLocal("jogador.jpg", "image/jpeg");
  let url = "";
  try {
    url = await subscribe("fal-ai/hunyuan3d-v3/image-to-3d", {
      input_image_url: imageUrl,
      generate_type: "LowPoly",
      enable_pbr: false,
    });
  } catch (err) {
    console.log("lowpoly indisponível", redact(err));
    url = await subscribe("fal-ai/hunyuan3d-v3/image-to-3d", {
      input_image_url: imageUrl,
      generate_type: "Normal",
      enable_pbr: false,
    });
  }
  await download(url, "public/models/player.glb");
}

const ENEMY_PROMPT =
  "Photoreal full-body side profile of one adult man walking left, mid stride, facing left. He wears a vivid scarlet red short-sleeve t-shirt, dark jeans and brown boots. Short dark hair, calm face, arms swinging, both feet visible, nothing cropped. Isolated on a flat solid light beige background. Studio lighting, sharp focus, no text, no logo, no weapon, no extra people.";

const ALLY_PROMPT =
  "Change only the scarlet t-shirt into a vivid green football shirt with a broad yellow horizontal stripe across the chest, green and yellow like the Brazilian flag. Keep the exact same person, face, hair, walking pose, jeans, boots, lighting and plain beige background. Do not add text, logos, flags, weapons or extra people.";

async function ensurePictures() {
  const jobs = [];
  if (!exists("public/tex/enemy-raw.jpg", 10_000)) {
    jobs.push(
      genImage(ENEMY_PROMPT, "9:16", "jpeg").then((url) => download(url, "public/tex/enemy-raw.jpg")),
    );
  }
  if (!exists("public/tex/sky.jpg", 10_000)) {
    jobs.push(
      genImage(
        "Wide empty desert sky, soft warm beige haze, pale dust in the air, no sun disk, no clouds shaped like objects, no people, no animals, no text, cinematic afternoon, smooth gradient",
        "16:9",
        "jpeg",
      ).then((url) => download(url, "public/tex/sky.jpg")),
    );
  }
  if (!exists("public/tex/dunes.jpg", 10_000)) {
    jobs.push(
      genImage(
        "Wide side-view distant desert dunes, soft tan and warm brown sand, hazy air, empty horizon in the lower third, no people, no animals, no vehicles, no text, painterly cinematic game background",
        "16:9",
        "jpeg",
      ).then((url) => download(url, "public/tex/dunes.jpg")),
    );
  }
  if (!exists("public/tex/sand.jpg", 10_000)) {
    jobs.push(
      genImage(
        "Seamless tileable top-down texture of dry cracked desert sand, warm ochre and tan, even lighting, no objects, no footprints, no text, photoreal",
        "1:1",
        "jpeg",
      ).then((url) => download(url, "public/tex/sand.jpg")),
    );
  }
  await Promise.all(jobs);

  if (!exists("public/tex/ally-raw.jpg", 10_000)) {
    const src = await uploadLocal("public/tex/enemy-raw.jpg", "image/jpeg");
    const url = await subscribe("fal-ai/nano-banana/edit", {
      prompt: ALLY_PROMPT,
      image_urls: [src],
      num_images: 1,
      aspect_ratio: "auto",
      output_format: "jpeg",
      limit_generations: true,
    });
    await download(url, "public/tex/ally-raw.jpg");
  }

  const cuts = [];
  if (!exists("public/tex/enemy.png", 5_000)) {
    cuts.push(cutout("public/tex/enemy-raw.jpg", "public/tex/enemy.png"));
  }
  if (!exists("public/tex/ally.png", 5_000)) {
    cuts.push(cutout("public/tex/ally-raw.jpg", "public/tex/ally.png"));
  }
  await Promise.all(cuts);
}

async function cutout(srcRel, destRel) {
  const imageUrl = await uploadLocal(srcRel, "image/jpeg");
  const url = await subscribe("fal-ai/birefnet", {
    image_url: imageUrl,
    model: "General Use (Heavy)",
    operating_resolution: "1024x1024",
    output_format: "png",
    refine_foreground: true,
  });
  await download(url, destRel);
}

async function sound(text, seconds, rel) {
  if (exists(rel, 1_000)) {
    console.log("áudio já existe", rel);
    return;
  }
  const body = {
    text,
    duration_seconds: seconds,
    prompt_influence: 0.35,
    model_id: "eleven_text_to_sound_v2",
  };
  let res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status === 422) {
    delete body.model_id;
    res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(body),
    });
  }
  if (!res.ok) throw new Error(`som ${res.status} ${redact(await res.text())}`);
  save(rel, Buffer.from(await res.arrayBuffer()));
}

async function voice(rel) {
  if (exists(rel, 1_000)) {
    console.log("voz já existe");
    return;
  }
  const list = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
  });
  if (!list.ok) throw new Error(`vozes ${list.status}`);
  const data = await list.json();
  const voices = data.voices ?? [];
  const br = voices.find((v) => /portug|brazil|brasil/i.test(`${v.name} ${JSON.stringify(v.labels ?? {})}`));
  const male = voices.find((v) => /adam|antoni|josh|daniel|charlie/i.test(v.name ?? ""));
  const chosen = br || male || voices[0];
  if (!chosen?.voice_id) throw new Error("nenhuma voz");
  console.log("voz", chosen.name);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${chosen.voice_id}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: "Agora eu estou com vocês!",
      model_id: "eleven_multilingual_v2",
    }),
  });
  if (!res.ok) throw new Error(`fala ${res.status} ${redact(await res.text())}`);
  save(rel, Buffer.from(await res.arrayBuffer()));
}

async function ensureAudio() {
  await Promise.all([
    sound("Single short punchy arcade energy blaster shot, bright purple laser, one hit, no voice, no music", 1.1, "public/audio/shot.mp3"),
    sound("Short magical friendly transformation, soft whoosh then a bright chime, green and gold, no voice", 1.4, "public/audio/convert.mp3"),
    sound("Short cartoon dinosaur roar, medium, powerful but not horror, one roar, no music", 1.6, "public/audio/roar.mp3"),
    sound("Light looping desert percussion, soft hand drums and shaker, playful arcade, no vocals, seamless feel", 8, "public/audio/music.mp3"),
    voice("public/audio/friend.mp3"),
  ]);
}

loadEnv();
if (!process.env.FAL_KEY) throw new Error("FAL_KEY ausente");
if (!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY ausente");
fal.config({ credentials: process.env.FAL_KEY });

fs.mkdirSync(path.join(root, "public"), { recursive: true });
if (!exists("public/jogador.jpg", 10_000)) {
  fs.copyFileSync(path.join(root, "jogador.jpg"), path.join(root, "public/jogador.jpg"));
  console.log("capa do piloto copiada");
}

const results = await Promise.allSettled([ensurePlayer(), ensurePictures(), ensureAudio()]);
let failed = false;
for (const result of results) {
  if (result.status === "rejected") {
    failed = true;
    console.error(redact(result.reason));
  }
}
if (failed) process.exitCode = 1;
else console.log("assets prontos");
