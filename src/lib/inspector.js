/**
 * WhatsApp Status Inspector & Diagnostic Engine
 * Analyzes uploaded media to detect why it would turn "burik" if uploaded directly,
 * scores its WhatsApp HD readiness, and recommends optimal bypass fixes.
 */

import { getVideoMetadata } from './videoProcessor.js';

export async function inspectMedia(file) {
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');

  if (!isVideo && !isImage) {
    throw new Error('Format file tidak didukung. Harap masukkan foto atau video.');
  }

  let width = 0;
  let height = 0;
  let duration = 0;
  let bitrateKbps = 0;

  if (isImage) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });
    width = img.naturalWidth;
    height = img.naturalHeight;
  } else {
    const meta = await getVideoMetadata(file);
    width = meta.width;
    height = meta.height;
    duration = meta.duration;
    bitrateKbps = meta.bitrateKbps;
  }

  const aspectRatio = (width / height).toFixed(2);
  const isVertical = height >= width;
  const isExact9by16 = Math.abs(width / height - 9 / 16) < 0.04;
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);

  // Diagnostic checks and scoring
  const issues = [];
  const positivePoints = [];
  let score = 100;

  // 1. Aspect Ratio check
  if (!isExact9by16) {
    if (width > height) {
      score -= 25;
      issues.push({
        severity: 'high',
        title: 'Aspek Rasio Landscape (Bukan 9:16)',
        desc: `Ukuran ${width}x${height} adalah horizontal. WhatsApp akan menyisakan ruang hitam kosong besar atau memotong gambar secara paksa.`,
        fix: 'Gunakan mode Blur Background agar tampil estetik layar penuh 9:16.',
      });
    } else {
      score -= 15;
      issues.push({
        severity: 'medium',
        title: 'Aspek Rasio Bukan Standar 9:16',
        desc: `Rasio saat ini ${aspectRatio}. Layar status WhatsApp optimal di 9:16 (1080x1920). Sebagian konten mungkin terpotong.`,
        fix: 'Paskan otomatis ke canvas 1080x1920.',
      });
    }
  } else {
    positivePoints.push('Aspek rasio sudah pas 9:16 (Layar penuh status WhatsApp).');
  }

  // 2. Resolution check
  const maxDim = Math.max(width, height);
  if (maxDim > 2200) {
    score -= 20;
    issues.push({
      severity: 'high',
      title: 'Resolusi Terlalu Besar (Kamera 4K / 48MP+)',
      desc: `Resolusi ${width}x${height} terlalu masif. Engine kompresi ponsel WhatsApp akan menggunakan downscale bilinear cepat yang merusak ketajaman rambut, teks, dan detail mikro!`,
      fix: 'Lakukan pre-downscale bertahap (stepped Lanczos) ke 1080x1920 dengan Unsharp Mask sebelum upload.',
    });
  } else if (maxDim < 1000) {
    score -= 30;
    issues.push({
      severity: 'high',
      title: 'Resolusi Kurang dari Standar HD',
      desc: `Resolusi ${width}x${height} terlalu rendah. WhatsApp akan memperbesar paksa gambar sehingga terlihat buram dan pixelated.`,
      fix: 'Tingkatkan resolusi ke 1080x1920 dengan filter rekontruksi tepi tajam.',
    });
  } else if (width === 1080 && height === 1920) {
    positivePoints.push('Resolusi tepat 1080x1920 (Ukuran emas Status WhatsApp HD).');
  } else {
    positivePoints.push('Resolusi mencukupi standar HD.');
  }

  // 3. Video specific checks
  if (isVideo) {
    if (bitrateKbps > 4000) {
      score -= 30;
      issues.push({
        severity: 'high',
        title: 'Bitrate Video Terlalu Tinggi (' + (bitrateKbps / 1000).toFixed(1) + ' Mbps)',
        desc: 'WhatsApp membatasi status video maksimal ~2.5 - 3.2 Mbps. Video dengan bitrate tinggi akan dikompres brutal oleh WhatsApp sehingga patah-patah dan buram.',
        fix: 'Kompres ke "Sweet Spot Bitrate" 2.8 Mbps dengan H.264 Baseline Profile.',
      });
    } else if (bitrateKbps > 0 && bitrateKbps < 1200) {
      score -= 15;
      issues.push({
        severity: 'medium',
        title: 'Bitrate Video Rendah (' + bitrateKbps + ' kbps)',
        desc: 'Bitrate terdeteksi rendah sehingga mungkin ada artefak kompresi bawaan.',
        fix: 'Pertajam kontras dan aktifkan filter edge-enhancement.',
      });
    } else if (bitrateKbps >= 2000 && bitrateKbps <= 3500) {
      positivePoints.push('Bitrate berada di zona emas WhatsApp (~2.8 Mbps).');
    }

    if (duration > 30.5) {
      score -= 25;
      issues.push({
        severity: 'high',
        title: `Durasi Melebihi Batas 30 Detik (${Math.round(duration)} detik)`,
        desc: 'Status WhatsApp hanya mendukung maksimal 30 detik per slide. Video ini akan dipotong paksa dan akhir cerita terputus.',
        fix: 'Gunakan fitur Auto Splitter 30 Detik untuk membagi video menjadi slide bersambung rapi.',
      });
    } else {
      positivePoints.push(`Durasi ${Math.round(duration)}s aman (di bawah batas 30 detik).`);
    }
  } else {
    // Image specific note
    issues.push({
      severity: 'info',
      title: 'Trik Rahasia: Format Foto vs Video',
      desc: 'WhatsApp hanya memberikan ~150-200 KB untuk status foto, tetapi mengalokasikan hingga ~3.000 KB (3MB) untuk video! Mengonversi foto menjadi video 60fps akan membuat status 10x lebih jernih.',
      fix: 'Coba fitur "Foto ke Video Status 60FPS" di tab Anti-Burik Foto.',
    });
  }

  // Final score clamping
  score = Math.max(15, Math.min(98, score));

  let statusLabel = 'Aman & HD Ready';
  let statusColor = '#25D366';
  let summaryText = 'File ini memiliki parameter yang baik untuk diupload ke WhatsApp Status.';

  if (score < 60) {
    statusLabel = '🚨 SANGAT RENTAN BURIK';
    statusColor = '#EF4444';
    summaryText = 'PENTING: File ini dipastikan akan menjadi buram dan terkompresi hancur jika diupload langsung ke status WhatsApp tanpa optimasi!';
  } else if (score < 80) {
    statusLabel = '⚠️ POTENSI BURIK / TERPOTONG';
    statusColor = '#F59E0B';
    summaryText = 'File ini memiliki ketidaksesuaian rasio atau ukuran yang dapat menyebabkan kompresi otomatis WhatsApp.';
  } else {
    statusLabel = '✅ HD READY & AMAN';
    statusColor = '#10B981';
  }

  return {
    fileName: file.name,
    fileType: isVideo ? 'video' : 'image',
    sizeMb,
    width,
    height,
    aspectRatio,
    duration,
    bitrateKbps,
    score,
    statusLabel,
    statusColor,
    summaryText,
    issues,
    positivePoints,
  };
}
