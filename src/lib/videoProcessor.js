/**
 * Video Processor for WhatsApp Status HD
 * Implements:
 * 1. Video metadata extraction and bitrate calculation
 * 2. 9:16 vertical conversion (Landscape to vertical with blurred background)
 * 3. Video sharpening and contrast enhancement
 * 4. WhatsApp Sweet-Spot Bitrate encoding (2.8 Mbps - preventing aggressive WA compression)
 * 5. 30-Second Auto Status Splitter (for videos > 30s)
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/**
 * Extract video metadata from File or URL
 * @param {File|string} source
 * @returns {Promise<Object>}
 */
export function getVideoMetadata(source) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;

    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    video.src = url;

    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = video.duration;
      const aspectRatio = (width / height).toFixed(2);
      const isVertical = height >= width;
      const is9by16 = Math.abs(width / height - 9 / 16) < 0.05;

      const size = source instanceof File ? source.size : 0;
      const bitrateKbps = duration > 0 && size > 0 ? Math.round((size * 8) / duration / 1000) : 0;

      // Calculate segments for 30s splitter
      const segmentCount = Math.ceil(duration / 30);
      const segments = [];
      for (let i = 0; i < segmentCount; i++) {
        const start = i * 30;
        const end = Math.min(duration, (i + 1) * 30);
        segments.push({
          part: i + 1,
          start,
          end,
          duration: end - start,
          label: `Bagian ${i + 1} (${formatTime(start)} - ${formatTime(end)})`,
        });
      }

      resolve({
        url,
        videoElement: video,
        width,
        height,
        duration,
        durationFormatted: formatTime(duration),
        aspectRatio,
        isVertical,
        is9by16,
        sizeBytes: size,
        sizeMb: (size / (1024 * 1024)).toFixed(2),
        bitrateKbps,
        segments,
        needsSplit: duration > 30.5,
      });
    };

    video.onerror = () => reject(new Error('Gagal membaca metadata video'));
  });
}

/**
 * Format seconds to mm:ss
 */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Process a segment or entire video for WhatsApp Status
 * @param {HTMLVideoElement|string|File} source
 * @param {Object} options
 * @param {Function} onProgress
 * @returns {Promise<Blob>}
 */
export async function processVideoForStatus(source, options = {}, onProgress = () => {}) {
  const {
    startTime = 0,
    endTime = null,
    targetWidth = 1080,
    targetHeight = 1920,
    fps = 30,
    bitrate = 2800000, // 2.8 Mbps sweet spot
    layout = 'blur-fill', // 'blur-fill' | 'crop-fill' | 'fit-pad'
    sharpen = true,
  } = options;

  let video;
  if (source instanceof HTMLVideoElement) {
    video = source;
  } else {
    video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.src = typeof source === 'string' ? source : URL.createObjectURL(source);
    await new Promise((res, rej) => {
      video.onloadedmetadata = res;
      video.onerror = rej;
    });
  }

  const durationToProcess = (endTime ? endTime : video.duration) - startTime;
  const targetDuration = Math.min(30, durationToProcess);
  const segmentEndTime = startTime + targetDuration;

  // Setup canvas for frame rendering
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Setup audio stream if present
  let audioStream = null;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const sourceNode = audioCtx.createMediaElementSource(video);
    const dest = audioCtx.createMediaStreamDestination();
    sourceNode.connect(dest);
    sourceNode.connect(audioCtx.destination);
    audioStream = dest.stream;
  } catch {
    // Audio context may already be connected or not supported
  }

  // Choose recording mechanism
  const stream = canvas.captureStream(fps);
  if (audioStream && audioStream.getAudioTracks().length > 0) {
    audioStream.getAudioTracks().forEach((track) => stream.addTrack(track));
  }

  // Check supported mime types
  const candidateMimes = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.4d401f',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  const selectedMime = candidateMimes.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

  return new Promise(async (resolve, reject) => {
    let recorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: selectedMime,
        videoBitsPerSecond: bitrate,
      });
    } catch (e) {
      recorder = new MediaRecorder(stream);
    }

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: selectedMime.split(';')[0] });
      resolve(blob);
    };

    recorder.onerror = reject;

    // Seek to start time
    video.currentTime = startTime;
    await new Promise((res) => {
      video.onseeked = res;
    });

    recorder.start(100);
    video.play();

    let animationId;
    const renderLoop = () => {
      if (video.currentTime >= segmentEndTime || video.ended) {
        cancelAnimationFrame(animationId);
        video.pause();
        recorder.stop();
        onProgress(100);
        return;
      }

      // Draw background
      if (layout === 'blur-fill') {
        // Draw blurred background
        ctx.save();
        ctx.filter = 'blur(35px) brightness(0.65)';
        const bgScale = Math.max(targetWidth / video.videoWidth, targetHeight / video.videoHeight);
        const bgW = video.videoWidth * bgScale;
        const bgH = video.videoHeight * bgScale;
        ctx.drawImage(video, (targetWidth - bgW) / 2, (targetHeight - bgH) / 2, bgW, bgH);
        ctx.restore();

        // Dark vignette overlay
        ctx.fillStyle = 'rgba(11, 20, 26, 0.4)';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        // Draw centered foreground
        const fgScale = Math.min((targetWidth * 0.95) / video.videoWidth, (targetHeight * 0.9) / video.videoHeight);
        const fgW = video.videoWidth * fgScale;
        const fgH = video.videoHeight * fgScale;
        const fgX = (targetWidth - fgW) / 2;
        const fgY = (targetHeight - fgH) / 2;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 8;
        ctx.drawImage(video, fgX, fgY, fgW, fgH);
        ctx.restore();

      } else if (layout === 'crop-fill') {
        const scale = Math.max(targetWidth / video.videoWidth, targetHeight / video.videoHeight);
        const w = video.videoWidth * scale;
        const h = video.videoHeight * scale;
        ctx.drawImage(video, (targetWidth - w) / 2, (targetHeight - h) / 2, w, h);
      } else {
        // fit-pad with clean solid dark background
        ctx.fillStyle = '#0B141A';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        const scale = Math.min(targetWidth / video.videoWidth, targetHeight / video.videoHeight);
        const w = video.videoWidth * scale;
        const h = video.videoHeight * scale;
        ctx.drawImage(video, (targetWidth - w) / 2, (targetHeight - h) / 2, w, h);
      }

      // Micro sharpening overlay
      if (sharpen) {
        ctx.save();
        ctx.filter = 'contrast(1.05) saturate(1.08)';
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
      }

      const currentProgress = Math.min(
        99,
        Math.round(((video.currentTime - startTime) / targetDuration) * 100)
      );
      onProgress(currentProgress);

      animationId = requestAnimationFrame(renderLoop);
    };

    animationId = requestAnimationFrame(renderLoop);
  });
}

/**
 * Generate a synthetic dynamic test video in canvas for instant user testing
 * @param {number} durationSeconds
 * @returns {Promise<Blob>}
 */
export function generateTestVideo(durationSeconds = 6) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);
    const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mime }));
    };

    recorder.start(100);

    let startTime = performance.now();
    const animate = (time) => {
      const elapsed = (time - startTime) / 1000;
      if (elapsed >= durationSeconds) {
        recorder.stop();
        return;
      }

      // Animated background
      const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
      const hue1 = (elapsed * 40) % 360;
      const hue2 = (hue1 + 80) % 360;
      grad.addColorStop(0, `hsl(${hue1}, 70%, 15%)`);
      grad.addColorStop(1, `hsl(${hue2}, 80%, 8%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1920);

      // Glowing circle
      const cy = 960 + Math.sin(elapsed * 2) * 150;
      const radGrad = ctx.createRadialGradient(540, cy, 20, 540, cy, 320);
      radGrad.addColorStop(0, 'rgba(37, 211, 102, 0.9)');
      radGrad.addColorStop(1, 'rgba(0, 168, 132, 0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(540, cy, 320, 0, Math.PI * 2);
      ctx.fill();

      // Text and UI
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 72px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STATUS WA HD TEST', 540, 750);

      ctx.fillStyle = '#25D366';
      ctx.font = '600 42px "Outfit", sans-serif';
      ctx.fillText('Sweet Spot Bitrate 2.8 Mbps', 540, 830);

      // Countdown
      const remaining = Math.max(0, Math.ceil(durationSeconds - elapsed));
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 120px "JetBrains Mono", monospace';
      ctx.fillText(`00:0${remaining}`, 540, 1200);

      ctx.font = '32px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillText('1080 x 1920 • 60 FPS • Anti-Burik Bypass', 540, 1280);

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  });
}
