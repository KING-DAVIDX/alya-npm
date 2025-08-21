const fs = require("fs");
const { tmpdir } = require("os");
const Crypto = require("crypto");
const ff = require("fluent-ffmpeg");
const webp = require("node-webpmux");
const path = require("path");
const FormData = require("form-data");
const { JSDOM } = require("jsdom");
const fetch = require("node-fetch");
const { validateParameters } = require('./utils');

// Global variables for temporary files
let tmpFileIn, tmpFileOut;

/**
 * Clean up temporary files
 */
function cleanupTmpFiles() {
  try {
    if (tmpFileIn && fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn);
    if (tmpFileOut && fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut);
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
}

/**
 * Generate random temporary file paths
 * @param {string} extension - File extension
 * @returns {Object} Object with tmpFileIn and tmpFileOut paths
 */
function generateTmpPaths(extension = 'webp') {
  const randomString = Crypto.randomBytes(6).readUIntLE(0, 6).toString(36);
  return {
    tmpFileIn: path.join(tmpdir(), `${randomString}_in.${extension}`),
    tmpFileOut: path.join(tmpdir(), `${randomString}_out.${extension}`)
  };
}

/**
 * Convert image to WebP format
 * @param {Buffer} media - Image buffer to convert
 * @returns {Promise<Buffer>} WebP buffer
 */
async function imageToWebp(media) {
  let tmpPaths;
  try {
    validateParameters({
      media: { value: media, required: true, type: 'buffer' }
    });

    tmpPaths = generateTmpPaths();
    tmpFileIn = tmpPaths.tmpFileIn.replace('.webp', '.jpg');
    tmpFileOut = tmpPaths.tmpFileOut;

    fs.writeFileSync(tmpFileIn, media);

    await new Promise((resolve, reject) => {
      ff(tmpFileIn)
        .on("error", (err) => reject(err))
        .on("end", () => resolve(true))
        .addOutputOptions([
          "-vcodec", "libwebp",
          "-vf", "scale='min(320,iw)':'min(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse"
        ])
        .toFormat("webp")
        .save(tmpFileOut);
    });

    const buff = fs.readFileSync(tmpFileOut);
    return buff;
  } catch (error) {
    throw new Error(`imageToWebp Error: ${error.message}`);
  } finally {
    cleanupTmpFiles();
  }
}

/**
 * Convert video to WebP format
 * @param {Buffer} media - Video buffer to convert
 * @returns {Promise<Buffer>} WebP buffer
 */
async function videoToWebp(media) {
  let tmpPaths;
  try {
    validateParameters({
      media: { value: media, required: true, type: 'buffer' }
    });

    tmpPaths = generateTmpPaths();
    tmpFileIn = tmpPaths.tmpFileIn.replace('.webp', '.mp4');
    tmpFileOut = tmpPaths.tmpFileOut;

    fs.writeFileSync(tmpFileIn, media);

    await new Promise((resolve, reject) => {
      ff(tmpFileIn)
        .on("error", (err) => reject(err))
        .on("end", () => resolve(true))
        .addOutputOptions([
          "-vcodec", "libwebp",
          "-vf", "scale='min(320,iw)':'min(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
          "-loop", "0",
          "-ss", "00:00:00",
          "-t", "00:00:05",
          "-preset", "default",
          "-an",
          "-vsync", "0"
        ])
        .toFormat("webp")
        .save(tmpFileOut);
    });

    const buff = fs.readFileSync(tmpFileOut);
    return buff;
  } catch (error) {
    throw new Error(`videoToWebp Error: ${error.message}`);
  } finally {
    cleanupTmpFiles();
  }
}

/**
 * Add metadata to image-based WebP sticker
 * @param {Buffer} media - Image buffer
 * @param {Object} metadata - Sticker metadata
 * @param {string} metadata.packname - Sticker pack name
 * @param {string} metadata.author - Sticker author
 * @param {string[]} metadata.categories - Sticker categories
 * @returns {Promise<Buffer>} WebP buffer with metadata
 */
async function writeExifImg(media, metadata = {}) {
  let tmpPaths;
  try {
    validateParameters({
      media: { value: media, required: true, type: 'buffer' },
      metadata: { value: metadata, type: 'object' }
    });

    let wMedia = await imageToWebp(media);
    tmpPaths = generateTmpPaths();
    tmpFileIn = tmpPaths.tmpFileIn;
    tmpFileOut = tmpPaths.tmpFileOut;
    
    fs.writeFileSync(tmpFileIn, wMedia);

    if (metadata.packname || metadata.author) {
      const img = new webp.Image();
      const json = {
        "sticker-pack-id": `https://github.com/KING-DAVIDX`,
        "sticker-pack-name": metadata.packname || "",
        "sticker-pack-publisher": metadata.author || "",
        emojis: metadata.categories ? metadata.categories : [""],
      };
      const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
        0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
      ]);
      const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
      const exif = Buffer.concat([exifAttr, jsonBuff]);
      exif.writeUIntLE(jsonBuff.length, 14, 4);
      await img.load(tmpFileIn);
      img.exif = exif;
      await img.save(tmpFileOut);
      
      const result = fs.readFileSync(tmpFileOut);
      return result;
    }
    
    return wMedia;
  } catch (error) {
    throw new Error(`writeExifImg Error: ${error.message}`);
  } finally {
    cleanupTmpFiles();
  }
}

/**
 * Add metadata to video-based WebP sticker
 * @param {Buffer} media - Video buffer
 * @param {Object} metadata - Sticker metadata
 * @param {string} metadata.packname - Sticker pack name
 * @param {string} metadata.author - Sticker author
 * @param {string[]} metadata.categories - Sticker categories
 * @returns {Promise<Buffer>} WebP buffer with metadata
 */
async function writeExifVid(media, metadata = {}) {
  let tmpPaths;
  try {
    validateParameters({
      media: { value: media, required: true, type: 'buffer' },
      metadata: { value: metadata, type: 'object' }
    });

    let wMedia = await videoToWebp(media);
    tmpPaths = generateTmpPaths();
    tmpFileIn = tmpPaths.tmpFileIn;
    tmpFileOut = tmpPaths.tmpFileOut;
    
    fs.writeFileSync(tmpFileIn, wMedia);

    if (metadata.packname || metadata.author) {
      const img = new webp.Image();
      const json = {
        "sticker-pack-id": `https://github.com/KING-DAVIDX`,
        "sticker-pack-name": metadata.packname || "",
        "sticker-pack-publisher": metadata.author || "",
        emojis: metadata.categories ? metadata.categories : [""],
      };
      const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
        0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
      ]);
      const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
      const exif = Buffer.concat([exifAttr, jsonBuff]);
      exif.writeUIntLE(jsonBuff.length, 14, 4);
      await img.load(tmpFileIn);
      img.exif = exif;
      await img.save(tmpFileOut);
      
      const result = fs.readFileSync(tmpFileOut);
      return result;
    }
    
    return wMedia;
  } catch (error) {
    throw new Error(`writeExifVid Error: ${error.message}`);
  } finally {
    cleanupTmpFiles();
  }
}

/**
 * Add metadata to existing WebP sticker
 * @param {Buffer} media - WebP buffer
 * @param {Object} metadata - Sticker metadata
 * @param {string} metadata.packname - Sticker pack name
 * @param {string} metadata.author - Sticker author
 * @param {string[]} metadata.categories - Sticker categories
 * @returns {Promise<Buffer>} WebP buffer with metadata
 */
async function writeExifWebp(media, metadata = {}) {
  let tmpPaths;
  try {
    validateParameters({
      media: { value: media, required: true, type: 'buffer' },
      metadata: { value: metadata, type: 'object' }
    });

    tmpPaths = generateTmpPaths();
    tmpFileIn = tmpPaths.tmpFileIn;
    tmpFileOut = tmpPaths.tmpFileOut;
    
    fs.writeFileSync(tmpFileIn, media);

    if (metadata.packname || metadata.author) {
      const img = new webp.Image();
      const json = {
        "sticker-pack-id": `https://github.com/KING-DAVIDX`,
        "sticker-pack-name": metadata.packname || "",
        "sticker-pack-publisher": metadata.author || "",
        emojis: metadata.categories ? metadata.categories : [""],
      };
      const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
        0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
      ]);
      const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
      const exif = Buffer.concat([exifAttr, jsonBuff]);
      exif.writeUIntLE(jsonBuff.length, 14, 4);
      await img.load(tmpFileIn);
      img.exif = exif;
      await img.save(tmpFileOut);
      
      const result = fs.readFileSync(tmpFileOut);
      return result;
    }
    
    return media;
  } catch (error) {
    throw new Error(`writeExifWebp Error: ${error.message}`);
  } finally {
    cleanupTmpFiles();
  }
}

/**
 * Convert buffer to video format
 * @param {Buffer} buffer - Input buffer
 * @param {string} ext - Input file extension
 * @returns {Promise<Buffer>} Video buffer
 */
function toVideo(buffer, ext) {
  let tmpPaths;
  try {
    validateParameters({
      buffer: { value: buffer, required: true, type: 'buffer' },
      ext: { value: ext, required: true, type: 'string' }
    });

    tmpPaths = generateTmpPaths(ext);
    tmpFileIn = tmpPaths.tmpFileIn;
    tmpFileOut = tmpPaths.tmpFileOut.replace(`.${ext}`, '.mp4');

    fs.writeFileSync(tmpFileIn, buffer);

    return new Promise((resolve, reject) => {
      ff(tmpFileIn)
        .on("error", (err) => reject(new Error(`toVideo Error: ${err.message}`)))
        .on("end", () => {
          const data = fs.readFileSync(tmpFileOut);
          resolve(data);
        })
        .addOutputOptions([
          "-c:v", "libx264",
          "-c:a", "aac",
          "-ab", "128k",
          "-ar", "44100",
          "-crf", "32",
          "-preset", "slow"
        ])
        .toFormat("mp4")
        .save(tmpFileOut);
    });
  } catch (error) {
    throw new Error(`toVideo Error: ${error.message}`);
  } finally {
    cleanupTmpFiles();
  }
}

/**
 * Convert WebP to MP4 using ezgif.com
 * @param {Buffer|string} source - WebP buffer or URL
 * @returns {Promise<string>} MP4 URL
 */
async function webp2mp4(source) {
  try {
    validateParameters({
      source: { value: source, required: true, type: ['buffer', 'string'] }
    });

    let form = new FormData();
    let isUrl = typeof source === "string" && /https?:\/\//.test(source);
    
    if (isUrl) {
      form.append("new-image-url", source);
    } else {
      form.append("new-image", source, "image.webp");
    }
    
    let res = await fetch("https://ezgif.com/webp-to-mp4", {
      method: "POST",
      body: form,
    });
    
    let html = await res.text();
    let { document } = new JSDOM(html).window;
    let form2 = new FormData();
    let obj = {};
    
    for (let input of document.querySelectorAll("form input[name]")) {
      obj[input.name] = input.value;
      form2.append(input.name, input.value);
    }
    
    let res2 = await fetch("https://ezgif.com/webp-to-mp4/" + obj.file, {
      method: "POST",
      body: form2,
    });
    
    let html2 = await res2.text();
    let { document: document2 } = new JSDOM(html2).window;
    const videoSource = document2.querySelector("div#output > p.outfile > video > source");
    
    if (!videoSource) {
      throw new Error("Could not find converted video source");
    }
    
    return new URL(videoSource.src, res2.url).toString();
  } catch (error) {
    throw new Error(`webp2mp4 Error: ${error.message}`);
  }
}

/**
 * Extract audio from video
 * @param {Buffer} buffer - Video buffer
 * @param {string} ext - Video file extension
 * @param {string} audioFormat - Output audio format (mp3, aac, etc.)
 * @returns {Promise<Buffer>} Audio buffer
 */
async function videoToAudio(buffer, ext, audioFormat = 'mp3') {
  let tmpPaths;
  try {
    validateParameters({
      buffer: { value: buffer, required: true, type: 'buffer' },
      ext: { value: ext, required: true, type: 'string' },
      audioFormat: { value: audioFormat, type: 'string' }
    });

    tmpPaths = generateTmpPaths(ext);
    tmpFileIn = tmpPaths.tmpFileIn;
    tmpFileOut = tmpPaths.tmpFileOut.replace(`.${ext}`, `.${audioFormat}`);

    fs.writeFileSync(tmpFileIn, buffer);

    return new Promise((resolve, reject) => {
      ff(tmpFileIn)
        .on('error', (err) => reject(new Error(`videoToAudio Error: ${err.message}`)))
        .on('end', () => {
          const data = fs.readFileSync(tmpFileOut);
          resolve(data);
        })
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .toFormat(audioFormat)
        .save(tmpFileOut);
    });
  } catch (error) {
    throw new Error(`videoToAudio Error: ${error.message}`);
  } finally {
    cleanupTmpFiles();
  }
}

module.exports = {
  imageToWebp,
  videoToWebp,
  writeExifImg,
  writeExifVid,
  writeExifWebp,
  toVideo,
  webp2mp4,
  videoToAudio
};