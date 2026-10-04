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
    outputMode: 'photo', // 'photo' | 'video'
    layout: 'blur-fill', // 'blur-fill' | 'crop-fill' | 'fit-pad'
    targetWidth: 1080,
    targetHeight: 1920,
    sharpenAmount: 0.45,
    microDither: 0.015,
    contrastBoost: 0.08,
    vibranceBoost: 0.12,
    sliderPos: 50, // Percentage for before/after split slider
    showWaOverlay: true,
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
    showWaOverlay: true,
  },
  inspector: {
    result: null,
  },
};

// Render Skeleton Shell
document.querySelector('#app').innerHTML = `
  <!-- Header -->
  <header class="app-header">
    <div class="brand-wrapper">
      <div class="brand-icon-box">
        <i data-lucide="shield-check"></i>
      </div>
      <div class="brand-titles">
        <h1>StatusHD <span class="accent">WA</span></h1>
        <p>Bypass & Kelabui Algoritma Kompresi Status WhatsApp Tanpa Burik</p>
      </div>
    </div>
    <div class="header-badges">
      <div class="pulse-pill">
        <span class="dot"></span>
        <span>Bypass WA 2026 Aktif</span>
      </div>
      <button class="btn-header-action" id="btn-quick-guide">
        <i data-lucide="book-open"></i>
        <span>5 Trik Rahasia WA</span>
      </button>
    </div>
  </header>

  <!-- Tabs Navigation -->
  <nav class="tabs-nav">
    <button class="tab-btn active" data-tab="photo">
      <i data-lucide="image"></i>
      <span>Anti-Burik Foto</span>
    </button>
    <button class="tab-btn" data-tab="video">
      <i data-lucide="video"></i>
      <span>Anti-Burik Video</span>
    </button>
    <button class="tab-btn" data-tab="inspector">
      <i data-lucide="scan-search"></i>
      <span>Diagnostik Status</span>
    </button>
    <button class="tab-btn" data-tab="guides">
      <i data-lucide="sparkles"></i>
      <span>Trik Rahasia WA HD</span>
    </button>
  </nav>

  <!-- Tab 1: Anti-Burik Foto -->
  <section class="tab-content active" id="tab-photo">
    <div class="studio-grid">
      <!-- Left: Photo Controls -->
      <div class="studio-panel">
        <div class="panel-header">
          <h2 class="panel-title"><i data-lucide="sliders"></i> Pengaturan Foto HD</h2>
          <span class="pulse-pill" style="font-size: 11px;">100% Offline & Privat</span>
        </div>

        <!-- Upload Dropzone -->
        <div class="upload-dropzone" id="photo-dropzone">
          <div class="dropzone-icon">
            <i data-lucide="upload-cloud"></i>
          </div>
          <div class="dropzone-text">
            <h4>Pilih atau Tarik Foto ke Sini</h4>
            <p>Mendukung JPG, PNG, WEBP, Foto Kamera 48MP/108MP</p>
          </div>
          <input type="file" id="photo-file-input" class="hidden-file-input" accept="image/*" />
        </div>

        <!-- Sample Quick Presets -->
        <div class="sample-presets-row">
          <span>Coba Contoh Foto:</span>
          <button class="btn-sample" id="btn-sample-landscape">
            <i data-lucide="mountain"></i> Bromo Sunrise (Landscape)
          </button>
          <button class="btn-sample" id="btn-sample-portrait">
            <i data-lucide="coffee"></i> Kafe Neon (Portrait)
          </button>
        </div>

        <!-- Output Format Mode -->
        <div class="control-group">
          <label class="control-label">
            <span>Mode Format Output</span>
            <span class="val-badge" id="badge-photo-mode">Foto HD (1080p)</span>
          </label>
          <div class="segmented-control" id="seg-photo-output-mode">
            <button class="seg-btn active" data-mode="photo">
              <strong>📸 Foto HD</strong>
              <small>JPEG Ultra Sharp</small>
            </button>
            <button class="seg-btn" data-mode="video">
              <strong>🔥 Foto ke Video 60FPS</strong>
              <small>Trik Bitrate WA Tertinggi</small>
            </button>
          </div>
        </div>

        <!-- Aspect Ratio & Framing -->
        <div class="control-group">
          <label class="control-label">
            <span>Framing Status (9:16)</span>
            <span class="val-badge" id="badge-photo-layout">Blur Background</span>
          </label>
          <div class="segmented-control" id="seg-photo-layout">
            <button class="seg-btn active" data-layout="blur-fill">
              <strong>Blur Background</strong>
              <small>Estetik & Utuh</small>
            </button>
            <button class="seg-btn" data-layout="crop-fill">
              <strong>Crop 9:16</strong>
              <small>Layar Penuh</small>
            </button>
            <button class="seg-btn" data-layout="fit-pad">
              <strong>Fit Hitam</strong>
              <small>Border Klasik</small>
            </button>
          </div>
        </div>

        <!-- Sliders: Sharpening & Anti-Banding -->
        <div class="control-group">
          <div class="control-label">
            <span>Ketajaman Adaptif (Unsharp Mask)</span>
            <span class="val-badge" id="lbl-val-sharpen">45%</span>
          </div>
          <input type="range" id="range-sharpen" min="0" max="100" value="45" />
          <small style="color: var(--text-secondary); font-size: 11px;">Menangkal algoritma blur kompresi WhatsApp</small>
        </div>

        <div class="control-group">
          <div class="control-label">
            <span>Anti-Banding Micro-Noise</span>
            <span class="val-badge" id="lbl-val-dither">1.5%</span>
          </div>
          <input type="range" id="range-dither" min="0" max="30" value="15" />
          <small style="color: var(--text-secondary); font-size: 11px;">Mencegah langit/warna gradasi pecah jadi kotak-kotak di WA</small>
        </div>

        <div class="control-group">
          <div class="control-label">
            <span>Clarity & Contrast Boost</span>
            <span class="val-badge" id="lbl-val-contrast">8%</span>
          </div>
          <input type="range" id="range-contrast" min="0" max="20" value="8" />
          <small style="color: var(--text-secondary); font-size: 11px;">Mencegah foto terlihat kusam/pucat setelah dikompresi WA</small>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
          <button class="btn-primary" id="btn-download-photo">
            <i data-lucide="download"></i>
            <span id="btn-download-photo-text">Unduh Foto HD Jernih (.jpg)</span>
          </button>
          <button class="btn-secondary" id="btn-toggle-wa-overlay">
            <i data-lucide="smartphone"></i>
            <span id="btn-toggle-overlay-text">Sembunyikan Overlay Layar WA</span>
          </button>
        </div>
      </div>

      <!-- Right: Live Canvas Preview & Split Slider -->
      <div class="preview-stage-container">
        <div class="preview-toolbar">
          <div class="preview-meta">
            <span>Resolusi: <strong class="highlight" id="preview-meta-res">1080 x 1920 (9:16)</strong></span>
            <span>Bitrate WA Target: <strong class="highlight">Full HD Sweet Spot</strong></span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">
            Geser pemisah untuk membandingkan
          </div>
        </div>

        <!-- Phone Mockup Frame with Split Slider -->
        <div class="phone-mockup-wrapper">
          <div class="phone-dynamic-island"></div>
          
          <div class="phone-screen" id="split-slider-screen">
            <div class="split-slider-container" id="split-slider-box">
              <!-- After (Optimized StatusHD) Canvas -->
              <canvas id="canvas-photo-after" class="split-canvas-after"></canvas>

              <!-- Before (Simulated WhatsApp Default) Wrapper -->
              <div class="split-canvas-before-wrapper" id="split-before-wrapper">
                <canvas id="canvas-photo-before" class="split-canvas-before"></canvas>
              </div>

              <!-- Draggable Divider Handle -->
              <div class="split-slider-handle" id="split-handle">
                <i data-lucide="chevrons-left-right"></i>
              </div>

              <!-- Floating Badges -->
              <div class="split-badge badge-before">WA Biasa (Burik)</div>
              <div class="split-badge badge-after">StatusHD (Jernih)</div>

              <!-- WhatsApp Stories Mockup Overlay -->
              <div class="wa-status-overlay" id="wa-stories-overlay">
                <div class="wa-status-top">
                  <div class="wa-progress-bars">
                    <div class="wa-progress-bar-seg"><div class="wa-progress-bar-fill"></div></div>
                  </div>
                  <div class="wa-user-row">
                    <div class="wa-user-info">
                      <div class="wa-avatar" style="display:flex;align-items:center;justify-content:center;color:#25d366;font-size:16px;">👤</div>
                      <div class="wa-name-time">
                        <h5>Status Saya</h5>
                        <span>Hari ini, 12:45</span>
                      </div>
                    </div>
                    <div style="color: rgba(255,255,255,0.8); font-size: 18px;">⋮</div>
                  </div>
                </div>

                <div class="wa-status-bottom">
                  <div class="wa-reply-bar">
                    <span>Balas status...</span>
                    <div style="display: flex; gap: 10px; align-items: center;">
                      <span>😊</span>
                      <i data-lucide="camera" style="width: 16px; height: 16px;"></i>
                    </div>
                  </div>
                  <div class="wa-views-hint">
                    <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
                    <span>Dilihat oleh 148 orang</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Tab 2: Anti-Burik Video -->
  <section class="tab-content" id="tab-video">
    <div class="studio-grid">
      <!-- Left: Video Controls -->
      <div class="studio-panel">
        <div class="panel-header">
          <h2 class="panel-title"><i data-lucide="video"></i> Kompresor Video Sweet Spot</h2>
          <span class="pulse-pill" style="font-size: 11px;">Anti Pecah & Stutter</span>
        </div>

        <!-- Video Upload Dropzone -->
        <div class="upload-dropzone" id="video-dropzone">
          <div class="dropzone-icon">
            <i data-lucide="film"></i>
          </div>
          <div class="dropzone-text">
            <h4>Pilih atau Tarik File Video ke Sini</h4>
            <p>Mendukung MP4, MOV, WebM (Auto Split jika > 30 detik)</p>
          </div>
          <input type="file" id="video-file-input" class="hidden-file-input" accept="video/*" />
        </div>

        <!-- Sample Video Button -->
        <div class="sample-presets-row">
          <span>Ingin tes langsung?</span>
          <button class="btn-sample" id="btn-sample-video">
            <i data-lucide="play-circle"></i> Buat Video Generator Tes Otomatis
          </button>
        </div>

        <!-- WhatsApp Video Preset Engine -->
        <div class="control-group">
          <label class="control-label">
            <span>Preset Profil WhatsApp</span>
            <span class="val-badge" id="badge-video-preset">Sweet Spot (2.8 Mbps)</span>
          </label>
          <div class="segmented-control" id="seg-video-preset">
            <button class="seg-btn active" data-preset="sweet-spot">
              <strong>⚡ WA Sweet Spot</strong>
              <small>1080p @ 2.8 Mbps</small>
            </button>
            <button class="seg-btn" data-preset="fast-hd">
              <strong>🚀 Fast HD</strong>
              <small>720p @ 1.8 Mbps</small>
            </button>
            <button class="seg-btn" data-preset="ultra">
              <strong>💎 Ultra 60FPS</strong>
              <small>1080p @ 3.2 Mbps</small>
            </button>
          </div>
        </div>

        <!-- Video Framing -->
        <div class="control-group">
          <label class="control-label">
            <span>Framing Video Landscape ke 9:16</span>
            <span class="val-badge" id="badge-video-layout">Blur Background</span>
          </label>
          <div class="segmented-control" id="seg-video-layout">
            <button class="seg-btn active" data-layout="blur-fill">
              <strong>Blur Sidebars</strong>
              <small>Estetik & Tidak Kecil</small>
            </button>
            <button class="seg-btn" data-layout="crop-fill">
              <strong>Crop Layar Penuh</strong>
              <small>Isi Penuh 9:16</small>
            </button>
            <button class="seg-btn" data-layout="fit-pad">
              <strong>Fit Hitam</strong>
              <small>Klasik</small>
            </button>
          </div>
        </div>

        <!-- Video Sharpening -->
        <div class="control-group">
          <label class="control-label">
            <span>Pertajam Kontras & Detail Video</span>
            <input type="checkbox" id="check-video-sharpen" checked style="accent-color: var(--wa-green); width: 18px; height: 18px;" />
          </label>
          <small style="color: var(--text-secondary); font-size: 11px;">Menerapkan unsharp mask frame-by-frame untuk menjaga ketajaman saat re-encode WA.</small>
        </div>

        <!-- Auto 30s Splitter Info -->
        <div class="control-group" id="video-splitter-container" style="display: none;">
          <label class="control-label">
            <span>✂️ Pemotong Status 30 Detik (Auto Split)</span>
            <span class="val-badge" id="badge-segment-count">2 Bagian</span>
          </label>
          <div class="split-segments-list" id="video-segments-list"></div>
        </div>

        <!-- Action Button -->
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
          <button class="btn-primary" id="btn-process-video">
            <i data-lucide="sparkles"></i>
            <span>Proses Video Anti-Burik (.mp4)</span>
          </button>
        </div>
      </div>

      <!-- Right: Live Video Player Preview -->
      <div class="preview-stage-container">
        <div class="preview-toolbar">
          <div class="preview-meta">
            <span>Format: <strong class="highlight">1080x1920 (9:16 MP4)</strong></span>
            <span>Durasi: <strong class="highlight" id="video-duration-meta">00:00</strong></span>
          </div>
          <button class="btn-sample" id="btn-play-pause-video">
            <i data-lucide="play" id="icon-play-pause"></i> Putar Video
          </button>
        </div>

        <!-- Phone Mockup with Video Element -->
        <div class="phone-mockup-wrapper">
          <div class="phone-dynamic-island"></div>
          
          <div class="phone-screen">
            <video id="preview-video-element" playsinline loop muted style="width: 100%; height: 100%; object-fit: cover;"></video>
            
            <div id="video-empty-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-muted); padding: 20px; text-align: center;">
              <i data-lucide="film" style="width: 48px; height: 48px; color: rgba(255,255,255,0.2);"></i>
              <p style="font-size: 13px;">Belum ada video dipilih.<br>Tarik video atau klik "Buat Video Generator Tes".</p>
            </div>

            <!-- WhatsApp Overlay on Video -->
            <div class="wa-status-overlay" id="wa-video-overlay" style="display: none;">
              <div class="wa-status-top">
                <div class="wa-progress-bars">
                  <div class="wa-progress-bar-seg"><div class="wa-progress-bar-fill" id="video-progress-indicator" style="width: 0%;"></div></div>
                </div>
                <div class="wa-user-row">
                  <div class="wa-user-info">
                    <div class="wa-avatar" style="display:flex;align-items:center;justify-content:center;color:#25d366;font-size:16px;">👤</div>
                    <div class="wa-name-time">
                      <h5>Status Saya</h5>
                      <span>Hari ini, Baru saja</span>
                    </div>
                  </div>
                  <div style="color: rgba(255,255,255,0.8); font-size: 18px;">⋮</div>
                </div>
              </div>

              <div class="wa-status-bottom">
                <div class="wa-reply-bar">
                  <span>Balas video...</span>
                  <div style="display: flex; gap: 10px; align-items: center;">
                    <span>🔥</span>
                    <i data-lucide="heart" style="width: 16px; height: 16px; color: #ef4444;"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Tab 3: Diagnostik Status WA (Inspector) -->
  <section class="tab-content" id="tab-inspector">
    <div class="inspector-card">
      <div class="panel-header">
        <h2 class="panel-title"><i data-lucide="scan-search"></i> Diagnostik & Analisis Status WA</h2>
        <span class="pulse-pill">Deteksi Dini Status Burik</span>
      </div>

      <div class="upload-dropzone" id="inspector-dropzone">
        <div class="dropzone-icon">
          <i data-lucide="file-search"></i>
        </div>
        <div class="dropzone-text">
          <h4>Tarik Foto atau Video untuk Didiagnosis</h4>
          <p>Ketahui apakah file Anda berisiko dikompres hancur oleh WhatsApp sebelum diunggah!</p>
        </div>
        <input type="file" id="inspector-file-input" class="hidden-file-input" accept="image/*,video/*" />
      </div>

      <!-- Diagnostic Results Box -->
      <div id="inspector-result-box" style="display: none; flex-direction: column; gap: 20px;">
        <div class="inspector-score-header">
          <div class="score-circle" id="diag-score-circle">
            <span class="number" id="diag-score-num">85</span>
            <span class="label">SKOR HD</span>
          </div>
          <div class="score-info">
            <h3 id="diag-status-title">Status Analisis</h3>
            <p id="diag-status-summary">Ringkasan analisis file akan muncul di sini.</p>
            <div style="display: flex; gap: 14px; margin-top: 10px; font-size: 12px; color: var(--text-secondary); flex-wrap: wrap;">
              <span>File: <strong class="highlight" id="diag-filename" style="color: var(--text-primary);">-</strong></span>
              <span>Resolusi: <strong class="highlight" id="diag-res" style="color: var(--text-primary);">-</strong></span>
              <span>Rasio: <strong class="highlight" id="diag-ratio" style="color: var(--text-primary);">-</strong></span>
              <span>Ukuran: <strong class="highlight" id="diag-size" style="color: var(--text-primary);">-</strong></span>
            </div>
          </div>
        </div>

        <h4 style="font-family: var(--font-heading); font-size: 16px; color: var(--text-highlight);">
          Temuan Analisis & Tindakan Perbaikan:
        </h4>
        <div class="diagnostic-grid" id="diag-issues-grid"></div>

        <button class="btn-primary" id="btn-fix-in-studio" style="max-width: 320px; align-self: flex-start;">
          <i data-lucide="zap"></i>
          <span>Perbaiki Otomatis di Studio</span>
        </button>
      </div>
    </div>
  </section>

  <!-- Tab 4: 5 Trik Rahasia WA HD (Cheat Sheet & Guides) -->
  <section class="tab-content" id="tab-guides">
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <div class="studio-panel">
        <h2 class="panel-title"><i data-lucide="sparkles"></i> 5 Trik Rahasia WhatsApp Bebas Burik (Update 2026)</h2>
        <p style="color: var(--text-secondary); font-size: 14px;">
          WhatsApp secara default membatasi ukuran data untuk menghemat bandwidth server dan kuota pengguna. Gunakan kombinasi website ini dengan 5 trik rahasia di bawah ini untuk hasil 100% jernih seperti kamera iPhone Pro!
        </p>
      </div>

      <div class="guides-grid">
        <!-- Trik 1 -->
        <div class="guide-card">
          <div class="guide-number-badge">1</div>
          <h3>Trik "Kirim ke Chat Sendiri lalu Teruskan"</h3>
          <p>
            Ini adalah trik paling ampuh yang sering dipakai content creator. WhatsApp tidak melakukan kompresi ulang yang agresif pada media yang "Diteruskan" (Forwarded) dari ruang obrolan!
          </p>
          <ul class="guide-steps">
            <li>Kirim foto/video yang sudah dioptimasi ke <strong>nomor Anda sendiri</strong> (Pesan Berbintang / "Kirim Pesan ke Diri Sendiri").</li>
            <li>Saat di ruang obrolan, klik tombol <strong>"HD"</strong> di bagian atas sebelum menekan tombol kirim.</li>
            <li>Setelah terkirim, tahan foto/video lalu klik tombol <strong>"Teruskan" (Forward)</strong>.</li>
            <li>Pilih <strong>"Status Saya"</strong> lalu bagikan. WhatsApp akan mempertahankan resolusi HD penuh!</li>
          </ul>
        </div>

        <!-- Trik 2 -->
        <div class="guide-card">
          <div class="guide-number-badge">2</div>
          <h3>Aktifkan "Kualitas Unggahan Media HD" di Setelan</h3>
          <p>
            Banyak pengguna tidak menyadari bahwa pengaturan default WhatsApp diatur ke "Otomatis" (yang sering menurunkan kualitas menjadi SD).
          </p>
          <ul class="guide-steps">
            <li>Buka WhatsApp > ketuk titik tiga (Setelan / Settings).</li>
            <li>Pilih menu <strong>Penyimpanan dan Data (Storage and Data)</strong>.</li>
            <li>Gulir ke bawah ke bagian <strong>Kualitas Unggahan Media (Media Upload Quality)</strong>.</li>
            <li>Ubah dari "Kualitas Standar" menjadi <strong>"Kualitas HD" (HD Quality)</strong>.</li>
          </ul>
        </div>

        <!-- Trik 3 -->
        <div class="guide-card">
          <div class="guide-number-badge">3</div>
          <h3>Trik Konversi "Foto ke Video 60FPS"</h3>
          <p>
            Mengapa status foto sering burik dibanding status video? Karena WhatsApp mengalokasikan kuota berbeda:
          </p>
          <ul class="guide-steps">
            <li><strong>Status Foto:</strong> WhatsApp hanya memberikan alokasi ukuran ~150 - 200 KB per foto.</li>
            <li><strong>Status Video:</strong> WhatsApp mengizinkan bitrate hingga <strong>2.800 kbps (sekitar 3-5 MB)</strong>!</li>
            <li>Gunakan fitur <strong>"Foto ke Video 60FPS"</strong> di tab Anti-Burik Foto untuk mengelabui WhatsApp agar memutar foto Anda di dalam pemutar video ber-bitrate tinggi yang super jernih.</li>
          </ul>
        </div>

        <!-- Trik 4 -->
        <div class="guide-card">
          <div class="guide-number-badge">4</div>
          <h3>Gunakan Rasio Pas 1080x1920 (9:16)</h3>
          <p>
            Jangan pernah mengunggah foto kamera mentah 48MP/108MP (rasio 4:3) langsung ke status.
          </p>
          <ul class="guide-steps">
            <li>Ponsel Anda akan melakukan pemotongan atau downscaling bilinear cepat yang merusak ketajaman tepi.</li>
            <li>Fitur <strong>Blur Background</strong> di website ini mempertahankan foto asli Anda tetap utuh di tengah tanpa terpotong, dengan latar belakang blur profesional.</li>
          </ul>
        </div>

        <!-- Trik 5 -->
        <div class="guide-card">
          <div class="guide-number-badge">5</div>
          <h3>Batasi Durasi Video di 29.5 Detik</h3>
          <p>
            Status WhatsApp memiliki batas keras 30 detik. Jika video Anda berdurasi 31 atau 32 detik, WhatsApp akan memotong kasar dan sering kali merusak sinkronisasi audio dan keyframe di akhir video.
          </p>
          <ul class="guide-steps">
            <li>Gunakan fitur <strong>Auto 30s Splitter</strong> di tab Video untuk membagi klip panjang menjadi slide berurutan yang mulus.</li>
          </ul>
        </div>

        <!-- Cheat Sheet Parameter Table -->
        <div class="guide-card" style="grid-column: 1 / -1;">
          <h3>📊 Tabel Parameter Emas Status WhatsApp HD</h3>
          <table class="cheat-table">
            <thead>
              <tr>
                <th>Tipe Media</th>
                <th>Resolusi Optimal</th>
                <th>Aspek Rasio</th>
                <th>Bitrate Emas</th>
                <th>Codec & Format</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Foto Status Standard</strong></td>
                <td>1080 x 1920 px</td>
                <td>9:16 Vertikal</td>
                <td>Unsharp Mask 45%</td>
                <td>JPEG (sRGB, Quality 98%)</td>
              </tr>
              <tr>
                <td><strong>Foto Trik Video 60FPS</strong></td>
                <td>1080 x 1920 px</td>
                <td>9:16 Vertikal</td>
                <td>2.800 kbps</td>
                <td>H.264 MP4 (60 FPS)</td>
              </tr>
              <tr>
                <td><strong>Video Status Full HD</strong></td>
                <td>1080 x 1920 px</td>
                <td>9:16 Vertikal</td>
                <td>2.500 - 2.800 kbps</td>
                <td>H.264 Baseline / GOP 30</td>
              </tr>
              <tr>
                <td><strong>Video Status Fast HD</strong></td>
                <td>720 x 1280 px</td>
                <td>9:16 Vertikal</td>
                <td>1.600 - 1.800 kbps</td>
                <td>H.264 AAC Stereo 128kbps</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>

  <!-- Progress Processing Modal -->
  <div class="process-progress-modal" id="progress-modal">
    <div class="progress-card">
      <div class="brand-icon-box" style="animation: spin 3s linear infinite;">
        <i data-lucide="loader-2"></i>
      </div>
      <h3 id="progress-title" style="font-size: 18px; color: var(--text-highlight);">Memproses Status HD...</h3>
      <p id="progress-desc" style="font-size: 13px; color: var(--text-secondary);">Menerapkan algoritma bypass kompresi WhatsApp</p>
      
      <div class="progress-bar-track">
        <div class="progress-bar-fill" id="progress-fill"></div>
      </div>
      <span id="progress-percentage" style="font-family: var(--font-mono); font-size: 14px; color: var(--wa-green); font-weight: 700;">0%</span>
    </div>
  </div>

  <!-- Toast Container -->
  <div class="toast-container" id="toast-container"></div>

  <!-- Footer -->
  <footer class="app-footer">
    <p><strong>StatusHD WA</strong> &bull; Dibuat untuk hasil status WhatsApp jernih, tajam, dan Full HD tanpa burik.</p>
    <div class="footer-tags">
      <span class="footer-tag">Client-side Encoding</span>
      <span class="footer-tag">H.264 MP4 Sweet-Spot</span>
      <span class="footer-tag">Unsharp Mask Filter</span>
      <span class="footer-tag">Privasi Terjaga</span>
    </div>
  </footer>
`;

// Initialize Lucide Icons
createIcons({ icons });

// Show Toast Utility
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" style="color: ${type === 'success' ? 'var(--wa-green)' : 'var(--wa-danger)'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  createIcons({ icons });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Tab Switching Logic
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    switchTab(targetTab);
  });
});

document.getElementById('btn-quick-guide').addEventListener('click', () => {
  switchTab('guides');
});

function switchTab(tabName) {
  state.currentTab = tabName;
  tabButtons.forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === tabName));
  tabContents.forEach((c) => c.classList.toggle('active', c.id === `tab-${tabName}`));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -------------------------------------------------------------
// TAB 1: PHOTO OPTIMIZER LOGIC
// -------------------------------------------------------------
const canvasAfter = document.getElementById('canvas-photo-after');
const canvasBefore = document.getElementById('canvas-photo-before');
const splitBeforeWrapper = document.getElementById('split-before-wrapper');
const splitHandle = document.getElementById('split-handle');
const splitSliderBox = document.getElementById('split-slider-box');

// Render canvases
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

  updateSplitSliderPosition(state.photo.sliderPos);
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
  pct = Math.max(5, Math.min(95, pct));
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

// Touch support for mobile devices
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
    state.photo.fileName = file.name.replace(/\.[^/.]+$/, '');
    const img = await loadImage(file);
    state.photo.sourceImg = img;
    updatePhotoCanvases();
    showToast(`Foto berhasil dimuat: ${file.name}`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Dropzone setup for photo
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

// Sample presets buttons
document.getElementById('btn-sample-landscape').addEventListener('click', async () => {
  try {
    const img = await loadImage('/samples/sample_landscape.jpg');
    state.photo.sourceImg = img;
    state.photo.fileName = 'bromo_sunrise_hd';
    state.photo.layout = 'blur-fill';
    document.querySelectorAll('#seg-photo-layout .seg-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-layout') === 'blur-fill');
    });
    updatePhotoCanvases();
    showToast('Contoh Foto Gunung Bromo (Landscape) berhasil dimuat!');
  } catch (err) {
    showToast('Gagal memuat contoh: ' + err.message, 'error');
  }
});

document.getElementById('btn-sample-portrait').addEventListener('click', async () => {
  try {
    const img = await loadImage('/samples/sample_portrait.jpg');
    state.photo.sourceImg = img;
    state.photo.fileName = 'kafe_portrait_hd';
    updatePhotoCanvases();
    showToast('Contoh Foto Kafe (Portrait) berhasil dimuat!');
  } catch (err) {
    showToast('Gagal memuat contoh: ' + err.message, 'error');
  }
});

// Output mode buttons (Photo vs Video 60FPS)
const photoModeButtons = document.querySelectorAll('#seg-photo-output-mode .seg-btn');
photoModeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    photoModeButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.getAttribute('data-mode');
    state.photo.outputMode = mode;
    document.getElementById('badge-photo-mode').textContent =
      mode === 'photo' ? 'Foto HD (1080p)' : 'Video Status 60FPS';
    document.getElementById('btn-download-photo-text').textContent =
      mode === 'photo' ? 'Unduh Foto HD Jernih (.jpg)' : 'Generate & Unduh Video 60FPS (.mp4)';
  });
});

// Layout buttons (blur-fill, crop-fill, fit-pad)
const layoutButtons = document.querySelectorAll('#seg-photo-layout .seg-btn');
layoutButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    layoutButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.photo.layout = btn.getAttribute('data-layout');
    document.getElementById('badge-photo-layout').textContent = btn.querySelector('strong').textContent;
    updatePhotoCanvases();
  });
});

// Sliders event listeners
const rangeSharpen = document.getElementById('range-sharpen');
const rangeDither = document.getElementById('range-dither');
const rangeContrast = document.getElementById('range-contrast');

rangeSharpen.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  state.photo.sharpenAmount = val / 100;
  document.getElementById('lbl-val-sharpen').textContent = `${val}%`;
  updatePhotoCanvases();
});

rangeDither.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  state.photo.microDither = val / 1000;
  document.getElementById('lbl-val-dither').textContent = `${(val / 10).toFixed(1)}%`;
  updatePhotoCanvases();
});

rangeContrast.addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  state.photo.contrastBoost = val / 100;
  document.getElementById('lbl-val-contrast').textContent = `${val}%`;
  updatePhotoCanvases();
});

// WhatsApp Overlay toggle
const btnToggleWaOverlay = document.getElementById('btn-toggle-wa-overlay');
btnToggleWaOverlay.addEventListener('click', () => {
  state.photo.showWaOverlay = !state.photo.showWaOverlay;
  document.getElementById('wa-stories-overlay').style.display = state.photo.showWaOverlay ? 'flex' : 'none';
  document.getElementById('btn-toggle-overlay-text').textContent = state.photo.showWaOverlay
    ? 'Sembunyikan Overlay Layar WA'
    : 'Tampilkan Overlay Layar WA';
});

// Download Photo / Video Handler
const btnDownloadPhoto = document.getElementById('btn-download-photo');
const progressModal = document.getElementById('progress-modal');
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percentage');
const progressTitle = document.getElementById('progress-title');
const progressDesc = document.getElementById('progress-desc');

btnDownloadPhoto.addEventListener('click', async () => {
  if (!state.photo.sourceImg) {
    showToast('Silakan pilih foto terlebih dahulu!', 'error');
    return;
  }

  if (state.photo.outputMode === 'photo') {
    // Direct JPEG download
    canvasAfter.toBlob(
      (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.photo.fileName}_StatusHD.jpg`;
        a.click();
        URL.revokeObjectURL(url);

        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.7 },
        });

        showToast('Foto HD berhasil diunduh! Siap diunggah ke status WhatsApp.');
      },
      'image/jpeg',
      0.98
    );
  } else {
    // Generate Photo to 60FPS Video
    progressModal.classList.add('active');
    progressTitle.textContent = 'Membuat Video Status HD 60FPS...';
    progressDesc.textContent = 'Mengonversi foto dengan bitrate tinggi agar WhatsApp tidak mengompres!';

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
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
      showToast('Video Status 60FPS berhasil digenerate! Unggah sebagai video di WA.');
    } catch (err) {
      progressModal.classList.remove('active');
      showToast('Gagal memproses video: ' + err.message, 'error');
    }
  }
});

// -------------------------------------------------------------
// TAB 2: VIDEO SWEET-SPOT & AUTO SPLITTER LOGIC
// -------------------------------------------------------------
const previewVideoElement = document.getElementById('preview-video-element');
const videoEmptyPlaceholder = document.getElementById('video-empty-placeholder');
const waVideoOverlay = document.getElementById('wa-video-overlay');
const videoDropzone = document.getElementById('video-dropzone');
const videoFileInput = document.getElementById('video-file-input');
const btnPlayPauseVideo = document.getElementById('btn-play-pause-video');
const iconPlayPause = document.getElementById('icon-play-pause');
const videoProgressIndicator = document.getElementById('video-progress-indicator');
const videoSplitterContainer = document.getElementById('video-splitter-container');
const videoSegmentsList = document.getElementById('video-segments-list');
const btnProcessVideo = document.getElementById('btn-process-video');

// Play/Pause video toggle
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

previewVideoElement.addEventListener('timeupdate', () => {
  if (previewVideoElement.duration > 0) {
    const pct = (previewVideoElement.currentTime / previewVideoElement.duration) * 100;
    videoProgressIndicator.style.width = `${pct}%`;
  }
});

async function handleVideoFile(file) {
  try {
    state.video.file = file;
    const meta = await getVideoMetadata(file);
    state.video.metadata = meta;

    previewVideoElement.src = meta.url;
    previewVideoElement.style.display = 'block';
    videoEmptyPlaceholder.style.display = 'none';
    waVideoOverlay.style.display = 'flex';
    previewVideoElement.play();
    btnPlayPauseVideo.innerHTML = '<i data-lucide="pause"></i> Jeda Video';

    document.getElementById('video-duration-meta').textContent = `${meta.durationFormatted} (${meta.width}x${meta.height})`;

    // Check if auto-splitting is needed
    if (meta.needsSplit) {
      videoSplitterContainer.style.display = 'flex';
      document.getElementById('badge-segment-count').textContent = `${meta.segments.length} Bagian Status`;
      renderVideoSegmentsList(meta.segments);
    } else {
      videoSplitterContainer.style.display = 'none';
    }

    createIcons({ icons });
    showToast(`Video berhasil dimuat: ${meta.durationFormatted}, ${meta.sizeMb} MB`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderVideoSegmentsList(segments) {
  videoSegmentsList.innerHTML = '';
  segments.forEach((seg) => {
    const item = document.createElement('div');
    item.className = 'segment-item ready';
    item.innerHTML = `
      <div>
        <strong>${seg.label}</strong>
        <div style="font-size: 11px; color: var(--text-secondary);">${seg.duration.toFixed(1)} detik</div>
      </div>
      <button class="btn-download-segment" data-start="${seg.start}" data-end="${seg.end}" data-part="${seg.part}">
        Download Bagian ${seg.part}
      </button>
    `;
    videoSegmentsList.appendChild(item);
  });

  // Attach individual segment download listeners
  document.querySelectorAll('.btn-download-segment').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const start = parseFloat(btn.getAttribute('data-start'));
      const end = parseFloat(btn.getAttribute('data-end'));
      const part = btn.getAttribute('data-part');
      await processAndDownloadVideoSegment(start, end, `Status_WA_Part_${part}.mp4`);
    });
  });
}

// Preset selection
const videoPresetButtons = document.querySelectorAll('#seg-video-preset .seg-btn');
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

    document.getElementById('badge-video-preset').textContent = btn.querySelector('strong').textContent;
  });
});

// Layout buttons for video
const videoLayoutButtons = document.querySelectorAll('#seg-video-layout .seg-btn');
videoLayoutButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    videoLayoutButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.video.layout = btn.getAttribute('data-layout');
    document.getElementById('badge-video-layout').textContent = btn.querySelector('strong').textContent;
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

// Sample video generator button
document.getElementById('btn-sample-video').addEventListener('click', async () => {
  progressModal.classList.add('active');
  progressTitle.textContent = 'Membuat Video Generator Demo...';
  progressDesc.textContent = 'Menyiapkan animasi 1080x1920 60FPS untuk pengetesan!';
  progressFill.style.width = '60%';
  progressPercent.textContent = '60%';

  try {
    const blob = await generateTestVideo(6);
    const file = new File([blob], 'demo_video_status_hd.mp4', { type: 'video/mp4' });
    await handleVideoFile(file);
    progressModal.classList.remove('active');
    showToast('Video demo WhatsApp HD berhasil digenerate!');
  } catch (err) {
    progressModal.classList.remove('active');
    showToast('Gagal membuat video demo: ' + err.message, 'error');
  }
});

async function processAndDownloadVideoSegment(startTime, endTime, filename) {
  if (!state.video.file && !previewVideoElement.src) {
    showToast('Silakan pilih video terlebih dahulu!', 'error');
    return;
  }

  progressModal.classList.add('active');
  progressTitle.textContent = `Mengompresi ${filename}...`;
  progressDesc.textContent = 'Mengunci bitrate di 2.8 Mbps sweet-spot WhatsApp dengan filter ketajaman';

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
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    showToast(`${filename} berhasil diunduh! Siap diunggah ke status WA.`);
  } catch (err) {
    progressModal.classList.remove('active');
    showToast('Gagal memproses video: ' + err.message, 'error');
  }
}

btnProcessVideo.addEventListener('click', async () => {
  const meta = state.video.metadata;
  if (!meta) {
    showToast('Silakan pilih video terlebih dahulu!', 'error');
    return;
  }

  const durationToProcess = Math.min(30, meta.duration);
  await processAndDownloadVideoSegment(0, durationToProcess, 'Status_WA_HD_Optimized.mp4');
});

// -------------------------------------------------------------
// TAB 3: DIAGNOSTIK STATUS WA (INSPECTOR)
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

    // Display results
    inspectorResultBox.style.display = 'flex';
    diagScoreNum.textContent = report.score;
    diagScoreCircle.style.borderColor = report.statusColor;
    diagStatusTitle.textContent = report.statusLabel;
    diagStatusTitle.style.color = report.statusColor;
    diagStatusSummary.textContent = report.summaryText;

    diagFilename.textContent = report.fileName;
    diagRes.textContent = `${report.width} x ${report.height}`;
    diagRatio.textContent = `${report.aspectRatio} (${report.isExact9by16 ? '9:16' : 'Non-9:16'})`;
    diagSize.textContent = `${report.sizeMb} MB`;

    // Render issues grid
    diagIssuesGrid.innerHTML = '';
    report.issues.forEach((issue) => {
      const item = document.createElement('div');
      item.className = `diag-item ${issue.severity}`;
      item.innerHTML = `
        <h5>${issue.title}</h5>
        <p>${issue.desc}</p>
        <div class="fix-box">💡 Solusi: ${issue.fix}</div>
      `;
      diagIssuesGrid.appendChild(item);
    });

    createIcons({ icons });
    showToast(`Diagnostik selesai! Skor Kesiapan: ${report.score}%`);
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

// "Perbaiki Otomatis di Studio" button
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

// Auto-load default sample on startup so user immediately sees rich interactive preview
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const sampleImg = await loadImage('/samples/sample_landscape.jpg');
    state.photo.sourceImg = sampleImg;
    state.photo.fileName = 'bromo_sunrise_hd';
    updatePhotoCanvases();
  } catch (err) {
    console.log('Sample initial load:', err);
  }
});
