---
version: alpha
name: Cupu-Finance-Soft-Warm-Minimalist
description: |
  Design system untuk Cupu Finance: aplikasi pencatatan keuangan harian dengan estetika
  Soft Warm Minimalist (Japandi / Warm Earthy aesthetic). Menggunakan palet netral hangat
  [#edede9, #d6ccc2, #f5ebe0, #e3d5ca, #d5bdaf] yang sangat menenangkan di mata, bebas silau,
  tanpa elemen neon agresif, serta mengedepankan kesederhanaan satu tangan (one-thumb reachability).

colors:
  # Base Warm Neutral Palette
  canvas: "#edede9"             # Kanvas utama aplikasi (Warm Alabaster)
  surface-card: "#f5ebe0"       # Permukaan kartu transaksi, form, & nav (Soft Linen)
  surface-subtle: "#e3d5ca"     # Kategori chip tidak aktif, progress track (Pale Almond)
  hairline: "#d6ccc2"           # Garis border halus & divider (Warm Sand)
  primary: "#d5bdaf"            # Aksen brand utama, tombol Simpan, chip aktif (Warm Taupe)
  primary-dark: "#b89f8f"       # State ditekan / hover tombol utama
  
  # Typography & Ink
  ink: "#2d2825"                # Teks judul & angka utama (Deep Espresso Charcoal)
  ink-mute: "#6b635b"           # Teks catatan & tanggal riwayat (Muted Earth)
  ink-faint: "#9e9389"          # Placeholder input & label non-aktif

  # Harmonized Soft Category Accents
  category-food:
    solid: "#d48b6a"
    soft: "#faeae1"
  category-transport:
    solid: "#7097c2"
    soft: "#e8eff7"
  category-shopping:
    solid: "#a688b8"
    soft: "#f3edf7"
  category-bills:
    solid: "#c47171"
    soft: "#fae8e8"
  category-entertainment:
    solid: "#c77d99"
    soft: "#f7eaef"
    soft: "#f7eaef"
  category-others:
    solid: "#8d877e"
    soft: "#eeebe6"

  # Sync Status Indicators (Subtle & Soft)
  status-synced: "#5a9e78"      # Soft Green (Tersinkron)
  status-pending: "#c98a4b"     # Soft Amber (Pending Sync)
  status-syncing: "#7097c2"     # Soft Blue (Sedang Sync)
  status-error: "#c47171"       # Soft Red (Gagal Sync)

typography:
  display-amount:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: "1.1"
    letterSpacing: "-0.5px"
  display-recap:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: "1.2"
  heading-lg:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "1.3"
  heading-md:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "1.4"
  body-lg:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "1.4"
  body-md:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "1.4"
  body-sm:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "1.3"
  button-lg:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "1.2"
  button-sm:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "1.2"
  caption:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.1px"

rounded:
  none: "0px"
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "24px"
  full: "9999px"

spacing:
  xxs: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  section: "32px"

components:
  amount-display-input:
    typography: "{typography.display-amount}"
    height: "60px"
    textAlign: "center"
    textColor: "{colors.ink}"
    placeholderColor: "{colors.ink-faint}"

  category-chip:
    rounded: "{rounded.full}"
    padding: "6px 14px"
    height: "36px"
    typography: "{typography.button-sm}"
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    activeBackgroundColor: "{colors.primary}"
    activeTextColor: "#ffffff"

  button-primary:
    rounded: "{rounded.lg}"
    height: "48px"
    padding: "12px 24px"
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.button-lg}"
    shadow: "0 2px 8px rgba(213, 189, 175, 0.4)"

  button-secondary:
    rounded: "{rounded.lg}"
    height: "42px"
    padding: "10px 16px"
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.button-sm}"

  expense-card:
    rounded: "{rounded.md}"
    padding: "12px 14px"
    backgroundColor: "{colors.surface-card}"
    border: "1px solid {colors.hairline}"
    shadow: "0 1px 3px rgba(45, 40, 37, 0.03)"

  recap-summary-card:
    rounded: "{rounded.lg}"
    padding: "16px 18px"
    backgroundColor: "{colors.surface-card}"
    border: "1px solid {colors.hairline}"

  recap-progress-track:
    rounded: "{rounded.full}"
    height: "6px"
    backgroundColor: "{colors.surface-subtle}"

  sync-badge:
    rounded: "{rounded.full}"
    padding: "3px 10px"
    height: "24px"
    typography: "{typography.caption}"
    border: "1px solid {colors.hairline}"
    backgroundColor: "{colors.surface-card}"

  bottom-nav:
    height: "64px"
    backgroundColor: "rgba(245, 235, 224, 0.95)"
    backdropBlur: "12px"
    borderTop: "1px solid {colors.hairline}"
---

# Cupu Finance Design System: Soft Warm Minimalist

Panduan visual dan standar interaksi antarmuka pengguna untuk aplikasi **Cupu Finance**. Dirancang khusus dengan pendekatan **Soft Warm Minimalist**: hangat, tenang, ramah di mata untuk penggunaan jangka panjang, dan bebas dari ornamen berisik.

---

## 1. Prinsip Desain "Soft Warm Minimalist"

1. **Palet Warna Hangat & Ramah Mata**:
   - Kanvas berlatar `#edede9` memberikan nuansa alami seperti kertas linen hangat, bukan putih dingin yang menyilaukan.
   - Kartu dan kontainer menggunakan `#f5ebe0` berbingkai halus `#d6ccc2`.
   - Aksen utama `#d5bdaf` memberikan identitas yang bersahaja dan tenang.
2. **Keterbacaan yang Tinggi Tanpa Silau**:
   - Teks menggunakan espresso charcoal `#2d2825`, mempertahankan rasio kontras WCAG AAA tanpa harus memakai hitam pekat sintetis.
3. **Ergonomi Satu Tangan (One-Thumb Reachability)**:
   - Tombol input, chips, dan bottom navigation berada dalam jangkauan nyaman ibu jari pengguna di layar HP.
