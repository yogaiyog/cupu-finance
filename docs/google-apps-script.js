/**
 * =========================================================================
 * GOOGLE APPS SCRIPT - BACKEND UNTUK CUPU FINANCE
 * =========================================================================
 * 
 * PANDUAN SETUP (Hanya 1x, waktu ~2 menit):
 * -----------------------------------------
 * 1. Buka Google Spreadsheet baru di browser (misal beri judul "Cupu Finance Data").
 * 2. Klik menu: Extensions (Ekstensi) > Apps Script.
 * 3. Hapus semua kode default, lalu PASTE SELURUH KODE DI BAWAH INI.
 * 4. Klik tombol "Save" (ikon disket).
 * 5. Klik tombol "Deploy" (di pojok kanan atas) > "New deployment".
 * 6. Klik ikon gerigi (Select type) > pilih "Web app".
 * 7. Konfigurasi Deployment:
 *    - Description: Cupu Finance Sync Webhook
 *    - Execute as: Me (email google Anda)
 *    - Who has access: Anyone (Siapa saja)
 * 8. Klik "Deploy" > Berikan izin (Authorize access) > Login akun Google Anda.
 * 9. Salin "Web app URL" (formatnya: https://script.google.com/macros/s/.../exec).
 * 10. Buka aplikasi Cupu Finance di HP > Tab Pengaturan > Pilih "Custom Webhook",
 *     lalu paste URL tersebut dan klik "Tes Koneksi".
 * =========================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000); // Cegah race condition saat concurrent write
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Expenses");
    
    // Inisialisasi sheet Expenses dan header jika belum ada
    if (!sheet) {
      sheet = ss.insertSheet("Expenses");
      sheet.appendRow(["id", "date", "amount", "category", "note", "updated_at", "is_deleted"]);
      sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f5ebe0");
    }
    
    // Inisialisasi tab Statistik dan Chart jika belum ada
    ensureStatistikSheet(ss);
    
    var requestData = {};
    if (e && e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    }
    
    var clientChanges = requestData.changes || [];
    var lastSyncTimestamp = requestData.lastSyncTimestamp || 0;
    
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var idIndexMap = {};
    
    // Map baris data berdasarkan ID (1-based index)
    for (var r = 1; r < values.length; r++) {
      var rowId = String(values[r][0]);
      if (rowId) {
        idIndexMap[rowId] = r + 1;
      }
    }
    
    // 1. Tulis atau update perubahan dari Client ke Sheet
    clientChanges.forEach(function(item) {
      var rowNum = idIndexMap[item.id];
      var rowData = [
        String(item.id),
        String(item.date),
        Number(item.amount),
        String(item.category),
        String(item.note || ""),
        Number(item.updated_at),
        Boolean(item.is_deleted)
      ];
      
      if (rowNum) {
        var existingUpdatedAt = Number(values[rowNum - 1][5]);
        // Resolusi konflik: Data dengan updated_at paling baru yang menang
        if (Number(item.updated_at) >= existingUpdatedAt) {
          sheet.getRange(rowNum, 1, 1, 7).setValues([rowData]);
        }
      } else {
        // Insert baris baru
        sheet.appendRow(rowData);
        idIndexMap[item.id] = sheet.getLastRow();
      }
    });
    
    SpreadsheetApp.flush();
    
    // 2. Ambil perubahan di sheet yang lebih baru daripada lastSyncTimestamp milik HP
    var updatedValues = sheet.getDataRange().getValues();
    var serverChanges = [];
    var currentServerTime = new Date().getTime();
    
    for (var i = 1; i < updatedValues.length; i++) {
      var row = updatedValues[i];
      var rowUpdatedAt = Number(row[5]);
      if (rowUpdatedAt > lastSyncTimestamp) {
        serverChanges.push({
          id: String(row[0]),
          date: String(row[1]),
          amount: Number(row[2]),
          category: String(row[3]),
          note: String(row[4]),
          updated_at: rowUpdatedAt,
          is_deleted: Boolean(row[6])
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      serverTimestamp: currentServerTime,
      serverChanges: serverChanges
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "Cupu Finance Google Apps Script backend aktif dan siap digunakan."
  })).setMimeType(ContentService.MimeType.JSON);
}

function ensureStatistikSheet(ss) {
  try {
    var statSheet = ss.getSheetByName("Statistik");
    if (!statSheet) {
      statSheet = ss.insertSheet("Statistik", 0);
      
      // Judul Banner
      statSheet.getRange("A1:C1").setValues([["📊 RINGKASAN & STATISTIK KEUANGAN", "", ""]])
        .setFontWeight("bold").setFontSize(13);
      
      // KPI Header
      statSheet.getRange("A3:B3").setValues([["Indikator", "Nilai"]])
        .setFontWeight("bold").setBackground("#e8e4df");
      
      // KPI Baris
      var kpiRows = [
        ["Total Pengeluaran", '=SUMIFS(Expenses!C2:C, Expenses!G2:G, "<>TRUE")'],
        ["Pengeluaran Bulan Ini", '=SUMIFS(Expenses!C2:C, Expenses!B2:B, ">=" & TEXT(TODAY(), "yyyy-mm-01"), Expenses!B2:B, "<=" & TEXT(EOMONTH(TODAY(), 0), "yyyy-mm-dd"), Expenses!G2:G, "<>TRUE")'],
        ["Rata-rata Harian", '=IFERROR(B4 / MAX(1, COUNTUNIQUEIFS(Expenses!B2:B, Expenses!C2:C, ">0", Expenses!G2:G, "<>TRUE")), 0)'],
        ["Jumlah Transaksi", '=COUNTIFS(Expenses!C2:C, ">0", Expenses!G2:G, "<>TRUE")'],
        ["Kategori Paling Boros", '=IF(MAX(B11:B16)>0, INDEX(A11:A16, MATCH(MAX(B11:B16), B11:B16, 0)), "-")']
      ];
      statSheet.getRange("A4:B8").setValues(kpiRows);
      statSheet.getRange("B4:B6").setNumberFormat('"Rp "#,##0');
      statSheet.getRange("B7").setNumberFormat('#,##0');
      
      // Tabel Kategori Header
      statSheet.getRange("A10:C10").setValues([["Kategori", "Total Pengeluaran", "Porsi (%)"]])
        .setFontWeight("bold").setBackground("#e8e4df");
      
      var categories = ["Makanan", "Transportasi", "Belanja", "Tagihan", "Hiburan", "Lainnya"];
      var catRows = [];
      for (var i = 0; i < categories.length; i++) {
        var r = 11 + i;
        catRows.push([
          categories[i],
          '=SUMIFS(Expenses!$C$2:$C, Expenses!$D$2:$D, A' + r + ', Expenses!$G$2:$G, "<>TRUE")',
          '=IFERROR(B' + r + ' / $B$4, 0)'
        ]);
      }
      statSheet.getRange("A11:C16").setValues(catRows);
      statSheet.getRange("B11:B16").setNumberFormat('"Rp "#,##0');
      statSheet.getRange("C11:C16").setNumberFormat('0.0%');
      
      statSheet.setColumnWidth(1, 210);
      statSheet.setColumnWidth(2, 170);
      statSheet.setColumnWidth(3, 100);
      statSheet.setColumnWidth(4, 30);
      
      // Visual Donut Chart
      var chart = statSheet.newChart()
        .asPieChart()
        .setTitle("Proporsi Pengeluaran per Kategori")
        .addRange(statSheet.getRange("A11:A16"))
        .addRange(statSheet.getRange("B11:B16"))
        .setPosition(3, 5, 10, 0)
        .setOption("pieHole", 0.4)
        .setOption("width", 520)
        .setOption("height", 340)
        .build();
      statSheet.insertChart(chart);
    }
  } catch (err) {
    // Abaikan agar tidak memblokir sinkronisasi utama
  }
}
