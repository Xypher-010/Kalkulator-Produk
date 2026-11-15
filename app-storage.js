(function (global) {
  "use strict";

  const DATABASE_NAME = "kalkulatorProduk";
  const DATABASE_VERSION = 1;
  const OBJECT_STORE = "appData";
  const FINANCE_KEY = "finance";
  const HISTORY_KEY = "calculatorHistory";
  const MIGRATION_KEY = "legacyLocalStorageMigratedV1";
  const LEGACY_FINANCE_KEY = "kalkulatorProduk.salesData.v1";
  const LEGACY_HISTORY_KEY = "kalkulatorProduk.history.v1";

  let databasePromise;
  let initializationPromise;

  function openDatabase() {
    if (!global.indexedDB) {
      return Promise.reject(
        new Error("Penyimpanan IndexedDB tidak tersedia di browser ini."),
      );
    }
    if (databasePromise) {
      return databasePromise;
    }

    databasePromise = new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(OBJECT_STORE)) {
          database.createObjectStore(OBJECT_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () =>
        reject(request.error || new Error("Database lokal gagal dibuka."));
      request.onblocked = () =>
        reject(new Error("Database lokal sedang dikunci oleh tab lain."));
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });

    return databasePromise;
  }

  async function readMany(keys) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(OBJECT_STORE, "readonly");
      const store = transaction.objectStore(OBJECT_STORE);
      const values = {};
      keys.forEach((key) => {
        const request = store.get(key);
        request.onsuccess = () => {
          values[key] = request.result ? request.result.value : undefined;
        };
        request.onerror = () =>
          reject(request.error || new Error("Data lokal gagal dibaca."));
      });
      transaction.oncomplete = () => resolve(values);
      transaction.onerror = () =>
        reject(transaction.error || new Error("Data lokal gagal dibaca."));
      transaction.onabort = () =>
        reject(transaction.error || new Error("Pembacaan data lokal dibatalkan."));
    });
  }

  async function writeMany(entries) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(OBJECT_STORE, "readwrite");
      const store = transaction.objectStore(OBJECT_STORE);
      entries.forEach(([key, value]) => {
        store.put({ key, value });
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error || new Error("Data gagal disimpan."));
      transaction.onabort = () =>
        reject(transaction.error || new Error("Penyimpanan data dibatalkan."));
    });
  }

  function isValidDate(value) {
    return (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(`${value}T00:00:00`))
    );
  }

  function isValidSale(record) {
    return (
      record !== null &&
      typeof record === "object" &&
      typeof record.id === "string" &&
      isValidDate(record.date) &&
      typeof record.product === "string" &&
      typeof record.category === "string" &&
      typeof record.note === "string" &&
      Number.isFinite(record.quantity) &&
      record.quantity > 0 &&
      Number.isFinite(record.unitPrice) &&
      record.unitPrice >= 0 &&
      (record.unitCost === undefined ||
        (Number.isFinite(record.unitCost) && record.unitCost >= 0)) &&
      (record.cuttingCost === undefined ||
        (Number.isFinite(record.cuttingCost) && record.cuttingCost >= 0)) &&
      typeof record.createdAt === "string"
    );
  }

  function isValidProduct(product) {
    return (
      product !== null &&
      typeof product === "object" &&
      typeof product.name === "string" &&
      typeof product.category === "string" &&
      Number.isFinite(product.unitPrice) &&
      product.unitPrice >= 0 &&
      (product.unitCost === undefined ||
        (Number.isFinite(product.unitCost) && product.unitCost >= 0))
    );
  }

  function isValidExpense(record) {
    return (
      record !== null &&
      typeof record === "object" &&
      typeof record.id === "string" &&
      isValidDate(record.date) &&
      typeof record.description === "string" &&
      typeof record.category === "string" &&
      typeof record.note === "string" &&
      Number.isFinite(record.amount) &&
      record.amount >= 0 &&
      typeof record.createdAt === "string"
    );
  }

  function normalizeFinanceData(data) {
    if (
      data === null ||
      typeof data !== "object" ||
      !Array.isArray(data.sales) ||
      !Array.isArray(data.products) ||
      !data.sales.every(isValidSale) ||
      new Set(data.sales.map((sale) => sale.id)).size !== data.sales.length ||
      !data.products.every(isValidProduct) ||
      (data.expenses !== undefined &&
        (!Array.isArray(data.expenses) ||
          !data.expenses.every(isValidExpense) ||
          new Set(data.expenses.map((expense) => expense.id)).size !==
            data.expenses.length))
    ) {
      throw new Error("Format data keuangan tidak valid.");
    }

    return {
      sales: data.sales.map((sale) => ({
        ...sale,
        unitCost: sale.unitCost === undefined ? 0 : sale.unitCost,
        cuttingCost: sale.cuttingCost === undefined ? 0 : sale.cuttingCost,
      })),
      products: data.products.map((product) => ({
        ...product,
        unitCost: product.unitCost === undefined ? 0 : product.unitCost,
      })),
      expenses: data.expenses || [],
    };
  }

  function isValidCalculationRecord(record) {
    if (
      record === null ||
      typeof record !== "object" ||
      typeof record.id !== "string" ||
      typeof record.createdAt !== "string" ||
      !Number.isFinite(Date.parse(record.createdAt))
    ) {
      return false;
    }

    if (record.mode === "weight") {
      return [
        "materialWeight",
        "pieceWeight",
        "pieces",
        "usedWeight",
        "leftoverWeight",
        "pricePerKg",
        "sheetValue",
        "usedValue",
      ].every((key) => Number.isFinite(record[key]));
    }

    if (record.mode === "multi") {
      return (
        Array.isArray(record.items) &&
        record.items.length > 0 &&
        record.items.length <= 10 &&
        record.items.every(
          (item) =>
            Number.isFinite(item.length) &&
            item.length > 0 &&
            Number.isFinite(item.width) &&
            item.width > 0 &&
            Number.isSafeInteger(item.count) &&
            item.count >= 0,
        ) &&
        [
          "length",
          "width",
          "pricePerM2",
          "pieces",
          "sheetAreaCm2",
          "usedAreaCm2",
          "leftoverAreaCm2",
          "sheetValue",
          "usedValue",
          "leftoverValue",
          "pieceValue",
        ].every((key) => Number.isFinite(record[key]))
      );
    }

    return (
      record.mode === "single" &&
      [
        "length",
        "width",
        "pieceLength",
        "pieceWidth",
        "pricePerM2",
        "countX",
        "countY",
        "pieces",
        "sheetAreaCm2",
        "usedAreaCm2",
        "leftoverAreaCm2",
        "sheetValue",
        "usedValue",
        "leftoverValue",
        "pieceValue",
      ].every((key) => Number.isFinite(record[key]))
    );
  }

  function normalizeHistoryData(history) {
    if (
      !Array.isArray(history) ||
      !history.every(isValidCalculationRecord) ||
      new Set(history.map((record) => record.id)).size !== history.length
    ) {
      throw new Error("Format riwayat kalkulasi tidak valid.");
    }
    return history;
  }

  function readLegacyValue(key) {
    try {
      return global.localStorage.getItem(key);
    } catch (error) {
      throw new Error(`Data lama tidak dapat dibaca: ${error.message}`);
    }
  }

  async function migrateLegacyData() {
    const existing = await readMany([MIGRATION_KEY]);
    if (existing[MIGRATION_KEY]) {
      return { migrated: false, warning: "" };
    }

    const financeJson = readLegacyValue(LEGACY_FINANCE_KEY);
    const historyJson = readLegacyValue(LEGACY_HISTORY_KEY);
    const entries = [[MIGRATION_KEY, true]];
    let migrated = false;

    if (financeJson !== null) {
      let finance;
      try {
        finance = normalizeFinanceData(JSON.parse(financeJson));
      } catch (error) {
        throw new Error(`Data keuangan lama tidak dapat dipindahkan: ${error.message}`);
      }
      entries.push([FINANCE_KEY, finance]);
      migrated = true;
    }

    if (historyJson !== null) {
      let history;
      try {
        history = normalizeHistoryData(JSON.parse(historyJson));
      } catch (error) {
        throw new Error(`Riwayat kalkulasi lama tidak dapat dipindahkan: ${error.message}`);
      }
      entries.push([HISTORY_KEY, history]);
      migrated = true;
    }

    await writeMany(entries);

    const warnings = [];
    if (financeJson !== null) {
      try {
        global.localStorage.removeItem(LEGACY_FINANCE_KEY);
      } catch (error) {
        warnings.push("salinan data keuangan lama belum dapat dibersihkan");
      }
    }
    if (historyJson !== null) {
      try {
        global.localStorage.removeItem(LEGACY_HISTORY_KEY);
      } catch (error) {
        warnings.push("salinan riwayat lama belum dapat dibersihkan");
      }
    }

    return {
      migrated,
      warning: warnings.length
        ? `Data sudah dipindahkan, tetapi ${warnings.join(" dan ")}.`
        : "",
    };
  }

  function initialize() {
    if (!initializationPromise) {
      initializationPromise = migrateLegacyData().catch((error) => {
        initializationPromise = null;
        throw error;
      });
    }
    return initializationPromise;
  }

  async function readFinance() {
    await initialize();
    const values = await readMany([FINANCE_KEY]);
    return values[FINANCE_KEY]
      ? normalizeFinanceData(values[FINANCE_KEY])
      : { sales: [], products: [], expenses: [] };
  }

  async function writeFinance(data) {
    await initialize();
    await writeMany([[FINANCE_KEY, normalizeFinanceData(data)]]);
  }

  async function readHistory() {
    await initialize();
    const values = await readMany([HISTORY_KEY]);
    return normalizeHistoryData(values[HISTORY_KEY] || []);
  }

  async function writeHistory(history) {
    await initialize();
    await writeMany([[HISTORY_KEY, normalizeHistoryData(history)]]);
  }

  async function readBackupData() {
    await initialize();
    const values = await readMany([FINANCE_KEY, HISTORY_KEY]);
    return {
      finance: values[FINANCE_KEY]
        ? normalizeFinanceData(values[FINANCE_KEY])
        : { sales: [], products: [], expenses: [] },
      calculatorHistory: normalizeHistoryData(values[HISTORY_KEY] || []),
    };
  }

  function validateBackup(backup) {
    if (
      backup === null ||
      typeof backup !== "object" ||
      backup.format !== "kalkulator-produk-backup" ||
      backup.version !== 1 ||
      backup.data === null ||
      typeof backup.data !== "object"
    ) {
      throw new Error("File bukan cadangan Kalkulator Produk yang didukung.");
    }
    return {
      finance: normalizeFinanceData(backup.data.finance),
      calculatorHistory: normalizeHistoryData(backup.data.calculatorHistory),
    };
  }

  function mergeById(existing, incoming) {
    const records = new Map(existing.map((record) => [record.id, record]));
    incoming.forEach((record) => records.set(record.id, record));
    return [...records.values()];
  }

  function mergeFinance(existing, incoming) {
    const products = new Map(
      existing.products.map((product) => [
        product.name.trim().toLocaleLowerCase("id"),
        product,
      ]),
    );
    incoming.products.forEach((product) =>
      products.set(product.name.trim().toLocaleLowerCase("id"), product),
    );
    return {
      sales: mergeById(existing.sales, incoming.sales),
      products: [...products.values()],
      expenses: mergeById(existing.expenses, incoming.expenses),
    };
  }

  async function applyBackup(backup, mode) {
    if (mode !== "merge" && mode !== "replace") {
      throw new Error("Pilih cara pemulihan cadangan.");
    }

    const incoming = validateBackup(backup);
    const current = mode === "merge" ? await readBackupData() : null;
    const finance =
      mode === "merge" ? mergeFinance(current.finance, incoming.finance) : incoming.finance;
    const history =
      mode === "merge"
        ? mergeById(current.calculatorHistory, incoming.calculatorHistory)
        : incoming.calculatorHistory;

    await writeMany([
      [FINANCE_KEY, finance],
      [HISTORY_KEY, history],
    ]);
    return {
      sales: finance.sales.length,
      expenses: finance.expenses.length,
      calculatorHistory: history.length,
    };
  }

  global.AppStorage = Object.freeze({
    applyBackup,
    initialize,
    isValidCalculationRecord,
    readBackupData,
    readFinance,
    readHistory,
    validateBackup,
    writeFinance,
    writeHistory,
  });
})(window);
