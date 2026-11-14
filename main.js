const HISTORY_KEY = "kalkulatorProduk.history.v1";
const numberFormat = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});
const areaFormat = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 4,
});
const currencyFormat = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const form = document.getElementById("calculatorForm");
const resultsSection = document.getElementById("resultsSection");
const statusMessage = document.getElementById("statusMessage");
const historyList = document.getElementById("historyList");
const emptyHistory = document.getElementById("emptyHistory");
const historyCount = document.getElementById("historyCount");
const menuToggle = document.getElementById("menuToggle");
const pageMenu = document.getElementById("pageMenu");

let historyRecords = [];
let historyAvailable = true;
let diagramNumber = 0;

function setMenuOpen(isOpen) {
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute(
    "aria-label",
    isOpen ? "Tutup menu navigasi" : "Buka menu navigasi",
  );
  pageMenu.hidden = !isOpen;
}

menuToggle.addEventListener("click", () => {
  setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});

pageMenu.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    setMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !pageMenu.hidden) {
    setMenuOpen(false);
    menuToggle.focus();
  }
});

document.addEventListener("click", (event) => {
  if (!pageMenu.hidden && !event.target.closest(".page-menu")) {
    setMenuOpen(false);
  }
});

function formatNumber(value) {
  return numberFormat.format(value);
}

function formatArea(value) {
  return `${areaFormat.format(value)} cm²`;
}

function formatSquareMeters(valueInCm2) {
  return `${areaFormat.format(valueInCm2 / 10000)} m²`;
}

function formatCurrency(value) {
  return currencyFormat.format(value);
}

function setStatus(message, isError) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", Boolean(isError));
}

function readHistory() {
  const saved = window.localStorage.getItem(HISTORY_KEY);
  if (saved === null) {
    return [];
  }

  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) {
    throw new Error("Data riwayat tidak memiliki format yang benar.");
  }
  return parsed;
}

function isValidRecord(record) {
  return (
    record !== null &&
    typeof record === "object" &&
    typeof record.id === "string" &&
    typeof record.createdAt === "string" &&
    Number.isFinite(Date.parse(record.createdAt)) &&
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

function setSvgAttributes(element, attributes) {
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, String(value));
  });
  return element;
}

function addSvgElement(svg, name, attributes, text) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  setSvgAttributes(element, attributes);
  if (text !== undefined) {
    element.textContent = text;
  }
  svg.appendChild(element);
  return element;
}

function createDiagram(container, calculation, showCuts) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const { length, width, pieceLength, pieceWidth, countX, countY, usedLength, usedWidth } =
    calculation;
  const scale = Math.min(330 / length, 158 / width);
  const drawnWidth = length * scale;
  const drawnHeight = width * scale;
  const x = (480 - drawnWidth) / 2;
  const y = 24 + (168 - drawnHeight) / 2;
  const usedDrawnWidth = usedLength * scale;
  const usedDrawnHeight = usedWidth * scale;

  diagramNumber += 1;
  setSvgAttributes(svg, {
    viewBox: "0 0 480 235",
    role: "img",
    "aria-label": showCuts
      ? `Bahan ${formatNumber(length)} kali ${formatNumber(width)} sentimeter setelah dipotong menjadi ${formatNumber(calculation.pieces)} potongan.`
      : `Bahan utuh berukuran ${formatNumber(length)} kali ${formatNumber(width)} sentimeter.`,
  });

  addSvgElement(svg, "rect", {
    x,
    y,
    width: drawnWidth,
    height: drawnHeight,
    rx: 2,
    fill: showCuts ? "#202635" : "#273144",
    stroke: "#8993a6",
    "stroke-width": 1.5,
  });

  if (showCuts) {
    if (calculation.usedAreaCm2 === 0) {
      addSvgElement(svg, "rect", {
        x,
        y,
        width: drawnWidth,
        height: drawnHeight,
        fill: "#f7b867",
        opacity: 0.9,
      });
    } else {
      addSvgElement(svg, "rect", {
        x,
        y,
        width: usedDrawnWidth,
        height: usedDrawnHeight,
        fill: "#73d6a1",
        opacity: 0.9,
      });

      if (countX <= 60 && countY <= 60 && calculation.pieces <= 500) {
        for (let column = 1; column < countX; column += 1) {
          addSvgElement(svg, "line", {
            x1: x + column * pieceLength * scale,
            y1: y,
            x2: x + column * pieceLength * scale,
            y2: y + usedDrawnHeight,
            stroke: "#163b31",
            "stroke-width": 1,
          });
        }
        for (let row = 1; row < countY; row += 1) {
          addSvgElement(svg, "line", {
            x1: x,
            y1: y + row * pieceWidth * scale,
            x2: x + usedDrawnWidth,
            y2: y + row * pieceWidth * scale,
            stroke: "#163b31",
            "stroke-width": 1,
          });
        }
      }

      const remainderLength = length - usedLength;
      const remainderWidth = width - usedWidth;
      if (remainderLength > 0) {
        addSvgElement(svg, "rect", {
          x: x + usedDrawnWidth,
          y,
          width: remainderLength * scale,
          height: drawnHeight,
          fill: "#f7b867",
          opacity: 0.94,
        });
      }
      if (remainderWidth > 0 && usedLength > 0) {
        addSvgElement(svg, "rect", {
          x,
          y: y + usedDrawnHeight,
          width: usedDrawnWidth,
          height: remainderWidth * scale,
          fill: "#f7b867",
          opacity: 0.94,
        });
      }
    }

    addSvgElement(
      svg,
      "text",
      {
        x: 240,
        y: 218,
        "text-anchor": "middle",
        fill: "#c5ccda",
        "font-size": 12,
      },
      calculation.pieces > 0
        ? `${formatNumber(countX)} × ${formatNumber(countY)} potong`
        : "Tidak ada potongan utuh",
    );
  }

  if (showCuts) {
    addSvgElement(svg, "rect", {
      x,
      y,
      width: drawnWidth,
      height: drawnHeight,
      rx: 2,
      fill: "none",
      stroke: "#8993a6",
      "stroke-width": 1.5,
    });
  }

  addSvgElement(
    svg,
    "text",
    {
      x: 240,
      y: 13,
      "text-anchor": "middle",
      fill: "#c5ccda",
      "font-size": 12,
    },
    `Panjang ${formatNumber(length)} cm`,
  );
  addSvgElement(
    svg,
    "text",
    {
      x: 13,
      y: 117,
      transform: "rotate(-90 13 117)",
      "text-anchor": "middle",
      fill: "#c5ccda",
      "font-size": 12,
    },
    `Lebar ${formatNumber(width)} cm`,
  );
  container.replaceChildren(svg);
}

function renderResults(calculation) {
  const saveBadge = document.getElementById("saveBadge");
  saveBadge.textContent = "Menyimpan…";
  saveBadge.classList.remove("is-error");
  document.getElementById("pieceCount").textContent = formatNumber(calculation.pieces);
  document.getElementById("sheetArea").textContent = formatArea(calculation.sheetAreaCm2);
  document.getElementById("sheetAreaDetail").textContent = formatSquareMeters(
    calculation.sheetAreaCm2,
  );
  document.getElementById("usedArea").textContent = formatArea(calculation.usedAreaCm2);
  document.getElementById("usedAreaDetail").textContent = formatSquareMeters(
    calculation.usedAreaCm2,
  );
  document.getElementById("leftoverArea").textContent = formatArea(
    calculation.leftoverAreaCm2,
  );
  document.getElementById("leftoverAreaDetail").textContent = formatSquareMeters(
    calculation.leftoverAreaCm2,
  );

  document.getElementById("sheetValue").textContent = formatCurrency(calculation.sheetValue);
  document.getElementById("usedValue").textContent = formatCurrency(calculation.usedValue);
  document.getElementById("leftoverValue").textContent = formatCurrency(
    calculation.leftoverValue,
  );
  document.getElementById("pieceValue").textContent = formatCurrency(calculation.pieceValue);
  document.getElementById("priceBasis").textContent =
    `${formatCurrency(calculation.pricePerM2)} per m²`;

  document.getElementById("beforeDimensions").textContent =
    `${formatNumber(calculation.length)} × ${formatNumber(calculation.width)} cm`;
  document.getElementById("afterDimensions").textContent =
    `${formatNumber(calculation.countX)} potongan sepanjang bahan × ${formatNumber(calculation.countY)} potongan sepanjang lebar`;
  createDiagram(document.getElementById("beforeDiagram"), calculation, false);
  createDiagram(document.getElementById("afterDiagram"), calculation, true);
  resultsSection.hidden = false;
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function renderHistory() {
  historyList.replaceChildren();
  historyCount.textContent = `${formatNumber(historyRecords.length)} kalkulasi`;
  emptyHistory.hidden = historyRecords.length !== 0;

  historyRecords.forEach((record) => {
    const entry = createElement("article", "history-entry");
    const main = createElement("div", "history-entry-main");
    const title = createElement(
      "p",
      "history-entry-title",
      `${formatNumber(record.length)} × ${formatNumber(record.width)} cm → ${formatNumber(record.pieces)} potongan`,
    );
    const detail = createElement(
      "p",
      "history-entry-detail",
      `Potongan ${formatNumber(record.pieceLength)} × ${formatNumber(record.pieceWidth)} cm · Sisa ${formatArea(record.leftoverAreaCm2)}`,
    );
    const date = createElement(
      "p",
      "history-entry-date",
      new Date(record.createdAt).toLocaleString("id-ID"),
    );
    const side = createElement("div", "history-entry-side");
    const value = createElement(
      "strong",
      "history-entry-value",
      formatCurrency(record.usedValue),
    );
    const removeButton = createElement("button", "delete-entry", "Hapus");
    removeButton.type = "button";
    removeButton.dataset.deleteId = record.id;
    removeButton.setAttribute("aria-label", "Hapus kalkulasi ini dari riwayat");

    main.append(title, detail, date);
    side.append(value, removeButton);
    entry.append(main, side);
    historyList.appendChild(entry);
  });
}

function calculate(values) {
  const {
    length,
    width,
    pieceLength,
    pieceWidth,
    pricePerM2,
  } = values;
  const numbers = [length, width, pieceLength, pieceWidth, pricePerM2];
  if (!numbers.every(Number.isFinite) || numbers.some((value) => value < 0)) {
    throw new Error("Masukkan ukuran dan harga yang valid.");
  }
  if (length === 0 || width === 0 || pieceLength === 0 || pieceWidth === 0) {
    throw new Error("Ukuran bahan dan potongan harus lebih besar dari 0.");
  }

  const countX = Math.floor(
    length / pieceLength + Number.EPSILON * Math.max(length / pieceLength, 1) * 4,
  );
  const countY = Math.floor(
    width / pieceWidth + Number.EPSILON * Math.max(width / pieceWidth, 1) * 4,
  );
  const pieces = countX * countY;
  const usedLength = countX * pieceLength;
  const usedWidth = countY * pieceWidth;
  const sheetAreaCm2 = length * width;
  const usedAreaCm2 = pieces * pieceLength * pieceWidth;
  const leftoverAreaCm2 = Math.max(0, sheetAreaCm2 - usedAreaCm2);
  const sheetValue = (sheetAreaCm2 / 10000) * pricePerM2;
  const usedValue = (usedAreaCm2 / 10000) * pricePerM2;
  const leftoverValue = (leftoverAreaCm2 / 10000) * pricePerM2;
  const pieceValue = (pieceLength * pieceWidth * pricePerM2) / 10000;
  const results = [
    countX,
    countY,
    pieces,
    usedLength,
    usedWidth,
    sheetAreaCm2,
    usedAreaCm2,
    leftoverAreaCm2,
    sheetValue,
    usedValue,
    leftoverValue,
    pieceValue,
  ];

  if (
    !results.every(Number.isFinite) ||
    !Number.isSafeInteger(countX) ||
    !Number.isSafeInteger(countY) ||
    !Number.isSafeInteger(pieces)
  ) {
    throw new Error("Angka terlalu besar untuk dihitung dengan akurat.");
  }

  return {
    ...values,
    countX,
    countY,
    pieces,
    usedLength,
    usedWidth,
    sheetAreaCm2,
    usedAreaCm2,
    leftoverAreaCm2,
    sheetValue,
    usedValue,
    leftoverValue,
    pieceValue,
  };
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  setStatus("", false);

  let calculation;
  try {
    calculation = calculate({
      length: Number(document.getElementById("panjangBahan").value),
      width: Number(document.getElementById("lebarBahan").value),
      pieceLength: Number(document.getElementById("panjangPotong").value),
      pieceWidth: Number(document.getElementById("lebarPotong").value),
      pricePerM2: Number(document.getElementById("hargaPerMeter").value),
    });
  } catch (error) {
    setStatus(error.message, true);
    return;
  }
  renderResults(calculation);

  if (!historyAvailable) {
    const saveBadge = document.getElementById("saveBadge");
    saveBadge.textContent = "Riwayat tidak tersedia";
    saveBadge.classList.add("is-error");
    setStatus(
      "Hasil dihitung, tetapi riwayat tidak dapat diakses di browser ini.",
      true,
    );
    return;
  }

  const record = {
    ...calculation,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  const nextHistory = [record, ...historyRecords];
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    historyRecords = nextHistory;
    renderHistory();
    document.getElementById("saveBadge").textContent = "Tersimpan otomatis";
    setStatus("Kalkulasi berhasil dihitung dan disimpan di browser ini.", false);
  } catch (error) {
    const saveBadge = document.getElementById("saveBadge");
    saveBadge.textContent = "Gagal menyimpan";
    saveBadge.classList.add("is-error");
    setStatus(
      `Hasil sudah dihitung, tetapi riwayat gagal disimpan: ${error.message}`,
      true,
    );
  }
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button || !historyAvailable) {
    return;
  }

  const nextHistory = historyRecords.filter(
    (record) => record.id !== button.dataset.deleteId,
  );
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    historyRecords = nextHistory;
    renderHistory();
    setStatus("Kalkulasi dihapus dari riwayat.", false);
  } catch (error) {
    setStatus(`Riwayat gagal diperbarui: ${error.message}`, true);
  }
});

try {
  const savedHistory = readHistory();
  if (!savedHistory.every(isValidRecord)) {
    throw new Error("Sebagian data riwayat tidak valid dan tidak ditampilkan.");
  }
  historyRecords = savedHistory;
} catch (error) {
  historyAvailable = false;
  setStatus(`Riwayat tidak dapat dibaca: ${error.message}`, true);
}

renderHistory();
