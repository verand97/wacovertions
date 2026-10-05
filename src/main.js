import './style.css';
import confetti from 'canvas-confetti';
import { createIcons, icons } from 'lucide';
import {
  loadImage,
  renderOptimizedPhoto,
  simulateWhatsAppDefaultCompression,
  convertPhotoToStatusVideo,
} from './lib/imageProcessor.js';
import {
  getVideoMetadata,
  processVideoForStatus,
  generateTestVideo,
  formatTime,
} from './lib/videoProcessor.js';
import { inspectMedia } from './lib/inspector.js';

// Application State
const state = {
  currentTab: 'photo', // 'photo' | 'video' | 'inspector' | 'guides'
  photo: {
    sourceImg: null,
    file: null,
    fileName: 'status_hd',
    rawWidth: 0,
    rawHeight: 0,
    rawSizeBytes: 0,
    outputMode: 'photo', // 'photo' | 'video'
    layout: 'blur-fill', // 'blur-fill' | 'crop-fill' | 'fit-pad'
    targetWidth: 1080,
    targetHeight: 1920,
    sharpenAmount: 0.45,
    microDither: 0.015,
    contrastBoost: 0.08,
    vibranceBoost: 0.12,
    sliderPos: 50, // Percentage for before/after split slider
    compareMode: 'split', // 'split' | 'side' | 'hold'
    zoomLevel: 'fit', // 'fit' | '100' | '200'
    showSafeZone: false,
    isHoldingSpace: false,
  },
  video: {
    file: null,
    metadata: null,
    preset: 'sweet-spot', // 'sweet-spot' | 'fast-hd' | 'ultra'
    targetWidth: 1080,
    targetHeight: 1920,
    bitrate: 2800000,
    layout: 'blur-fill',
    sharpen: true,
    showSafeZone: false,
  },
  inspector: {
    result: null,
  },
};

// Render Complete Workstation Shell
document.querySelector('#app').innerHTML = `
  <!-- Top Navigation Bar -->
  <header class="top-navbar">
    <div class="brand-section">
      <div class="brand-logo-mark">
        <i data-lucide="shield-check"></i>
      </div>
      <div class="brand-info">
        <h1>StatusStudio <span class="badge-ver">v2.4 HD</span></h1>
        <p>WhatsApp Media Optimization & Compression Bypass Engine</p>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <nav class="tabs-switcher">
      <button class="nav-tab-btn active" data-tab="photo">
        <i data-lucide="image"></i>
        <span>Studio Foto</span>
      </button>
      <button class="nav-tab-btn" data-tab="video">
        <i data-lucide="video"></i>
        <span>Studio Video</span>
      </button>
      <button class="nav-tab-btn" data-tab="inspector">
        <i data-lucide="activity"></i>
        <span>Audit Diagnostik</span>
      </button>
      <button class="nav-tab-btn" data-tab="guides">
        <i data-lucide="file-text"></i>
        <span>Spesifikasi & Trik</span>
      </button>
    </nav>

    <!-- Utility Badges & Shortcuts -->
    <div class="navbar-actions">
      <div class="engine-status-pill">
        <span class="indicator-dot"></span>
        <span>Canvas / WebCodecs Ready</span>
      </div>
      <button class="btn-util" id="btn-paste-shortcut" title="Tempel gambar langsung dari clipboard">
        <i data-lucide="clipboard-paste"></i>
        <span>Paste</span>
        <kbd>Ctrl+V</kbd>
      </button>
    </div>
  </header>

  <!-- ======================================================== -->
  <!-- TAB 1: STUDIO FOTO -->
  <!-- ======================================================== -->
  <main class="tab-pane active" id="tab-photo">
    <div class="workstation-grid">
      <!-- Left: Controls & Configuration Sidebar -->
      <aside class="controls-sidebar">
        <div class="sidebar-section-title">
          <span>Input & Konfigurasi</span>
          <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);">9:16 Canvas</span>
        </div>

        <!-- Compact Dropzone -->
        <div class="compact-dropzone" id="photo-dropzone">
          <div class="dropzone-icon-wrap">
            <i data-lucide="upload-cloud"></i>
          </div>
          <div>
            <div class="dropzone-label">Pilih atau Tarik Foto</div>
            <div class="dropzone-sub">Mendukung JPG, PNG, WEBP, atau tekan <kbd style="font-family:var(--font-mono);background:rgba(255,255,255,0.1);padding:1px 4px;border-radius:3px;">Ctrl+V</kbd></div>
          </div>
          <input type="file" id="photo-file-input" class="hidden-file-input" accept="image/*" />
        </div>

        <!-- Preset Chips -->
        <div class="sample-chips-row">
          <button class="sample-chip" id="btn-sample-landscape" title="Uji coba foto horizontal dengan latar blur estetik">
            <i data-lucide="mountain"></i> Bromo (Landscape)
          </button>
          <button class="sample-chip" id="btn-sample-portrait" title="Uji coba foto vertikal layar penuh">
            <i data-lucide="coffee"></i> Kafe (Portrait)
          </button>
        </div>

        <!-- Quick Tuning Presets -->
        <div class="control-group">
          <div class="control-header">
            <span>Profil Optimasi Cepat</span>
            <span class="control-badge" id="lbl-quick-profile">Kustom</span>
          </div>
          <div class="sample-chips-row" style="margin-top: 2px;">
            <button class="sample-chip" id="btn-preset-portrait">Potret Wajah</button>
            <button class="sample-chip" id="btn-preset-landscape">Pemandangan</button>
            <button class="sample-chip" id="btn-preset-text">Teks / Flyer</button>
            <button class="sample-chip" id="btn-preset-reset">Reset Default</button>
          </div>
        </div>

        <!-- Output Format Mode -->
        <div class="control-group">
          <div class="control-header">
            <span>Format Target Ekspor</span>
            <span class="control-badge" id="badge-photo-mode">Foto HD (1080p)</span>
          </div>
          <div class="segment-bar" id="seg-photo-output-mode">
            <button class="segment-item-btn active" data-mode="photo">
              <span>Foto HD (JPEG)</span>
              <small>1080×1920 sRGB</small>
            </button>
            <button class="segment-item-btn" data-mode="video">
              <span>Video 60FPS (MP4)</span>
              <small>Trik Bitrate WA 2.8M</small>
            </button>
          </div>
        </div>

        <!-- Framing & Layout -->
        <div class="control-group">
          <div class="control-header">
            <span>Framing Status (9:16)</span>
            <span class="control-badge" id="badge-photo-layout">Latar Blur</span>
          </div>
          <div class="segment-bar" id="seg-photo-layout">
            <button class="segment-item-btn active" data-layout="blur-fill">
              <span>Latar Blur</span>
              <small>Utuh & Estetik</small>
            </button>
            <button class="segment-item-btn" data-layout="crop-fill">
              <span>Crop 9:16</span>
              <small>Penuh Layar</small>
            </button>
            <button class="segment-item-btn" data-layout="fit-pad">
              <span>Letterbox</span>
              <small>Fit Hitam</small>
            </button>
          </div>
        </div>

        <!-- Precision Sliders -->
        <div class="sidebar-section-title" style="margin-top: 4px;">
          <span>Filter Rekonstruksi & Anti-Burik</span>
        </div>

        <div class="control-group slider-row">
          <div class="control-header">
            <span>Ketajaman Adaptif (Unsharp Mask)</span>
            <span class="control-badge" id="lbl-val-sharpen">45%</span>
          </div>
          <input type="range" id="range-sharpen" min="0" max="100" value="45" />
          <span class="slider-hint">Menangkal filter gaussian blur bawaan WhatsApp saat re-encode.</span>
        </div>

        <div class="control-group slider-row">
          <div class="control-header">
            <span>Anti-Banding Micro-Dither</span>
            <span class="control-badge" id="lbl-val-dither">1.5%</span>
          </div>
          <input type="range" id="range-dither" min="0" max="30" value="15" />
          <span class="slider-hint">Menyisipkan micro-grain halus agar gradasi langit tidak terpecah jadi balok DCT.</span>
        </div>

        <div class="control-group slider-row">
          <div class="control-header">
            <span>Clarity & Contrast Boost</span>
            <span class="control-badge" id="lbl-val-contrast">8%</span>
          </div>
          <input type="range" id="range-contrast" min="0" max="20" value="8" />
          <span class="slider-hint">Mencegah degradasi dynamic range dan tampilan foto pucat di WA.</span>
        </div>

        <!-- Telemetry & Predictions -->
        <div class="telemetry-card">
          <div class="telemetry-row">
            <span>Resolusi Masukan:</span>
            <strong id="telem-raw-res">-</strong>
          </div>
          <div class="telemetry-row">
            <span>Target Status WA:</span>
            <strong>1080 × 1920 (9:16)</strong>
          </div>
          <div class="telemetry-row">
            <span>Ukuran Perkiraan:</span>
            <strong id="telem-out-size">~185 KB</strong>
          </div>
          <div class="telemetry-row">
            <span>Prediksi Status:</span>
            <span class="score-tag" id="telem-score">98% Jernih (HD Ready)</span>
          </div>
        </div>

        <!-- Primary Action CTAs -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button class="btn-primary-action" id="btn-download-photo">
            <i data-lucide="download"></i>
            <span id="btn-download-photo-text">Unduh Foto HD Jernih (.jpg)</span>
          </button>
          <button class="btn-secondary-action" id="btn-copy-clipboard">
            <i data-lucide="copy"></i>
            <span>Salin Gambar ke Clipboard</span>
          </button>
        </div>
      </aside>

      <!-- Right: Viewport Stage -->
      <section class="viewport-stage">
        <!-- Stage Toolbar -->
        <div class="stage-toolbar">
          <div class="stage-toolbar-group">
            <span class="stage-tool-label">Mode Komparasi:</span>
            <button class="btn-stage-tool active" id="btn-compare-split" title="Bandingkan dengan pemisah garis">
              <i data-lucide="columns"></i> Split Slider
            </button>
            <button class="btn-stage-tool" id="btn-compare-hold" title="Tahan spasi atau tombol untuk melihat foto sebelum">
              <i data-lucide="eye"></i> Tahan Spasi (Lihat Asli)
            </button>
          </div>

          <div class="stage-toolbar-group">
            <span class="stage-tool-label">Tampilan:</span>
            <button class="btn-stage-tool" id="btn-toggle-safe-zone">
              <i data-lucide="grid"></i>
              <span id="lbl-safe-zone">Area Aman WA: Mati</span>
            </button>
            <button class="btn-stage-tool" id="btn-zoom-toggle">
              <i data-lucide="zoom-in"></i>
              <span id="lbl-zoom-level">Zoom: Fit</span>
            </button>
          </div>
        </div>

        <!-- Viewport Stage Screen -->
        <div class="stage-screen-canvas" id="canvas-stage-area">
          <div class="aspect-frame" id="aspect-frame-container">
            <!-- Split Slider Container -->
            <div class="split-slider-container" id="split-slider-box">
              <!-- After Canvas (Optimized StatusHD) -->
              <canvas id="canvas-photo-after" class="split-canvas-after"></canvas>

              <!-- Before Canvas Wrapper (Simulated WA Default Burik) -->
              <div class="split-canvas-before-wrapper" id="split-before-wrapper">
                <canvas id="canvas-photo-before" class="split-canvas-before"></canvas>
              </div>

              <!-- Slider Hairline Handle -->
              <div class="split-slider-handle" id="split-handle">
                <i data-lucide="chevrons-left-right"></i>
              </div>

              <!-- Minimal Badges -->
              <div class="compare-badge badge-simulated" id="badge-left-label">Simulasi WA Biasa (Burik)</div>
              <div class="compare-badge badge-optimized" id="badge-right-label">StatusStudio HD (1080p)</div>

              <!-- WhatsApp Safe Zone Guides Overlay -->
              <div class="safe-zone-overlay" id="safe-zone-guides" style="display: none;">
                <div class="safe-zone-top">
                  <span>[AREA TERPOTONG/TERTUTUP OLEH PROFIL & PROGRESS WA]</span>
                </div>
                <div style="flex: 1; display: flex; align-items: center; justify-content: center; pointer-events: none;">
                  <span style="font-family: var(--font-mono); font-size: 11px; color: rgba(37, 211, 102, 0.4); border: 1px dashed rgba(37, 211, 102, 0.3); padding: 4px 8px; border-radius: 4px;">
                    ✓ Area Aman Utama
                  </span>
                </div>
                <div class="safe-zone-bottom">
                  <span>[AREA TERTUTUP OLEH BAR BALAS STATUS WA]</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>

  <!-- ======================================================== -->
  <!-- TAB 2: STUDIO VIDEO -->
  <!-- ======================================================== -->
  <main class="tab-pane" id="tab-video">
    <div class="workstation-grid">
      <!-- Left: Video Controls -->
      <aside class="controls-sidebar">
        <div class="sidebar-section-title">
          <span>Konfigurasi Video WhatsApp</span>
          <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted);">Sweet-Spot Engine</span>
        </div>

        <!-- Video Upload Dropzone -->
        <div class="compact-dropzone" id="video-dropzone">
          <div class="dropzone-icon-wrap">
            <i data-lucide="film"></i>
          </div>
          <div>
            <div class="dropzone-label">Pilih atau Tarik File Video</div>
            <div class="dropzone-sub">MP4, MOV, WebM (Auto-Split jika > 30s)</div>
          </div>
          <input type="file" id="video-file-input" class="hidden-file-input" accept="video/*" />
        </div>

        <!-- Demo Generator Video -->
        <div class="sample-chips-row">
          <button class="sample-chip" id="btn-sample-video">
            <i data-lucide="play-circle"></i> Generate Video Tes WhatsApp
          </button>
        </div>

        <!-- WhatsApp Video Bitrate Profiles -->
        <div class="control-group">
          <div class="control-header">
            <span>Profil Bitrate WhatsApp</span>
            <span class="control-badge" id="badge-video-preset">Sweet-Spot 2.8M</span>
          </div>
          <div class="segment-bar" id="seg-video-preset">
            <button class="segment-item-btn active" data-preset="sweet-spot">
              <span>Sweet-Spot</span>
              <small>1080p @ 2.8 Mbps</small>
            </button>
            <button class="segment-item-btn" data-preset="fast-hd">
              <span>Fast HD</span>
              <small>720p @ 1.8 Mbps</small>
            </button>
            <button class="segment-item-btn" data-preset="ultra">
              <span>Ultra 60FPS</span>
              <small>1080p @ 3.2 Mbps</small>
            </button>
          </div>
        </div>

        <!-- Video Framing -->
        <div class="control-group">
          <div class="control-header">
            <span>Framing Video ke 9:16</span>
            <span class="control-badge" id="badge-video-layout">Latar Blur</span>
          </div>
          <div class="segment-bar" id="seg-video-layout">
            <button class="segment-item-btn active" data-layout="blur-fill">
              <span>Latar Blur</span>
              <small>Sidebars Blur</small>
            </button>
            <button class="segment-item-btn" data-layout="crop-fill">
              <span>Crop Penuh</span>
              <small>Isi Penuh 9:16</small>
            </button>
            <button class="segment-item-btn" data-layout="fit-pad">
              <span>Letterbox</span>
              <small>Fit Hitam</small>
            </button>
          </div>
        </div>

        <!-- Edge & Contrast Sharpening -->
        <div class="control-group">
          <div class="control-header">
            <span>Pertajam Kontras & Detail Frame</span>
            <input type="checkbox" id="check-video-sharpen" checked style="accent-color: var(--wa-green); cursor: pointer;" />
          </div>
          <span class="slider-hint">Menerapkan penajaman mikro frame-by-frame untuk menjaga ketajaman saat re-encode WhatsApp.</span>
        </div>

        <!-- Auto 30s Splitter Container -->
        <div class="control-group" id="video-splitter-container" style="display: none;">
          <div class="control-header">
            <span>Pemotong Status 30 Detik (Auto-Split)</span>
            <span class="control-badge" id="badge-segment-count">2 Bagian</span>
          </div>
          <div class="split-segments-box" id="video-segments-list"></div>
        </div>

        <!-- Process Action -->
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
          <button class="btn-primary-action" id="btn-process-video">
            <i data-lucide="play"></i>
            <span>Proses Video Sweet-Spot (.mp4)</span>
          </button>
        </div>
      </aside>

      <!-- Right: Video Stage Viewport -->
      <section class="viewport-stage">
        <div class="stage-toolbar">
          <div class="stage-toolbar-group">
            <span class="stage-tool-label">Spesifikasi:</span>
            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-primary);" id="video-duration-meta">00:00 (1080x1920)</span>
          </div>

          <div class="stage-toolbar-group">
            <button class="btn-stage-tool" id="btn-play-pause-video">
              <i data-lucide="play" id="icon-play-pause"></i> Putar Video
            </button>
            <button class="btn-stage-tool" id="btn-toggle-video-safe-zone">
              <i data-lucide="grid"></i> Area Aman WA
            </button>
          </div>
        </div>

        <div class="stage-screen-canvas">
          <div class="aspect-frame">
            <div class="video-preview-wrapper">
              <video id="preview-video-element" playsinline loop muted style="display: none;"></video>
              <div id="video-empty-placeholder" class="empty-video-placeholder">
                <i data-lucide="film"></i>
                <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Belum ada video aktif</div>
                <div style="font-size: 11px; color: var(--text-muted);">Tarik file video atau klik "Generate Video Tes WhatsApp".</div>
              </div>

              <!-- Safe Zone Guide on Video -->
              <div class="safe-zone-overlay" id="video-safe-zone-guides" style="display: none;">
                <div class="safe-zone-top">
                  <span>[AREA PROFIL & PROGRESS WA]</span>
                </div>
                <div class="safe-zone-bottom">
                  <span>[AREA BALAS STATUS WA]</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>

  <!-- ======================================================== -->
  <!-- TAB 3: AUDIT DIAGNOSTIK -->
  <!-- ======================================================== -->
  <main class="tab-pane" id="tab-inspector">
    <div class="diagnostic-container">
      <!-- Upload Dropzone for Audit -->
      <div class="compact-dropzone" id="inspector-dropzone" style="padding: 28px 16px;">
        <div class="dropzone-icon-wrap" style="width: 44px; height: 44px;">
          <i data-lucide="scan-search" style="width: 22px; height: 22px;"></i>
        </div>
        <div>
          <div class="dropzone-label" style="font-size: 14px;">Tarik Foto atau Video untuk Didiagnosis</div>
          <div class="dropzone-sub">Deteksi potensi burik, resolusi berlebih, durasi, dan masalah bitrate sebelum diunggah ke WhatsApp.</div>
        </div>
        <input type="file" id="inspector-file-input" class="hidden-file-input" accept="image/*,video/*" />
      </div>

      <!-- Diagnostic Results Dashboard -->
      <div id="inspector-result-box" style="display: none; flex-direction: column; gap: 14px;">
        <div class="audit-header-card">
          <div class="audit-score-summary">
            <div class="score-badge-large" id="diag-score-circle">
              <span class="score-num" id="diag-score-num">85</span>
              <span class="score-label">SKOR HD</span>
            </div>
            <div class="audit-summary-text">
              <h3 id="diag-status-title">Status Kesiapan</h3>
              <p id="diag-status-summary">Ringkasan audit file akan muncul di sini.</p>
              <div class="audit-meta-tags">
                <span class="meta-chip">File: <strong id="diag-filename">-</strong></span>
                <span class="meta-chip">Resolusi: <strong id="diag-res">-</strong></span>
                <span class="meta-chip">Aspek Rasio: <strong id="diag-ratio">-</strong></span>
                <span class="meta-chip">Ukuran: <strong id="diag-size">-</strong></span>
              </div>
            </div>
          </div>

          <button class="btn-primary-action" id="btn-fix-in-studio" style="width: auto; padding: 10px 20px;">
            <i data-lucide="zap"></i>
            <span>Buka & Perbaiki Otomatis di Studio</span>
          </button>
        </div>

        <div class="sidebar-section-title">
          <span>Hasil Temuan & Tindakan Perbaikan</span>
        </div>

        <div class="audit-findings-grid" id="diag-issues-grid"></div>
      </div>
    </div>
  </main>

  <!-- ======================================================== -->
  <!-- TAB 4: SPESIFIKASI & PEDOMAN -->
  <!-- ======================================================== -->
  <main class="tab-pane" id="tab-guides">
    <div class="docs-container">
      <div class="docs-grid">
        <!-- Card 1 -->
        <div class="docs-card">
          <div class="docs-card-header">
            <span class="docs-number-tag">01</span>
            <h3>Trik "Kirim ke Chat Sendiri lalu Forward"</h3>
          </div>
          <p>
            WhatsApp menerapkan algoritma kompresi berbeda antara <em>Status Langsung</em> dengan <em>Chat Media</em>. Media yang diteruskan (forward) dari obrolan tidak mengalami kompresi ulang agresif!
          </p>
          <ul class="docs-steps">
            <li>Kirim foto/video hasil optimasi ke obrolan nomor Anda sendiri ("Kirim Pesan ke Diri Sendiri").</li>
            <li>Di jendela obrolan, aktifkan tombol <strong>"HD"</strong> di bilah atas sebelum mengirim.</li>
            <li>Tahan pesan yang sudah terkirim, lalu tekan tombol <strong>"Teruskan" (Forward)</strong>.</li>
            <li>Pilih <strong>"Status Saya"</strong> untuk membagikan ke status tanpa penurunan kualitas.</li>
          </ul>
        </div>

        <!-- Card 2 -->
        <div class="docs-card">
          <div class="docs-card-header">
            <span class="docs-number-tag">02</span>
            <h3>Aktifkan Setelan "Kualitas Unggahan Media HD"</h3>
          </div>
          <p>
            Secara bawaan, aplikasi WhatsApp diatur ke opsi <em>Kualitas Standar (Otomatis)</em> yang sangat agresif menurunkan resolusi ke 720p/480p.
          </p>
          <ul class="docs-steps">
            <li>Buka WhatsApp &rarr; <strong>Setelan (Settings)</strong> &rarr; <strong>Penyimpanan dan Data</strong>.</li>
            <li>Cari opsi <strong>Kualitas Unggahan Media (Media Upload Quality)</strong>.</li>
            <li>Pilih opsi <strong>"Kualitas HD" (HD Quality)</strong>.</li>
          </ul>
        </div>

        <!-- Card 3 -->
        <div class="docs-card">
          <div class="docs-card-header">
            <span class="docs-number-tag">03</span>
            <h3>Mengapa Trik "Foto ke Video 60FPS" Begitu Ampuh?</h3>
          </div>
          <p>
            WhatsApp mengalokasikan kuota data yang timpang:
          </p>
          <ul class="docs-steps">
            <li><strong>Status Foto Biasa:</strong> Dibatasi keras hanya ~150 - 200 KB per foto.</li>
            <li><strong>Status Video:</strong> WhatsApp mengizinkan bitrate hingga <strong>2.800 kbps (~3.5 MB)</strong>!</li>
            <li>Dengan fitur <em>Foto ke Video 60FPS</em>, WhatsApp akan memutar foto Anda sebagai klip video berbitrate tinggi yang 10x lebih tajam tanpa kompresi JPEG buram.</li>
          </ul>
        </div>

        <!-- Card 4 -->
        <div class="docs-card">
          <div class="docs-card-header">
            <span class="docs-number-tag">04</span>
            <h3>Hindari Mengunggah Foto Mentah 48MP/108MP</h3>
          </div>
          <p>
            Kamera smartphone modern menghasilkan foto beresolusi 4000x3000 piksel atau lebih tinggi (rasio 4:3).
          </p>
          <ul class="docs-steps">
            <li>WhatsApp akan melakukan downscale paksa menggunakan algoritma bilinear cepat yang mematikan micro-contrast dan ketajaman teks/wajah.</li>
            <li>Gunakan StatusStudio untuk melakukan <strong>stepped Lanczos downscaling</strong> ke tepat 1080x1920 (9:16) sebelum diunggah.</li>
          </ul>
        </div>

        <!-- Card 5: Specs Table -->
        <div class="docs-card" style="grid-column: 1 / -1;">
          <div class="docs-card-header">
            <span class="docs-number-tag">05</span>
            <h3>Tabel Parameter Emas WhatsApp Status HD</h3>
          </div>
          <table class="specs-table">
            <thead>
              <tr>
                <th>Tipe Media</th>
                <th>Resolusi Matriks</th>
                <th>Aspek Rasio</th>
                <th>Bitrate / Quality Target</th>
                <th>Profil Codec</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Foto Status Standard</strong></td>
                <td>1080 × 1920 px</td>
                <td>9:16 Vertikal</td>
                <td>Unsharp Mask 45% + sRGB 98%</td>
                <td>JPEG Baseline DCT</td>
              </tr>
              <tr>
                <td><strong>Foto Trik Video 60FPS</strong></td>
                <td>1080 × 1920 px</td>
                <td>9:16 Vertikal</td>
                <td>2.800 kbps (60 FPS)</td>
                <td>H.264 Baseline Level 4.0</td>
              </tr>
              <tr>
                <td><strong>Video Status Sweet-Spot</strong></td>
                <td>1080 × 1920 px</td>
                <td>9:16 Vertikal</td>
                <td>2.800 kbps (GOP 30)</td>
                <td>H.264 AVC1 + AAC 128kbps</td>
              </tr>
              <tr>
                <td><strong>Video Status Fast HD</strong></td>
                <td>720 × 1280 px</td>
                <td>9:16 Vertikal</td>
                <td>1.800 kbps</td>
                <td>H.264 AVC1 + AAC 128kbps</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </main>

  <!-- Progress Processing Modal -->
  <div class="progress-modal" id="progress-modal">
    <div class="progress-box">
      <div style="color: var(--wa-green);">
        <i data-lucide="loader-2" style="animation: spin 1s linear infinite; width: 28px; height: 28px;"></i>
      </div>
      <h4 id="progress-title" style="font-size: 15px; font-weight: 700;">Memproses File...</h4>
      <p id="progress-desc" style="font-size: 12px; color: var(--text-secondary);">Menerapkan algoritma optimasi StatusStudio</p>
      
      <div class="progress-track">
        <div class="progress-bar" id="progress-fill"></div>
      </div>
      <span id="progress-percentage" style="font-family: var(--font-mono); font-size: 13px; color: var(--wa-green); font-weight: 700;">0%</span>
    </div>
  </div>

  <!-- Toast Container -->
  <div class="toast-container" id="toast-container"></div>

  <!-- Minimal Workstation Footer -->
  <footer class="app-footer">
    <div><strong>StatusStudio WA</strong> &bull; Client-side Media Workstation &bull; 100% Privat & Offline</div>
    <div class="footer-links">
      <span>1080×1920 Lanczos</span>
      <span>H.264 WebCodecs</span>
      <span>Adaptive Unsharp Mask</span>
    </div>
  </footer>
`;

// Initialize Lucide Icons
createIcons({ icons });

// Toast Utility
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
  const iconColor = type === 'success' ? 'var(--wa-green)' : 'var(--accent-red)';
  toast.innerHTML = `
    <i data-lucide="${iconName}" style="color: ${iconColor}; width: 15px; height: 15px;"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  createIcons({ icons });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// Tab Switching Logic
const tabButtons = document.querySelectorAll('.nav-tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    switchTab(targetTab);
  });
});

function switchTab(tabName) {
  state.currentTab = tabName;
  tabButtons.forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === tabName));
  tabPanes.forEach((p) => p.classList.toggle('active', p.id === `tab-${tabName}`));
}

// -------------------------------------------------------------
// TAB 1: STUDIO FOTO LOGIC
// -------------------------------------------------------------
const canvasAfter = document.getElementById('canvas-photo-after');
const canvasBefore = document.getElementById('canvas-photo-before');
const splitBeforeWrapper = document.getElementById('split-before-wrapper');
const splitHandle = document.getElementById('split-handle');
const splitSliderBox = document.getElementById('split-slider-box');
const aspectFrameContainer = document.getElementById('aspect-frame-container');
const safeZoneGuides = document.getElementById('safe-zone-guides');

// Update Canvases
function updatePhotoCanvases() {
  if (!state.photo.sourceImg) return;

  const options = {
    targetWidth: state.photo.targetWidth,
    targetHeight: state.photo.targetHeight,
    layout: state.photo.layout,
    sharpenAmount: state.photo.sharpenAmount,
    microDither: state.photo.microDither,
    contrastBoost: state.photo.contrastBoost,
    vibranceBoost: state.photo.vibranceBoost,
  };

  // 1. Render Optimized HD version
  const optCanvas = renderOptimizedPhoto(state.photo.sourceImg, options);
  canvasAfter.width = optCanvas.width;
  canvasAfter.height = optCanvas.height;
  const ctxA = canvasAfter.getContext('2d');
  ctxA.drawImage(optCanvas, 0, 0);

  // 2. Render Simulated WA Default version (Burik)
  const simCanvas = simulateWhatsAppDefaultCompression(state.photo.sourceImg, options);
  canvasBefore.width = simCanvas.width;
  canvasBefore.height = simCanvas.height;
  const ctxB = canvasBefore.getContext('2d');
  ctxB.drawImage(simCanvas, 0, 0);

  // Update telemetry info
  updateTelemetry();
}

// Calculate and render live telemetry numbers
function updateTelemetry() {
  if (!state.photo.sourceImg) return;
  document.getElementById('telem-raw-res').textContent = `${state.photo.rawWidth || state.photo.sourceImg.width} × ${state.photo.rawHeight || state.photo.sourceImg.height}`;

  // Estimate output size
  canvasAfter.toBlob(
    (blob) => {
      if (blob) {
        const kb = Math.round(blob.size / 1024);
        document.getElementById('telem-out-size').textContent = `${kb} KB`;
        document.getElementById('telem-score').textContent = '98% Jernih (Full HD)';
      }
    },
    'image/jpeg',
    0.98
  );
}

// Split slider positioning
function updateSplitSliderPosition(pct) {
  state.photo.sliderPos = pct;
  splitBeforeWrapper.style.width = `${pct}%`;
  splitHandle.style.left = `${pct}%`;
}

// Drag logic for split slider
let isDraggingSlider = false;

function onSliderMove(clientX) {
  const rect = splitSliderBox.getBoundingClientRect();
  const x = clientX - rect.left;
  let pct = (x / rect.width) * 100;
  pct = Math.max(3, Math.min(97, pct));
  updateSplitSliderPosition(pct);
}

splitSliderBox.addEventListener('mousedown', (e) => {
  isDraggingSlider = true;
  onSliderMove(e.clientX);
});

window.addEventListener('mousemove', (e) => {
  if (isDraggingSlider) onSliderMove(e.clientX);
});

window.addEventListener('mouseup', () => {
  isDraggingSlider = false;
});

splitSliderBox.addEventListener('touchstart', (e) => {
  isDraggingSlider = true;
  if (e.touches.length > 0) onSliderMove(e.touches[0].clientX);
});

window.addEventListener('touchmove', (e) => {
  if (isDraggingSlider && e.touches.length > 0) onSliderMove(e.touches[0].clientX);
});

window.addEventListener('touchend', () => {
  isDraggingSlider = false;
});

// Load photo file handler
async function handlePhotoFile(file) {
  try {
    state.photo.file = file;
    state.photo.fileName = file.name ? file.name.replace(/\.[^/.]+$/, '') : 'status_media';
    state.photo.rawSizeBytes = file.size || 0;
    const img = await loadImage(file);
    state.photo.sourceImg = img;
    state.photo.rawWidth = img.naturalWidth || img.width;
    state.photo.rawHeight = img.naturalHeight || img.height;

    // Auto-detect framing: If image is landscape, recommend blur-fill
    if (img.width > img.height) {
      state.photo.layout = 'blur-fill';
      document.querySelectorAll('#seg-photo-layout .segment-item-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-layout') === 'blur-fill');
      });
      document.getElementById('badge-photo-layout').textContent = 'Latar Blur';
    }

    updatePhotoCanvases();
    showToast(`Foto dimuat: ${state.photo.rawWidth}x${state.photo.rawHeight}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Global Clipboard Paste Support (Ctrl+V)
window.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        switchTab('photo');
        handlePhotoFile(file);
        showToast('Gambar dari clipboard berhasil ditempel!');
      }
      break;
    }
  }
});

document.getElementById('btn-paste-shortcut').addEventListener('click', async () => {
  try {
    const clipboardItems = await navigator.clipboard.read();
    for (const item of clipboardItems) {
      const imgType = item.types.find((t) => t.startsWith('image/'));
      if (imgType) {
        const blob = await item.getType(imgType);
        handlePhotoFile(new File([blob], 'clipboard_image.png', { type: imgType }));
        return;
      }
    }
    showToast('Tidak ada gambar di clipboard.', 'error');
  } catch {
    showToast('Gunakan pintasan keyboard Ctrl + V untuk menempel gambar.', 'error');
  }
});

// Photo Dropzone
const photoDropzone = document.getElementById('photo-dropzone');
const photoFileInput = document.getElementById('photo-file-input');

photoDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  photoDropzone.classList.add('dragover');
});

photoDropzone.addEventListener('dragleave', () => {
  photoDropzone.classList.remove('dragover');
});

photoDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  photoDropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    handlePhotoFile(e.dataTransfer.files[0]);
  }
});

photoFileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handlePhotoFile(e.target.files[0]);
  }
});

// Sample Chips
document.getElementById('btn-sample-landscape').addEventListener('click', async () => {
  try {
    const img = await loadImage('/samples/sample_landscape.jpg');
    state.photo.sourceImg = img;
    state.photo.fileName = 'bromo_sunrise_hd';
    state.photo.rawWidth = img.naturalWidth || img.width;
    state.photo.rawHeight = img.naturalHeight || img.height;
    state.photo.layout = 'blur-fill';
    document.querySelectorAll('#seg-photo-layout .segment-item-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-layout') === 'blur-fill');
    });
    document.getElementById('badge-photo-layout').textContent = 'Latar Blur';
    updatePhotoCanvases();
    showToast('Foto Bromo Landscape dimuat');
  } catch (err) {
    showToast('Gagal memuat contoh: ' + err.message, 'error');
  }
});

document.getElementById('btn-sample-portrait').addEventListener('click', async () => {
  try {
    const img = await loadImage('/samples/sample_portrait.jpg');
    state.photo.sourceImg = img;
    state.photo.fileName = 'kafe_portrait_hd';
    state.photo.rawWidth = img.naturalWidth || img.width;
    state.photo.rawHeight = img.naturalHeight || img.height;
    updatePhotoCanvases();
    showToast('Foto Kafe Portrait dimuat');
  } catch (err) {
    showToast('Gagal memuat contoh: ' + err.message, 'error');
  }
});

// Quick Tuning Presets
const rangeSharpen = document.getElementById('range-sharpen');
const rangeDither = document.getElementById('range-dither');
const rangeContrast = document.getElementById('range-contrast');

function setSliders(sharpen, dither, contrast, profileName) {
  rangeSharpen.value = sharpen;
  state.photo.sharpenAmount = sharpen / 100;
  document.getElementById('lbl-val-sharpen').textContent = `${sharpen}%`;

  rangeDither.value = dither;
  state.photo.microDither = dither / 1000;
  document.getElementById('lbl-val-dither').textContent = `${(dither / 10).toFixed(1)}%`;

  rangeContrast.value = contrast;
  state.photo.contrastBoost = contrast / 100;
  document.getElementById('lbl-val-contrast').textContent = `${contrast}%`;

  document.getElementById('lbl-quick-profile').textContent = profileName;
  updatePhotoCanvases();
}

document.getElementById('btn-preset-portrait').addEventListener('click', () => {
  setSliders(35, 10, 5, 'Potret Wajah');
});

document.getElementById('btn-preset-landscape').addEventListener('click', () => {
  setSliders(50, 18, 10, 'Pemandangan');
});

document.getElementById('btn-preset-text').addEventListener('click', () => {
  setSliders(65, 5, 12, 'Teks / Flyer');
});

document.getElementById('btn-preset-reset').addEventListener('click', () => {
  setSliders(45, 15, 8, 'Default');
});

// Slider Input Listeners
rangeSharpen.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  state.photo.sharpenAmount = val / 100;
  document.getElementById('lbl-val-sharpen').textContent = `${val}%`;
  document.getElementById('lbl-quick-profile').textContent = 'Kustom';
  updatePhotoCanvases();
});

rangeDither.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  state.photo.microDither = val / 1000;
  document.getElementById('lbl-val-dither').textContent = `${(val / 10).toFixed(1)}%`;
  document.getElementById('lbl-quick-profile').textContent = 'Kustom';
  updatePhotoCanvases();
});

rangeContrast.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  state.photo.contrastBoost = val / 100;
  document.getElementById('lbl-val-contrast').textContent = `${val}%`;
  document.getElementById('lbl-quick-profile').textContent = 'Kustom';
  updatePhotoCanvases();
});

// Output Format Mode
const photoModeButtons = document.querySelectorAll('#seg-photo-output-mode .segment-item-btn');
photoModeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    photoModeButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.getAttribute('data-mode');
    state.photo.outputMode = mode;
    document.getElementById('badge-photo-mode').textContent =
      mode === 'photo' ? 'Foto HD (1080p)' : 'Video Status 60FPS';
    document.getElementById('btn-download-photo-text').textContent =
      mode === 'photo' ? 'Unduh Foto HD Jernih (.jpg)' : 'Generate Video Status 60FPS (.mp4)';
  });
});

// Layout Framing Mode
const layoutButtons = document.querySelectorAll('#seg-photo-layout .segment-item-btn');
layoutButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    layoutButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.photo.layout = btn.getAttribute('data-layout');
    document.getElementById('badge-photo-layout').textContent = btn.querySelector('span').textContent;
    updatePhotoCanvases();
  });
});

// Compare Mode Tools
const btnCompareSplit = document.getElementById('btn-compare-split');
const btnCompareHold = document.getElementById('btn-compare-hold');

btnCompareSplit.addEventListener('click', () => {
  state.photo.compareMode = 'split';
  btnCompareSplit.classList.add('active');
  btnCompareHold.classList.remove('active');
  splitBeforeWrapper.style.display = 'block';
  splitHandle.style.display = 'flex';
  updateSplitSliderPosition(50);
});

btnCompareHold.addEventListener('click', () => {
  toggleHoldOriginal();
});

function toggleHoldOriginal() {
  state.photo.isHoldingSpace = !state.photo.isHoldingSpace;
  btnCompareHold.classList.toggle('active', state.photo.isHoldingSpace);
  if (state.photo.isHoldingSpace) {
    updateSplitSliderPosition(100);
  } else {
    updateSplitSliderPosition(50);
  }
}

// Spacebar Hold-to-Compare
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body && state.currentTab === 'photo') {
    e.preventDefault();
    updateSplitSliderPosition(100);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && state.currentTab === 'photo') {
    e.preventDefault();
    updateSplitSliderPosition(50);
  }
});

// WhatsApp Safe Zone Guide Toggle
const btnToggleSafeZone = document.getElementById('btn-toggle-safe-zone');
btnToggleSafeZone.addEventListener('click', () => {
  state.photo.showSafeZone = !state.photo.showSafeZone;
  safeZoneGuides.style.display = state.photo.showSafeZone ? 'flex' : 'none';
  btnToggleSafeZone.classList.toggle('active', state.photo.showSafeZone);
  document.getElementById('lbl-safe-zone').textContent = state.photo.showSafeZone
    ? 'Area Aman WA: Aktif'
    : 'Area Aman WA: Mati';
});

// Zoom Level Toggle
const btnZoomToggle = document.getElementById('btn-zoom-toggle');
btnZoomToggle.addEventListener('click', () => {
  if (state.photo.zoomLevel === 'fit') {
    state.photo.zoomLevel = '100';
    aspectFrameContainer.style.transform = 'scale(1.25)';
    document.getElementById('lbl-zoom-level').textContent = 'Zoom: 100%';
    btnZoomToggle.classList.add('active');
  } else if (state.photo.zoomLevel === '100') {
    state.photo.zoomLevel = '200';
    aspectFrameContainer.style.transform = 'scale(1.6)';
    document.getElementById('lbl-zoom-level').textContent = 'Zoom: 200% (Loupe)';
  } else {
    state.photo.zoomLevel = 'fit';
    aspectFrameContainer.style.transform = 'scale(1.0)';
    document.getElementById('lbl-zoom-level').textContent = 'Zoom: Fit';
    btnZoomToggle.classList.remove('active');
  }
});

// Copy to Clipboard Action
document.getElementById('btn-copy-clipboard').addEventListener('click', async () => {
  if (!state.photo.sourceImg) {
    showToast('Pilih foto terlebih dahulu!', 'error');
    return;
  }

  try {
    const blob = await new Promise((res) => canvasAfter.toBlob(res, 'image/png'));
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    showToast('Foto HD berhasil disalin ke Clipboard!');
  } catch (err) {
    showToast('Gagal menyalin: ' + err.message, 'error');
  }
});

// Download Photo / Video
const btnDownloadPhoto = document.getElementById('btn-download-photo');
const progressModal = document.getElementById('progress-modal');
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percentage');
const progressTitle = document.getElementById('progress-title');
const progressDesc = document.getElementById('progress-desc');

btnDownloadPhoto.addEventListener('click', async () => {
  if (!state.photo.sourceImg) {
    showToast('Pilih foto terlebih dahulu!', 'error');
    return;
  }

  if (state.photo.outputMode === 'photo') {
    canvasAfter.toBlob(
      (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.photo.fileName}_StatusStudio_HD.jpg`;
        a.click();
        URL.revokeObjectURL(url);

        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
        });

        showToast('Foto HD siap diunggah ke WhatsApp Status.');
      },
      'image/jpeg',
      0.98
    );
  } else {
    progressModal.classList.add('active');
    progressTitle.textContent = 'Membuat Video Status HD 60FPS...';
    progressDesc.textContent = 'Mengonversi foto dengan bitrate 2.8 Mbps agar WhatsApp tidak mengompres!';

    try {
      const videoBlob = await convertPhotoToStatusVideo(
        canvasAfter,
        {
          durationSeconds: 4,
          fps: 60,
          motionType: 'zoom',
          bitrate: 2800000,
        },
        (pct) => {
          progressFill.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}%`;
        }
      );

      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.photo.fileName}_StatusVideo_60FPS.mp4`;
      a.click();
      URL.revokeObjectURL(url);

      progressModal.classList.remove('active');
      confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 } });
      showToast('Video Status 60FPS berhasil dibuat!');
    } catch (err) {
      progressModal.classList.remove('active');
      showToast('Gagal memproses video: ' + err.message, 'error');
    }
  }
});

// -------------------------------------------------------------
// TAB 2: STUDIO VIDEO LOGIC
// -------------------------------------------------------------
const previewVideoElement = document.getElementById('preview-video-element');
const videoEmptyPlaceholder = document.getElementById('video-empty-placeholder');
const videoDropzone = document.getElementById('video-dropzone');
const videoFileInput = document.getElementById('video-file-input');
const btnPlayPauseVideo = document.getElementById('btn-play-pause-video');
const videoSplitterContainer = document.getElementById('video-splitter-container');
const videoSegmentsList = document.getElementById('video-segments-list');
const btnProcessVideo = document.getElementById('btn-process-video');
const videoSafeZoneGuides = document.getElementById('video-safe-zone-guides');
const btnToggleVideoSafeZone = document.getElementById('btn-toggle-video-safe-zone');

btnPlayPauseVideo.addEventListener('click', () => {
  if (previewVideoElement.paused) {
    previewVideoElement.play();
    btnPlayPauseVideo.innerHTML = '<i data-lucide="pause"></i> Jeda Video';
  } else {
    previewVideoElement.pause();
    btnPlayPauseVideo.innerHTML = '<i data-lucide="play"></i> Putar Video';
  }
  createIcons({ icons });
});

btnToggleVideoSafeZone.addEventListener('click', () => {
  state.video.showSafeZone = !state.video.showSafeZone;
  videoSafeZoneGuides.style.display = state.video.showSafeZone ? 'flex' : 'none';
  btnToggleVideoSafeZone.classList.toggle('active', state.video.showSafeZone);
});

async function handleVideoFile(file) {
  try {
    state.video.file = file;
    const meta = await getVideoMetadata(file);
    state.video.metadata = meta;

    previewVideoElement.src = meta.url;
    previewVideoElement.style.display = 'block';
    videoEmptyPlaceholder.style.display = 'none';
    previewVideoElement.play();
    btnPlayPauseVideo.innerHTML = '<i data-lucide="pause"></i> Jeda Video';

    document.getElementById('video-duration-meta').textContent = `${meta.durationFormatted} (${meta.width}x${meta.height}) • ${meta.sizeMb} MB`;

    if (meta.needsSplit) {
      videoSplitterContainer.style.display = 'flex';
      document.getElementById('badge-segment-count').textContent = `${meta.segments.length} Bagian`;
      renderVideoSegmentsList(meta.segments);
    } else {
      videoSplitterContainer.style.display = 'none';
    }

    createIcons({ icons });
    showToast(`Video dimuat: ${meta.durationFormatted}, ${meta.sizeMb} MB`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderVideoSegmentsList(segments) {
  videoSegmentsList.innerHTML = '';
  segments.forEach((seg) => {
    const item = document.createElement('div');
    item.className = 'segment-row';
    item.innerHTML = `
      <div>
        <strong>${seg.label}</strong>
        <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">${seg.duration.toFixed(1)}s</span>
      </div>
      <button class="btn-segment-download" data-start="${seg.start}" data-end="${seg.end}" data-part="${seg.part}">
        Unduh Part ${seg.part}
      </button>
    `;
    videoSegmentsList.appendChild(item);
  });

  document.querySelectorAll('.btn-segment-download').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const start = parseFloat(btn.getAttribute('data-start'));
      const end = parseFloat(btn.getAttribute('data-end'));
      const part = btn.getAttribute('data-part');
      await processAndDownloadVideoSegment(start, end, `Status_WA_Part_${part}.mp4`);
    });
  });
}

// Preset Video Selection
const videoPresetButtons = document.querySelectorAll('#seg-video-preset .segment-item-btn');
videoPresetButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    videoPresetButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const preset = btn.getAttribute('data-preset');
    state.video.preset = preset;

    if (preset === 'sweet-spot') {
      state.video.targetWidth = 1080;
      state.video.targetHeight = 1920;
      state.video.bitrate = 2800000;
    } else if (preset === 'fast-hd') {
      state.video.targetWidth = 720;
      state.video.targetHeight = 1280;
      state.video.bitrate = 1800000;
    } else if (preset === 'ultra') {
      state.video.targetWidth = 1080;
      state.video.targetHeight = 1920;
      state.video.bitrate = 3200000;
    }

    document.getElementById('badge-video-preset').textContent = btn.querySelector('span').textContent;
  });
});

// Layout video buttons
const videoLayoutButtons = document.querySelectorAll('#seg-video-layout .segment-item-btn');
videoLayoutButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    videoLayoutButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.video.layout = btn.getAttribute('data-layout');
    document.getElementById('badge-video-layout').textContent = btn.querySelector('span').textContent;
  });
});

videoDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  videoDropzone.classList.add('dragover');
});

videoDropzone.addEventListener('dragleave', () => {
  videoDropzone.classList.remove('dragover');
});

videoDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  videoDropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    handleVideoFile(e.dataTransfer.files[0]);
  }
});

videoFileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleVideoFile(e.target.files[0]);
  }
});

// Demo video generator button
document.getElementById('btn-sample-video').addEventListener('click', async () => {
  progressModal.classList.add('active');
  progressTitle.textContent = 'Membuat Video Generator Demo...';
  progressDesc.textContent = 'Menyiapkan animasi 1080x1920 60FPS untuk pengetesan!';
  progressFill.style.width = '50%';
  progressPercent.textContent = '50%';

  try {
    const blob = await generateTestVideo(6);
    const file = new File([blob], 'demo_video_status_hd.mp4', { type: 'video/mp4' });
    await handleVideoFile(file);
    progressModal.classList.remove('active');
    showToast('Video demo WhatsApp HD berhasil dibuat!');
  } catch (err) {
    progressModal.classList.remove('active');
    showToast('Gagal membuat demo: ' + err.message, 'error');
  }
});

async function processAndDownloadVideoSegment(startTime, endTime, filename) {
  if (!state.video.file && !previewVideoElement.src) {
    showToast('Pilih video terlebih dahulu!', 'error');
    return;
  }

  progressModal.classList.add('active');
  progressTitle.textContent = `Mengompresi ${filename}...`;
  progressDesc.textContent = 'Mengunci bitrate di 2.8 Mbps sweet-spot WhatsApp dengan filter ketajaman.';

  try {
    const blob = await processVideoForStatus(
      previewVideoElement,
      {
        startTime,
        endTime,
        targetWidth: state.video.targetWidth,
        targetHeight: state.video.targetHeight,
        bitrate: state.video.bitrate,
        layout: state.video.layout,
        sharpen: document.getElementById('check-video-sharpen').checked,
      },
      (pct) => {
        progressFill.style.width = `${pct}%`;
        progressPercent.textContent = `${pct}%`;
      }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    progressModal.classList.remove('active');
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    showToast(`${filename} berhasil diunduh!`);
  } catch (err) {
    progressModal.classList.remove('active');
    showToast('Gagal memproses video: ' + err.message, 'error');
  }
}

btnProcessVideo.addEventListener('click', async () => {
  const meta = state.video.metadata;
  if (!meta) {
    showToast('Pilih video terlebih dahulu!', 'error');
    return;
  }
  const durationToProcess = Math.min(30, meta.duration);
  await processAndDownloadVideoSegment(0, durationToProcess, 'Status_WA_HD_SweetSpot.mp4');
});

// -------------------------------------------------------------
// TAB 3: AUDIT DIAGNOSTIK
// -------------------------------------------------------------
const inspectorDropzone = document.getElementById('inspector-dropzone');
const inspectorFileInput = document.getElementById('inspector-file-input');
const inspectorResultBox = document.getElementById('inspector-result-box');
const diagScoreCircle = document.getElementById('diag-score-circle');
const diagScoreNum = document.getElementById('diag-score-num');
const diagStatusTitle = document.getElementById('diag-status-title');
const diagStatusSummary = document.getElementById('diag-status-summary');
const diagFilename = document.getElementById('diag-filename');
const diagRes = document.getElementById('diag-res');
const diagRatio = document.getElementById('diag-ratio');
const diagSize = document.getElementById('diag-size');
const diagIssuesGrid = document.getElementById('diag-issues-grid');
const btnFixInStudio = document.getElementById('btn-fix-in-studio');

let currentInspectedFile = null;

async function runInspector(file) {
  try {
    currentInspectedFile = file;
    const report = await inspectMedia(file);
    state.inspector.result = report;

    inspectorResultBox.style.display = 'flex';
    diagScoreNum.textContent = report.score;
    diagScoreCircle.style.borderColor = report.statusColor;
    diagStatusTitle.textContent = report.statusLabel;
    diagStatusTitle.style.color = report.statusColor;
    diagStatusSummary.textContent = report.summaryText;

    diagFilename.textContent = report.fileName;
    diagRes.textContent = `${report.width} × ${report.height}`;
    diagRatio.textContent = `${report.aspectRatio} (${report.isExact9by16 ? '9:16 Pas' : 'Bukan 9:16'})`;
    diagSize.textContent = `${report.sizeMb} MB`;

    diagIssuesGrid.innerHTML = '';
    report.issues.forEach((issue) => {
      const item = document.createElement('div');
      item.className = `finding-card ${issue.severity}`;
      item.innerHTML = `
        <h5>${issue.title}</h5>
        <p>${issue.desc}</p>
        <div class="finding-fix">💡 Solusi: ${issue.fix}</div>
      `;
      diagIssuesGrid.appendChild(item);
    });

    createIcons({ icons });
    showToast(`Diagnostik selesai! Skor: ${report.score}/100`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

inspectorDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  inspectorDropzone.classList.add('dragover');
});

inspectorDropzone.addEventListener('dragleave', () => {
  inspectorDropzone.classList.remove('dragover');
});

inspectorDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  inspectorDropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    runInspector(e.dataTransfer.files[0]);
  }
});

inspectorFileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    runInspector(e.target.files[0]);
  }
});

btnFixInStudio.addEventListener('click', () => {
  if (!currentInspectedFile) return;
  if (currentInspectedFile.type.startsWith('image/')) {
    switchTab('photo');
    handlePhotoFile(currentInspectedFile);
  } else if (currentInspectedFile.type.startsWith('video/')) {
    switchTab('video');
    handleVideoFile(currentInspectedFile);
  }
});

// Auto-load default sample on startup so user immediately sees interactive preview
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const sampleImg = await loadImage('/samples/sample_landscape.jpg');
    state.photo.sourceImg = sampleImg;
    state.photo.fileName = 'bromo_sunrise_hd';
    state.photo.rawWidth = sampleImg.naturalWidth || sampleImg.width;
    state.photo.rawHeight = sampleImg.naturalHeight || sampleImg.height;
    updatePhotoCanvases();
  } catch (err) {
    console.log('Sample initial load:', err);
  }
});
