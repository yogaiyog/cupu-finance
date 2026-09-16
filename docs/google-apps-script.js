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
    }
    
    // Style header Expenses dan freeze baris 1
    sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#e8e4df");
    sheet.setFrozenRows(1);
    
    // Dropdown Kategori di kolom D
    var catList = ["Makanan", "Transportasi", "Belanja", "Tagihan", "Hiburan", "Lainnya"];
    var catRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(catList, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange("D2:D2000").setDataValidation(catRule);
    sheet.getRange("C2:C2000").setNumberFormat('"Rp "#,##0');
    
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
          amount: parseAmount(row[2]),
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
      statSheet.getRange("A1:D1").setValues([["📊 RINGKASAN & STATISTIK KEUANGAN", "", "", ""]])
        .setFontWeight("bold").setFontSize(13);
      
      // Rentang Tanggal di bagian atas
      var now = new Date();
      var curYear = now.getFullYear();
      var curMonth = ("0" + (now.getMonth() + 1)).slice(-2);
      var curDay = ("0" + now.getDate()).slice(-2);
      var startOfMonth = curYear + "-" + curMonth + "-01";
      var todayStr = curYear + "-" + curMonth + "-" + curDay;

      statSheet.getRange("A2:D2").setValues([[
        "📅 Periode Mulai:",
        startOfMonth,
        "📅 Periode Selesai:",
        todayStr
      ]]);
      statSheet.getRange("A2").setFontWeight("bold").setBackground("#e8e4df");
      statSheet.getRange("B2").setNumberFormat("yyyy-mm-dd").setHorizontalAlignment("center").setBackground("#ffffff").setFontWeight("bold");
      statSheet.getRange("C2").setFontWeight("bold").setBackground("#e8e4df");
      statSheet.getRange("D2").setNumberFormat("yyyy-mm-dd").setHorizontalAlignment("center").setBackground("#ffffff").setFontWeight("bold");

      // Validasi Tanggal (Pop-up Kalender otomatis saat klik 2x)
      var dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build();
      statSheet.getRange("B2").setDataValidation(dateRule);
      statSheet.getRange("D2").setDataValidation(dateRule);
      
      // KPI Header (Baris 4)
      statSheet.getRange("A4:B4").setValues([["Indikator", "Nilai (Sesuai Periode)"]])
        .setFontWeight("bold").setBackground("#e8e4df");
      
      // KPI Baris
      var kpiRows = [
        ["Total Pengeluaran", '=SUMIFS(Expenses!C2:C, Expenses!B2:B, ">=" & IF(ISBLANK($B$2), "1970-01-01", TEXT($B$2, "yyyy-mm-dd")), Expenses!B2:B, "<=" & IF(ISBLANK($D$2), "2099-12-31", TEXT($D$2, "yyyy-mm-dd")), Expenses!G2:G, "<>TRUE")'],
        ["Pengeluaran Bulan Berjalan", '=SUMIFS(Expenses!C2:C, Expenses!B2:B, ">=" & TEXT(TODAY(), "yyyy-mm-01"), Expenses!B2:B, "<=" & TEXT(EOMONTH(TODAY(), 0), "yyyy-mm-dd"), Expenses!G2:G, "<>TRUE")'],
        ["Rata-rata Harian", '=IFERROR(B5 / MAX(1, COUNTUNIQUEIFS(Expenses!B2:B, Expenses!B2:B, ">=" & IF(ISBLANK($B$2), "1970-01-01", TEXT($B$2, "yyyy-mm-dd")), Expenses!B2:B, "<=" & IF(ISBLANK($D$2), "2099-12-31", TEXT($D$2, "yyyy-mm-dd")), Expenses!C2:C, ">0", Expenses!G2:G, "<>TRUE")), 0)'],
        ["Jumlah Transaksi", '=COUNTIFS(Expenses!B2:B, ">=" & IF(ISBLANK($B$2), "1970-01-01", TEXT($B$2, "yyyy-mm-dd")), Expenses!B2:B, "<=" & IF(ISBLANK($D$2), "2099-12-31", TEXT($D$2, "yyyy-mm-dd")), Expenses!C2:C, ">0", Expenses!G2:G, "<>TRUE")'],
        ["Kategori Paling Boros", '=IF(MAX(B12:B17)>0, INDEX(A12:A17, MATCH(MAX(B12:B17), B12:B17, 0)), "-")']
      ];
      statSheet.getRange("A5:B9").setValues(kpiRows);
      statSheet.getRange("B5:B7").setNumberFormat('"Rp "#,##0');
      statSheet.getRange("B8").setNumberFormat('#,##0');
      
      // Tabel Kategori Header (Baris 11)
      statSheet.getRange("A11:C11").setValues([["Kategori", "Total Pengeluaran", "Porsi (%)"]])
        .setFontWeight("bold").setBackground("#e8e4df");
      
      var categories = ["Makanan", "Transportasi", "Belanja", "Tagihan", "Hiburan", "Lainnya"];
      var catRows = [];
      for (var i = 0; i < categories.length; i++) {
        var r = 12 + i;
        catRows.push([
          categories[i],
          '=SUMIFS(Expenses!$C$2:$C, Expenses!$D$2:$D, A' + r + ', Expenses!$B$2:$B, ">=" & IF(ISBLANK($B$2), "1970-01-01", TEXT($B$2, "yyyy-mm-dd")), Expenses!$B$2:$B, "<=" & IF(ISBLANK($D$2), "2099-12-31", TEXT($D$2, "yyyy-mm-dd")), Expenses!$G$2:$G, "<>TRUE")',
          '=IFERROR(B' + r + ' / $B$5, 0)'
        ]);
      }
      statSheet.getRange("A12:C17").setValues(catRows);
      statSheet.getRange("B12:B17").setNumberFormat('"Rp "#,##0');
      statSheet.getRange("C12:C17").setNumberFormat('0.0%');
      
      statSheet.setColumnWidth(1, 210);
      statSheet.setColumnWidth(2, 170);
      statSheet.setColumnWidth(3, 130);
      statSheet.setColumnWidth(4, 140);
      
      // Visual Donut Chart
      var chart = statSheet.newChart()
        .asPieChart()
        .setTitle("Proporsi Pengeluaran per Kategori")
        .addRange(statSheet.getRange("A12:A17"))
        .addRange(statSheet.getRange("B12:B17"))
        .setPosition(4, 5, 15, 0)
        .setOption("pieHole", 0.4)
        .setOption("width", 520)
        .setOption("height", 350)
        .build();
      statSheet.insertChart(chart);
    } else {
      // Pastikan B2 dan D2 selalu berformat Number Date & memiliki validasi kalender
      statSheet.getRange("B2").setNumberFormat("yyyy-mm-dd").setHorizontalAlignment("center");
      statSheet.getRange("D2").setNumberFormat("yyyy-mm-dd").setHorizontalAlignment("center");
      var dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build();
      statSheet.getRange("B2").setDataValidation(dateRule);
      statSheet.getRange("D2").setDataValidation(dateRule);
    }
  } catch (err) {
    // Abaikan agar tidak memblokir sinkronisasi utama
  }
}

function parseAmount(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val);
  }

  var str = String(val).trim();
  if (!str) return 0;

  str = str.replace(/^(rp\.?|idr|\$)\s*/i, '').trim();

  var jtMatch = str.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(?:jt|juta|m)$/i);
  if (jtMatch) {
    var numJt = parseFloat(jtMatch[1].replace(',', '.'));
    return isNaN(numJt) ? 0 : Math.round(numJt * 1000000);
  }

  var rbMatch = str.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(?:rb|ribu|k)$/i);
  if (rbMatch) {
    var numRb = parseFloat(rbMatch[1].replace(',', '.'));
    return isNaN(numRb) ? 0 : Math.round(numRb * 1000);
  }

  if (str.indexOf('.') !== -1 && str.indexOf(',') !== -1) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.indexOf('.') !== -1) {
    var partsDot = str.split('.');
    if (partsDot.length > 2 || (partsDot.length === 2 && partsDot[1].length === 3)) {
      str = str.replace(/\./g, '');
    }
  } else if (str.indexOf(',') !== -1) {
    var partsComma = str.split(',');
    if (partsComma.length > 2 || (partsComma.length === 2 && partsComma[1].length === 3)) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }

  var cleaned = str.replace(/[^0-9.]/g, '');
  var parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

