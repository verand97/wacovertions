/**
 * Image Processor for WhatsApp Status HD
 * Implements algorithms to counter and trick WhatsApp compression:
 * 1. Multi-step high-precision Lanczos-approx downsampling to exact 1080x1920 (9:16)
 * 2. Adaptive Unsharp Mask (Counter-blur high pass filter)
 * 3. Micro-dithering (Anti-banding noise injection to defeat JPEG 8x8 DCT quantization)
 * 4. Micro-contrast & vibrance dynamic range preservation
 * 5. Simulation of default WhatsApp status compression for comparison
 * 6. Photo to 60fps MP4 video status generator
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/**
 * Load an image from File, Blob, or URL
 * @param {File|Blob|string} source
 * @returns {Promise<HTMLImageElement>}
 */
export async function loadImage(source) {
  // If it's a File or Blob, try createImageBitmap first to automatically honor EXIF orientation
  if (source instanceof Blob || source instanceof File) {
    try {
      const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = bitmap.width;
      tempCanvas.height = bitmap.height;
      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      const img = new Image();
      img.src = tempCanvas.toDataURL();
      await new Promise((res) => { img.onload = res; });
      return img;
    } catch {
      // Fallback to standard URL.createObjectURL
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Gagal memuat gambar: ' + err.message));

    if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof Blob || source instanceof File) {
      img.src = URL.createObjectURL(source);
    } else {
      reject(new Error('Format sumber tidak didukung'));
    }
  });
}

/**
 * Multi-step high quality image resize to prevent bilinear downscale blur
 */
function steppedDownscale(sourceCanvas, targetWidth, targetHeight) {
  let curWidth = sourceCanvas.width;
  let curHeight = sourceCanvas.height;

  // If already close to target size or smaller, return
  if (curWidth <= targetWidth * 1.5 && curHeight <= targetHeight * 1.5) {
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetWidth;
    finalCanvas.height = targetHeight;
    const ctx = finalCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    return finalCanvas;
  }

  // Stepped halving
  let intermediateCanvas = sourceCanvas;
  while (curWidth > targetWidth * 1.8 || curHeight > targetHeight * 1.8) {
    const nextWidth = Math.floor(curWidth * 0.65);
    const nextHeight = Math.floor(curHeight * 0.65);
    const temp = document.createElement('canvas');
    temp.width = nextWidth;
    temp.height = nextHeight;
    const tCtx = temp.getContext('2d');
    tCtx.imageSmoothingEnabled = true;
    tCtx.imageSmoothingQuality = 'high';
    tCtx.drawImage(intermediateCanvas, 0, 0, nextWidth, nextHeight);

    intermediateCanvas = temp;
    curWidth = nextWidth;
    curHeight = nextHeight;
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;
  const ctx = finalCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(intermediateCanvas, 0, 0, targetWidth, targetHeight);
  return finalCanvas;
}

/**
 * Apply Adaptive Unsharp Mask filter on canvas ImageData
 * @param {ImageData} imageData 
 * @param {number} amount - Sharpen strength (0 to 1)
 * @param {number} threshold - Threshold to prevent amplifying flat noise (0 to 255)
 */
export function applyUnsharpMask(imageData, amount = 0.45, threshold = 4) {
  const { width, height, data } = imageData;
  const copy = new Uint8ClampedArray(data);

  // Fast 3x3 approximate blur convolution
  // Kernel: [1 2 1; 2 4 2; 1 2 1] / 16
  const w = width;
  const h = height;

  for (let y = 1; y < h - 1; y++) {
    const yOffset = y * w;
    const yTop = (y - 1) * w;
    const yBottom = (y + 1) * w;

    for (let x = 1; x < w - 1; x++) {
      const idx = (yOffset + x) * 4;

      for (let c = 0; c < 3; c++) {
        // blurred value calculation
        const b =
          (copy[(yTop + x - 1) * 4 + c] +
           copy[(yTop + x) * 4 + c] * 2 +
           copy[(yTop + x + 1) * 4 + c] +
           copy[(yOffset + x - 1) * 4 + c] * 2 +
           copy[(yOffset + x) * 4 + c] * 4 +
           copy[(yOffset + x + 1) * 4 + c] * 2 +
           copy[(yBottom + x - 1) * 4 + c] +
           copy[(yBottom + x) * 4 + c] * 2 +
           copy[(yBottom + x + 1) * 4 + c]) >> 4;

        const orig = copy[idx + c];
        const diff = orig - b;

        if (Math.abs(diff) > threshold) {
          // Sharp boost
          const val = orig + diff * amount;
          data[idx + c] = val > 255 ? 255 : (val < 0 ? 0 : val);
        }
      }
    }
  }
}

/**
 * Inject Anti-Banding Micro-Dither to trick WhatsApp's JPEG DCT quantization tables
 * @param {ImageData} imageData
 * @param {number} strength - Dither strength (0 to 1, default ~0.015)
 */
export function injectMicroDither(imageData, strength = 0.015) {
  const data = imageData.data;
  const amp = strength * 255;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    // Generate subtle high frequency pseudo-random micro grain
    const noise = (Math.random() - 0.5) * amp;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
}

/**
 * Apply subtle contrast and vibrance boost to compensate for WhatsApp dynamic range loss
 */
export function applyVibranceAndContrast(imageData, contrast = 0.08, vibrance = 0.12) {
  const data = imageData.data;
  const len = data.length;
  const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Contrast
    r = factor * (r - 128) + 128;
    g = factor * (g - 128) + 128;
    b = factor * (b - 128) + 128;

    // Vibrance
    const max = Math.max(r, g, b);
    const avg = (r + g + b) / 3;
    const amt = ((Math.abs(max - avg) * 2) / 255) * vibrance;

    if (r !== max) r += (max - r) * amt;
    if (g !== max) g += (max - g) * amt;
    if (b !== max) b += (max - b) * amt;

    data[i] = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
  }
}

/**
 * Render image into target canvas with layout mode
 * @param {HTMLImageElement} img
 * @param {Object} options
 * @returns {HTMLCanvasElement}
 */
export function renderOptimizedPhoto(img, options = {}) {
  const {
    targetWidth = 1080,
    targetHeight = 1920,
    layout = 'blur-fill', // 'blur-fill' | 'crop-fill' | 'fit-pad'
    sharpenAmount = 0.45,
    microDither = 0.015,
    contrastBoost = 0.08,
    vibranceBoost = 0.12,
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  // Background rendering
  if (layout === 'blur-fill') {
    // 1. Draw blurred, scaled version to cover canvas
    const bgScale = Math.max(targetWidth / img.width, targetHeight / img.height);
    const bgW = img.width * bgScale;
    const bgH = img.height * bgScale;
    const bgX = (targetWidth - bgW) / 2;
    const bgY = (targetHeight - bgH) / 2;

    // Fast blur via downscale + upscale with filter
    const tempBlur = document.createElement('canvas');
    tempBlur.width = Math.floor(targetWidth / 8);
    tempBlur.height = Math.floor(targetHeight / 8);
    const tCtx = tempBlur.getContext('2d');
    tCtx.drawImage(img, 0, 0, tempBlur.width, tempBlur.height);

    ctx.save();
    ctx.filter = 'blur(45px) brightness(0.65)';
    ctx.drawImage(tempBlur, 0, 0, targetWidth, targetHeight);
    ctx.restore();

    // Dark vignette gradient overlay for sleek aesthetics
    const grad = ctx.createRadialGradient(
      targetWidth / 2,
      targetHeight / 2,
      targetWidth * 0.2,
      targetWidth / 2,
      targetHeight / 2,
      targetHeight * 0.7
    );
    grad.addColorStop(0, 'rgba(11, 20, 26, 0.2)');
    grad.addColorStop(1, 'rgba(11, 20, 26, 0.75)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // 2. Draw sharp foreground image centered with aspect fit
    const fgScale = Math.min((targetWidth * 0.94) / img.width, (targetHeight * 0.88) / img.height);
    const fgW = Math.round(img.width * fgScale);
    const fgH = Math.round(img.height * fgScale);
    const fgX = Math.round((targetWidth - fgW) / 2);
    const fgY = Math.round((targetHeight - fgH) / 2);

    // Subtle drop shadow for foreground
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;

    // Use stepped downscaled version for maximum sharpness
    const sharpForeground = steppedDownscale(
      (() => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        return c;
      })(),
      fgW,
      fgH
    );

    ctx.drawImage(sharpForeground, fgX, fgY);
    ctx.restore();

  } else if (layout === 'crop-fill') {
    // Fill full 1080x1920 cropping edges
    const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (targetWidth - w) / 2;
    const y = (targetHeight - h) / 2;

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = img.width;
    sourceCanvas.height = img.height;
    sourceCanvas.getContext('2d').drawImage(img, 0, 0);

    const downscaled = steppedDownscale(sourceCanvas, Math.round(w), Math.round(h));
    ctx.drawImage(downscaled, x, y);

  } else {
    // fit-pad with solid clean dark background
    ctx.fillStyle = '#0B141A';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const x = Math.round((targetWidth - w) / 2);
    const y = Math.round((targetHeight - h) / 2);

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = img.width;
    sourceCanvas.height = img.height;
    sourceCanvas.getContext('2d').drawImage(img, 0, 0);

    const downscaled = steppedDownscale(sourceCanvas, w, h);
    ctx.drawImage(downscaled, x, y);
  }

  // Anti-burik pixel post-processing
  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);

  if (sharpenAmount > 0) {
    applyUnsharpMask(imgData, sharpenAmount, 3);
  }

  if (contrastBoost > 0 || vibranceBoost > 0) {
    applyVibranceAndContrast(imgData, contrastBoost, vibranceBoost);
  }

  if (microDither > 0) {
    injectMicroDither(imgData, microDither);
  }

  ctx.putImageData(imgData, 0, 0);

  return canvas;
}

/**
 * Simulate default WhatsApp status compression to show why regular uploads turn "burik"
 * @param {HTMLImageElement} img
 * @param {Object} options
 * @returns {HTMLCanvasElement}
 */
export function simulateWhatsAppDefaultCompression(img, options = {}) {
  const { targetWidth = 1080, targetHeight = 1920, layout = 'blur-fill' } = options;

  // Step 1: Render standard non-optimized version
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = targetWidth;
  baseCanvas.height = targetHeight;
  const ctx = baseCanvas.getContext('2d');

  if (layout === 'blur-fill') {
    // Rough background
    ctx.fillStyle = '#111b21';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const scale = Math.min((targetWidth * 0.9) / img.width, (targetHeight * 0.85) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (targetWidth - w) / 2, (targetHeight - h) / 2, w, h);
  } else if (layout === 'crop-fill') {
    const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
    ctx.drawImage(
      img,
      (targetWidth - img.width * scale) / 2,
      (targetHeight - img.height * scale) / 2,
      img.width * scale,
      img.height * scale
    );
  } else {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
    ctx.drawImage(img, (targetWidth - img.width * scale) / 2, (targetHeight - img.height * scale) / 2, img.width * scale, img.height * scale);
  }

  // Step 2: Simulate WhatsApp's aggressive downscale to 720p or lower with bilinear blur + heavy JPEG compression
  const waSimCanvas = document.createElement('canvas');
  waSimCanvas.width = 640;
  waSimCanvas.height = 1138;
  const waCtx = waSimCanvas.getContext('2d');
  waCtx.imageSmoothingEnabled = true;
  waCtx.drawImage(baseCanvas, 0, 0, 640, 1138);

  // Re-upscale to view dimensions (introducing blurry interpolation)
  const displayCanvas = document.createElement('canvas');
  displayCanvas.width = targetWidth;
  displayCanvas.height = targetHeight;
  const dCtx = displayCanvas.getContext('2d');
  dCtx.imageSmoothingEnabled = true;
  dCtx.drawImage(waSimCanvas, 0, 0, targetWidth, targetHeight);

  // Apply slight blur and lossy banding
  const data = dCtx.getImageData(0, 0, targetWidth, targetHeight);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    // Quantize / band colors into 16-level blocks (simulating DCT compression artifacts)
    d[i] = Math.floor(d[i] / 12) * 12;
    d[i + 1] = Math.floor(d[i + 1] / 12) * 12;
    d[i + 2] = Math.floor(d[i + 2] / 12) * 12;
  }
  dCtx.putImageData(data, 0, 0);

  return displayCanvas;
}

/**
 * Convert a photo into a 60FPS MP4 video status (The Secret Creator Trick)
 * WhatsApp allocates higher bitrate to video status than photo status.
 * @param {HTMLCanvasElement} optimizedCanvas
 * @param {Object} options
 * @param {Function} onProgress
 * @returns {Promise<Blob>}
 */
export async function convertPhotoToStatusVideo(optimizedCanvas, options = {}, onProgress = () => {}) {
  const {
    durationSeconds = 4,
    fps = 60,
    motionType = 'zoom', // 'zoom' | 'static'
    bitrate = 2800000,   // 2.8 Mbps sweet spot
  } = options;

  const width = optimizedCanvas.width;
  const height = optimizedCanvas.height;
  const totalFrames = durationSeconds * fps;

  // Check if WebCodecs VideoEncoder is available
  const hasWebCodecs = typeof window.VideoEncoder !== 'undefined';

  if (hasWebCodecs) {
    try {
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: width,
          height: height,
        },
        fastStart: 'in-memory',
      });

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error('VideoEncoder error:', e),
      });

      videoEncoder.configure({
        codec: 'avc1.420028', // H.264 Baseline Profile Level 4.0
        width: width,
        height: height,
        bitrate: bitrate,
        framerate: fps,
        avc: { format: 'annexb' },
      });

      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const fCtx = frameCanvas.getContext('2d');

      const microSecondPerFrame = (1 / fps) * 1000000;

      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        fCtx.clearRect(0, 0, width, height);

        if (motionType === 'zoom') {
          // Subtle elegant 1.00 -> 1.04 slow breathing zoom
          const progress = frameIndex / totalFrames;
          const scale = 1.0 + progress * 0.04;
          const w = width * scale;
          const h = height * scale;
          const x = (width - w) / 2;
          const y = (height - h) / 2;
          fCtx.drawImage(optimizedCanvas, x, y, w, h);
        } else {
          fCtx.drawImage(optimizedCanvas, 0, 0);
        }

        const videoFrame = new VideoFrame(frameCanvas, {
          timestamp: Math.round(frameIndex * microSecondPerFrame),
          duration: Math.round(microSecondPerFrame),
        });

        // Keyframe every 1 second (fps frames)
        const isKeyFrame = frameIndex % fps === 0;
        videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
        videoFrame.close();

        if (frameIndex % 15 === 0 || frameIndex === totalFrames - 1) {
          onProgress(Math.round(((frameIndex + 1) / totalFrames) * 100));
          // Yield to UI
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      await videoEncoder.flush();
      muxer.finalize();

      const { buffer } = muxer.target;
      return new Blob([buffer], { type: 'video/mp4' });
    } catch (err) {
      console.warn('WebCodecs encoding fallback to MediaRecorder:', err);
    }
  }

  // Fallback using HTMLCanvasElement.captureStream and MediaRecorder
  return new Promise((resolve, reject) => {
    const stream = optimizedCanvas.captureStream(fps);
    const mimeTypes = [
      'video/mp4;codecs=avc1.42E01E',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm',
    ];

    let selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

    const recorder = new MediaRecorder(stream, {
      mimeType: selectedMime,
      videoBitsPerSecond: bitrate,
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: selectedMime.split(';')[0] });
      resolve(blob);
    };

    recorder.onerror = reject;

    recorder.start(100);

    let currentFrame = 0;
    const interval = setInterval(() => {
      currentFrame += 5;
      onProgress(Math.min(99, Math.round((currentFrame / totalFrames) * 100)));
    }, (durationSeconds * 1000) / (totalFrames / 5));

    setTimeout(() => {
      clearInterval(interval);
      recorder.stop();
      onProgress(100);
    }, durationSeconds * 1000);
  });
}
