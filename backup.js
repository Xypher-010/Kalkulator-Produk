(function () {
  "use strict";

  const status = document.getElementById("backupStatus");
  const fileInput = document.getElementById("backupFile");
  const preview = document.getElementById("backupPreview");
  const restoreButton = document.getElementById("restoreBackupButton");
  const restoreMode = document.getElementById("restoreMode");
  let selectedBackup = null;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function downloadFile(contents, mimeType, filename) {
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function filenameDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function exportCsv(data) {
    const columns = [
      "jenis",
      "id",
      "tanggal",
      "nama",
      "kategori",
      "jumlah",
      "harga_unit",
      "hpp_unit",
      "biaya_potong",
      "jumlah_rupiah",
      "catatan",
      "mode_kalkulasi",
      "jumlah_potongan",
      "nilai_bahan_terpakai",
    ];
    const escapeCell = (value) => {
      let text = value === null || value === undefined ? "" : String(value);
      if (typeof value === "string" && /^\s*[=+\-@]/.test(value)) {
        text = `'${text}`;
      }
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = [columns.map(escapeCell)];

    data.finance.sales.forEach((sale) => {
      rows.push(
        [
          "penjualan",
          sale.id,
          sale.date,
          sale.product,
          sale.category,
          sale.quantity,
          sale.unitPrice,
          sale.unitCost,
          sale.cuttingCost,
          sale.quantity * sale.unitPrice,
          sale.note,
          "",
          "",
          "",
        ].map(escapeCell),
      );
    });
    data.finance.expenses.forEach((expense) => {
      rows.push(
        [
          "pengeluaran",
          expense.id,
          expense.date,
          expense.description,
          expense.category,
          "",
          "",
          "",
          "",
          expense.amount,
          expense.note,
          "",
          "",
          "",
        ].map(escapeCell),
      );
    });
    data.finance.products.forEach((product) => {
      rows.push(
        [
          "produk",
          "",
          "",
          product.name,
          product.category,
          "",
          product.unitPrice,
          product.unitCost,
          "",
          "",
          "",
          "",
          "",
          "",
        ].map(escapeCell),
      );
    });
    data.calculatorHistory.forEach((record) => {
      rows.push(
        [
          "kalkulasi",
          record.id,
          record.createdAt,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          record.mode,
          record.pieces,
          record.usedValue,
        ].map(escapeCell),
      );
    });

    return `\uFEFF${rows.map((row) => row.join(",")).join("\r\n")}`;
  }

  document
    .getElementById("downloadBackupButton")
    .addEventListener("click", async () => {
      try {
        const data = await AppStorage.readBackupData();
        const backup = {
          format: "kalkulator-produk-backup",
          version: 1,
          exportedAt: new Date().toISOString(),
          data,
        };
        downloadFile(
          JSON.stringify(backup, null, 2),
          "application/json;charset=utf-8",
          `kalkulator-produk-${filenameDate()}.json`,
        );
        setStatus("Cadangan JSON berhasil diunduh.");
      } catch (error) {
        setStatus(`Cadangan gagal dibuat: ${error.message}`, true);
      }
    });

  document.getElementById("downloadCsvButton").addEventListener("click", async () => {
    try {
      const data = await AppStorage.readBackupData();
      downloadFile(
        exportCsv(data),
        "text/csv;charset=utf-8",
        `kalkulator-produk-${filenameDate()}.csv`,
      );
      setStatus("Ekspor CSV berhasil diunduh.");
    } catch (error) {
      setStatus(`Ekspor CSV gagal: ${error.message}`, true);
    }
  });

  fileInput.addEventListener("change", async () => {
    selectedBackup = null;
    restoreButton.disabled = true;
    preview.hidden = true;
    const file = fileInput.files[0];
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text());
      const validated = AppStorage.validateBackup(parsed);
      selectedBackup = parsed;
      document.getElementById("backupPreviewSummary").textContent =
        `${validated.finance.sales.length} penjualan, ` +
        `${validated.finance.expenses.length} pengeluaran, dan ` +
        `${validated.calculatorHistory.length} kalkulasi.`;
      preview.hidden = false;
      restoreButton.disabled = false;
      setStatus("Cadangan valid. Pilih cara pemulihan lalu konfirmasi.");
    } catch (error) {
      setStatus(`Cadangan tidak dapat dibaca: ${error.message}`, true);
    }
  });

  restoreButton.addEventListener("click", async () => {
    if (!selectedBackup) {
      setStatus("Pilih dan validasi file cadangan terlebih dahulu.", true);
      return;
    }

    const mode = restoreMode.value;
    const confirmation =
      mode === "replace"
        ? "Pemulihan akan mengganti seluruh data saat ini, termasuk riwayat kalkulasi. Lanjutkan?"
        : "Data dari cadangan akan digabungkan dengan data saat ini. Jika ID sama, data dari cadangan akan dipakai. Lanjutkan?";
    if (!window.confirm(confirmation)) {
      return;
    }

    restoreButton.disabled = true;
    try {
      const result = await AppStorage.applyBackup(selectedBackup, mode);
      setStatus(
        `Pemulihan selesai: ${result.sales} penjualan, ${result.expenses} pengeluaran, ` +
          `${result.calculatorHistory} kalkulasi. Memuat ulang data...`,
      );
      window.location.reload();
    } catch (error) {
      restoreButton.disabled = false;
      setStatus(`Pemulihan gagal: ${error.message}`, true);
    }
  });
})();
