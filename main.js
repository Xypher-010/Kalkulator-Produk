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
const weightFormat = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 3,
});

const form = document.getElementById("calculatorForm");
const resultsSection = document.getElementById("resultsSection");
const statusMessage = document.getElementById("statusMessage");
const historyList = document.getElementById("historyList");
const emptyHistory = document.getElementById("emptyHistory");
const historyCount = document.getElementById("historyCount");
const menuToggle = document.getElementById("menuToggle");
const pageMenu = document.getElementById("pageMenu");
const sizeRows = document.getElementById("sizeRows");
const addSizeButton = document.getElementById("addSizeButton");
const modeInputs = [...document.querySelectorAll('input[name="calculationMode"]')];

let historyRecords = [];
let historyAvailable = true;
const MAX_SIZE_TYPES = 10;
const MAX_MIXED_PIECES = 1000;

function getMode() {
  return modeInputs.find((input) => input.checked).value;
}

function createSizeField(labelText, placeholder) {
  const field = createElement("label", "field");
  const wrapper = createElement("span", "input-wrap");
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "any";
  input.placeholder = placeholder;
  input.required = getMode() === "multi";
  wrapper.append(input, createElement("span", "", "cm"));
  field.append(createElement("span", "", labelText), wrapper);
  return { field, input };
}

function addSizeRow(length = "", width = "") {
  const row = createElement("div", "size-row");
  const lengthField = createSizeField("Panjang potongan", "Contoh: 25");
  const widthField = createSizeField("Lebar potongan", "Contoh: 15");
  const removeButton = createElement("button", "remove-size", "−");
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", "Hapus ukuran potongan");
  removeButton.addEventListener("click", () => {
    row.remove();
    addSizeButton.disabled = sizeRows.children.length >= MAX_SIZE_TYPES;
  });
  lengthField.input.value = length;
  widthField.input.value = width;
  row.append(lengthField.field, widthField.field, removeButton);
  sizeRows.appendChild(row);
  addSizeButton.disabled = sizeRows.children.length >= MAX_SIZE_TYPES;
}

function setMode(mode) {
  const isWeight = mode === "weight";
  const isMulti = mode === "multi";
  resultsSection.hidden = true;
  modeInputs.forEach((input) => {
    input.closest("label").classList.toggle("is-selected", input.checked);
  });
  document.getElementById("input-title").textContent = isWeight
    ? "Berat & harga"
    : "Ukuran & harga";
  document
    .querySelectorAll(".dimensions-field, .size-price-field")
    .forEach((field) => { field.hidden = isWeight; });
  document.querySelectorAll(".single-size-field").forEach((field) => {
    field.hidden = isWeight || isMulti;
  });
  document.getElementById("multiSizeFields").hidden = !isMulti;
  document.querySelector(".weight-fields").hidden = !isWeight;
  document.getElementById("unitNote").textContent = isWeight
    ? "Berat dalam kg"
    : "Semua ukuran dalam cm";
  document
    .querySelectorAll(".dimensions-field input")
    .forEach((input) => {
      input.required = !isWeight;
    });
  document
    .querySelectorAll(".single-size-field input, .size-price-field input")
    .forEach((input) => {
      input.required = !isWeight && !isMulti;
    });
  document.querySelectorAll(".weight-fields input").forEach((input) => {
    input.required = isWeight;
  });
  sizeRows.querySelectorAll("input").forEach((input) => {
    input.required = isMulti;
  });
  if (isMulti && sizeRows.children.length === 0) {
    addSizeRow();
    addSizeRow();
  }
}

modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    setMode(input.value);
    setStatus("", false);
  });
});
addSizeButton.addEventListener("click", () => {
  if (sizeRows.children.length < MAX_SIZE_TYPES) {
    addSizeRow();
  }
});

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
    fill: showCuts
      ? calculation.layout
        ? "#f7b867"
        : "#202635"
      : "#273144",
    stroke: "#8993a6",
    "stroke-width": 1.5,
  });

  if (showCuts) {
    if (calculation.layout) {
      calculation.layout.slice(0, MAX_MIXED_PIECES).forEach((piece) => {
        addSvgElement(svg, "rect", {
          x: x + piece.x * scale,
          y: y + piece.y * scale,
          width: piece.length * scale,
          height: piece.width * scale,
          fill: "#73d6a1",
          stroke: "#163b31",
          "stroke-width": 0.7,
        });
      });
    } else if (calculation.usedAreaCm2 === 0) {
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
        ? calculation.layout
          ? `${formatNumber(calculation.pieces)} potongan campuran`
          : `${formatNumber(countX)} × ${formatNumber(countY)} potong`
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
  const isWeight = calculation.mode === "weight";
  const isMulti = calculation.mode === "multi";
  document.querySelector(".metric-grid").hidden = isWeight;
  document.querySelector(".value-panel").hidden = isWeight;
  document.querySelector(".visual-panel").hidden = isWeight;
  document.getElementById("weightResults").hidden = !isWeight;
  document.getElementById("multiSummary").hidden = !isMulti;
  saveBadge.textContent = "Menyimpan…";
  saveBadge.classList.remove("is-error");
  if (isWeight) {
    document.getElementById("weightTotal").textContent =
      `${weightFormat.format(calculation.materialWeight)} kg`;
    document.getElementById("weightPieces").textContent =
      formatNumber(calculation.pieces);
    document.getElementById("weightUsed").textContent =
      `${weightFormat.format(calculation.usedWeight)} kg`;
    document.getElementById("weightLeftover").textContent =
      `${weightFormat.format(calculation.leftoverWeight)} kg`;
    document.getElementById("weightSheetValue").textContent =
      formatCurrency(calculation.sheetValue);
    document.getElementById("weightUsedValue").textContent =
      formatCurrency(calculation.usedValue);
    resultsSection.hidden = false;
    return;
  }

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
  document.getElementById("afterDimensions").textContent = isMulti
    ? `${formatNumber(calculation.pieces)} potongan campuran`
    : `${formatNumber(calculation.countX)} potongan sepanjang bahan × ${formatNumber(calculation.countY)} potongan sepanjang lebar`;
  createDiagram(document.getElementById("beforeDiagram"), calculation, false);
  createDiagram(document.getElementById("afterDiagram"), calculation, true);
  if (isMulti) {
    document.getElementById("multiLimitNote").hidden =
      !calculation.limitReached;
    const multiCounts = document.getElementById("multiCounts");
    multiCounts.replaceChildren();
    calculation.items.forEach((item) => {
      const row = createElement("div", "multi-count-row");
      row.append(
        createElement(
          "span",
          "",
          `${formatNumber(item.length)} × ${formatNumber(item.width)} cm`,
        ),
        createElement("strong", "", `${formatNumber(item.count)} potong`),
      );
      multiCounts.appendChild(row);
    });
  }
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
    const titleText =
      record.mode === "weight"
        ? `${weightFormat.format(record.materialWeight)} kg → ${formatNumber(record.pieces)} potongan`
        : `${formatNumber(record.length)} × ${formatNumber(record.width)} cm → ${formatNumber(record.pieces)} potongan${record.mode === "multi" ? " campuran" : ""}`;
    const detailText =
      record.mode === "weight"
        ? `${weightFormat.format(record.pieceWeight)} kg per potongan · Sisa ${weightFormat.format(record.leftoverWeight)} kg`
        : record.mode === "multi"
          ? `${record.items.map((item) => `${formatNumber(item.length)} × ${formatNumber(item.width)} cm: ${formatNumber(item.count)}`).join(" · ")} · Sisa ${formatArea(record.leftoverAreaCm2)}`
          : `Potongan ${formatNumber(record.pieceLength)} × ${formatNumber(record.pieceWidth)} cm · Sisa ${formatArea(record.leftoverAreaCm2)}`;
    const title = createElement("p", "history-entry-title", titleText);
    const detail = createElement("p", "history-entry-detail", detailText);
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

function findMixedPlacement(freeRectangles, item) {
  let best = null;
  freeRectangles.forEach((free) => {
    const orientations = [
      { length: item.length, width: item.width },
      { length: item.width, width: item.length },
    ];
    orientations.forEach((orientation) => {
      if (
        orientation.length > free.width + 1e-9 ||
        orientation.width > free.height + 1e-9
      ) {
        return;
      }
      const leftoverWidth = Math.max(0, free.width - orientation.length);
      const leftoverHeight = Math.max(0, free.height - orientation.width);
      const score = [
        Math.min(leftoverWidth, leftoverHeight),
        Math.max(leftoverWidth, leftoverHeight),
        free.width * free.height - item.length * item.width,
      ];
      if (
        !best ||
        score[0] < best.score[0] ||
        (score[0] === best.score[0] && score[1] < best.score[1]) ||
        (score[0] === best.score[0] &&
          score[1] === best.score[1] &&
          score[2] < best.score[2])
      ) {
        best = {
          x: free.x,
          y: free.y,
          length: orientation.length,
          width: orientation.width,
          score,
        };
      }
    });
  });
  return best;
}

function splitMixedFreeRectangles(freeRectangles, used) {
  const split = [];
  freeRectangles.forEach((free) => {
    const intersects =
      used.x < free.x + free.width &&
      used.x + used.length > free.x &&
      used.y < free.y + free.height &&
      used.y + used.width > free.y;
    if (!intersects) {
      split.push(free);
      return;
    }

    const candidates = [
      { x: free.x, y: free.y, width: free.width, height: used.y - free.y },
      {
        x: free.x,
        y: used.y + used.width,
        width: free.width,
        height: free.y + free.height - (used.y + used.width),
      },
      { x: free.x, y: free.y, width: used.x - free.x, height: free.height },
      {
        x: used.x + used.length,
        y: free.y,
        width: free.x + free.width - (used.x + used.length),
        height: free.height,
      },
    ];
    candidates.forEach((candidate) => {
      if (candidate.width > 1e-9 && candidate.height > 1e-9) {
        split.push(candidate);
      }
    });
  });

  const pruned = [];
  split.forEach((candidate, candidateIndex) => {
    const contained = split.some((other, otherIndex) => {
      if (candidateIndex === otherIndex) {
        return false;
      }
      const contains =
        candidate.x >= other.x - 1e-9 &&
        candidate.y >= other.y - 1e-9 &&
        candidate.x + candidate.width <= other.x + other.width + 1e-9 &&
        candidate.y + candidate.height <= other.y + other.height + 1e-9;
      const equal =
        Math.abs(candidate.x - other.x) < 1e-9 &&
        Math.abs(candidate.y - other.y) < 1e-9 &&
        Math.abs(candidate.width - other.width) < 1e-9 &&
        Math.abs(candidate.height - other.height) < 1e-9;
      return contains && (!equal || candidateIndex > otherIndex);
    });
    if (!contained) {
      pruned.push(candidate);
    }
  });
  return pruned;
}

function packMixed(length, width, items, priority) {
  const freeRectangles = [{ x: 0, y: 0, width: length, height: width }];
  const layout = [];
  const maxPieces = MAX_MIXED_PIECES;
  const placePiece = (typeIndex, placement) => {
    const used = {
      x: placement.x,
      y: placement.y,
      length: placement.length,
      width: placement.width,
    };
    layout.push({ ...used, typeIndex });
    const remaining = splitMixedFreeRectangles(freeRectangles, used);
    freeRectangles.splice(0, freeRectangles.length, ...remaining);
  };

  priority.forEach((typeIndex) => {
    if (layout.length >= maxPieces) {
      return;
    }
    const placement = findMixedPlacement(freeRectangles, items[typeIndex]);
    if (placement) {
      placePiece(typeIndex, placement);
    }
  });

  while (layout.length < maxPieces) {
    let placement = null;
    let typeIndex = -1;
    for (const candidateType of priority) {
      const candidate = findMixedPlacement(freeRectangles, items[candidateType]);
      if (candidate) {
        placement = candidate;
        typeIndex = candidateType;
        break;
      }
    }
    if (!placement) {
      break;
    }
    placePiece(typeIndex, placement);
  }
  return layout;
}

function packMixedRows(length, width, items, priority, firstType = null) {
  const allowedTypes =
    firstType === null ? priority : [firstType, ...priority.filter((type) => type !== firstType)];
  const patterns = [];
  allowedTypes.forEach((typeIndex) => {
    const item = items[typeIndex];
    [
      { length: item.length, width: item.width },
      { length: item.width, width: item.length },
    ].forEach((orientation) => {
      const columns = Math.floor(length / orientation.length + 1e-9);
      if (columns > 0 && orientation.width <= width + 1e-9) {
        patterns.push({
          typeIndex,
          length: orientation.length,
          width: orientation.width,
          columns,
          area: columns * orientation.length * orientation.width,
        });
      }
    });
  });
  if (patterns.length === 0) {
    return [];
  }

  const memo = new Map();
  const maxStates = 20000;
  const maxRows = MAX_MIXED_PIECES;
  const countTypes = (mask) => {
    let count = 0;
    for (let value = mask; value; value &= value - 1) {
      count += 1;
    }
    return count;
  };
  const solve = (remaining, mask, rowsLeft) => {
    if (rowsLeft === 0 || remaining <= 1e-9) {
      return { mask, area: 0, rows: [] };
    }
    const key = `${remaining.toPrecision(14)}:${mask}:${rowsLeft}`;
    if (memo.has(key)) {
      return memo.get(key);
    }
    if (memo.size >= maxStates) {
      return { mask, area: 0, rows: [] };
    }

    let best = { mask, area: 0, rows: [] };
    patterns.forEach((pattern) => {
      const nextRemaining = remaining - pattern.width;
      if (
        pattern.width > remaining + 1e-9 ||
        nextRemaining >= remaining
      ) {
        return;
      }
      const nextMask = mask | (1 << pattern.typeIndex);
      const next = solve(
        Math.max(0, nextRemaining),
        nextMask,
        rowsLeft - 1,
      );
      const candidate = {
        mask: next.mask,
        area: pattern.area + next.area,
        rows: [pattern, ...next.rows],
      };
      if (
        countTypes(candidate.mask) > countTypes(best.mask) ||
        (countTypes(candidate.mask) === countTypes(best.mask) &&
          candidate.area > best.area)
      ) {
        best = candidate;
      }
    });
    memo.set(key, best);
    return best;
  };

  let best;
  if (firstType === null) {
    best = solve(width, 0, maxRows);
  } else {
    best = { mask: 0, area: 0, rows: [] };
    patterns
      .filter((pattern) => pattern.typeIndex === firstType)
      .forEach((pattern) => {
        const remaining = width - pattern.width;
        const next = solve(
          Math.max(0, remaining),
          1 << firstType,
          maxRows - 1,
        );
        const candidate = {
          mask: next.mask,
          area: pattern.area + next.area,
          rows: [pattern, ...next.rows],
        };
        if (
          countTypes(candidate.mask) > countTypes(best.mask) ||
          (countTypes(candidate.mask) === countTypes(best.mask) &&
            candidate.area > best.area)
        ) {
          best = candidate;
        }
      });
  }
  const layout = [];
  let y = 0;
  best.rows.forEach((row) => {
    for (
      let column = 0;
      column < row.columns && layout.length < MAX_MIXED_PIECES;
      column += 1
    ) {
      layout.push({
        x: column * row.length,
        y,
        length: row.length,
        width: row.width,
        typeIndex: row.typeIndex,
      });
    }
    y += row.width;
  });
  return layout;
}

function calculateMixed(values) {
  const { length, width, pricePerM2, items } = values;
  if (
    ![length, width, pricePerM2].every(Number.isFinite) ||
    length <= 0 ||
    width <= 0 ||
    pricePerM2 < 0
  ) {
    throw new Error("Masukkan ukuran bahan dan harga yang valid.");
  }
  if (
    items.length === 0 ||
    items.length > MAX_SIZE_TYPES ||
    items.some(
      (item) =>
        !Number.isFinite(item.length) ||
        !Number.isFinite(item.width) ||
        item.length <= 0 ||
        item.width <= 0,
    )
  ) {
    throw new Error("Masukkan ukuran potongan yang valid.");
  }

  const priorities = [];
  const addPriority = (priority) => {
    if (!priorities.some((candidate) => candidate.join(",") === priority.join(","))) {
      priorities.push(priority);
    }
  };
  addPriority(
    items.map((_, index) => index).sort(
      (left, right) =>
        items[right].length * items[right].width -
        items[left].length * items[left].width,
    ),
  );
  addPriority(
    items.map((_, index) => index).sort(
      (left, right) =>
        items[left].length * items[left].width -
        items[right].length * items[right].width,
    ),
  );
  items.forEach((_, index) => {
    addPriority([
      index,
      ...items
        .map((__, otherIndex) => otherIndex)
        .filter((otherIndex) => otherIndex !== index),
    ]);
  });

  let layout = [];
  let usedAreaCm2 = -1;
  let usedTypes = -1;
  const candidateLayouts = priorities.map((priority) =>
    packMixed(length, width, items, priority),
  );
  candidateLayouts.push(packMixedRows(length, width, items, priorities[0]));
  items.forEach((_, typeIndex) => {
    candidateLayouts.push(
      packMixedRows(length, width, items, priorities[0], typeIndex),
    );
  });
  candidateLayouts.forEach((candidateLayout) => {
    const candidateArea = candidateLayout.reduce(
      (area, piece) => area + piece.length * piece.width,
      0,
    );
    const candidateTypes = new Set(
      candidateLayout.map((piece) => piece.typeIndex),
    ).size;
    if (
      candidateTypes > usedTypes ||
      (candidateTypes === usedTypes && candidateArea > usedAreaCm2) ||
      (candidateTypes === usedTypes &&
        candidateArea === usedAreaCm2 &&
        candidateLayout.length > layout.length)
    ) {
      layout = candidateLayout;
      usedAreaCm2 = candidateArea;
      usedTypes = candidateTypes;
    }
  });

  const counts = items.map((_, typeIndex) =>
    layout.reduce((total, piece) => total + Number(piece.typeIndex === typeIndex), 0),
  );
  const resultItems = items.map((item, index) => ({
    ...item,
    count: counts[index],
  }));
  const pieces = layout.length;
  const sheetAreaCm2 = length * width;
  const leftoverAreaCm2 = Math.max(0, sheetAreaCm2 - usedAreaCm2);
  const sheetValue = (sheetAreaCm2 / 10000) * pricePerM2;
  const usedValue = (usedAreaCm2 / 10000) * pricePerM2;
  const leftoverValue = (leftoverAreaCm2 / 10000) * pricePerM2;
  const results = [
    pieces,
    sheetAreaCm2,
    usedAreaCm2,
    leftoverAreaCm2,
    sheetValue,
    usedValue,
    leftoverValue,
  ];
  if (
    !results.every(Number.isFinite) ||
    !Number.isSafeInteger(pieces)
  ) {
    throw new Error("Angka terlalu besar untuk dihitung dengan akurat.");
  }
  return {
    mode: "multi",
    length,
    width,
    pricePerM2,
    items: resultItems,
    layout,
    pieces,
    limitReached: pieces >= MAX_MIXED_PIECES,
    sheetAreaCm2,
    usedAreaCm2,
    leftoverAreaCm2,
    sheetValue,
    usedValue,
    leftoverValue,
    pieceValue: pieces ? usedValue / pieces : 0,
  };
}

function calculateWeight(values) {
  const { materialWeight, pieceWeight, pricePerKg } = values;
  if (
    ![materialWeight, pieceWeight, pricePerKg].every(Number.isFinite) ||
    materialWeight < 0 ||
    pieceWeight <= 0 ||
    pricePerKg < 0
  ) {
    throw new Error("Masukkan berat bahan, berat potongan, dan harga yang valid.");
  }
  if (materialWeight === 0) {
    throw new Error("Berat bahan harus lebih besar dari 0.");
  }
  const pieces = Math.floor(
    materialWeight / pieceWeight +
      Number.EPSILON * Math.max(materialWeight / pieceWeight, 1) * 4,
  );
  const usedWeight = pieces * pieceWeight;
  const leftoverWeight = Math.max(0, materialWeight - usedWeight);
  const sheetValue = materialWeight * pricePerKg;
  const usedValue = usedWeight * pricePerKg;
  if (
    ![pieces, usedWeight, leftoverWeight, sheetValue, usedValue].every(Number.isFinite) ||
    !Number.isSafeInteger(pieces)
  ) {
    throw new Error("Angka terlalu besar untuk dihitung dengan akurat.");
  }
  return {
    ...values,
    mode: "weight",
    pieces,
    usedWeight,
    leftoverWeight,
    sheetValue,
    usedValue,
  };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resultsSection.hidden = true;
  setStatus("", false);

  let calculation;
  try {
    const mode = getMode();
    if (mode === "weight") {
      calculation = calculateWeight({
        materialWeight: Number(document.getElementById("materialWeight").value),
        pieceWeight: Number(document.getElementById("pieceWeight").value),
        pricePerKg: Number(document.getElementById("pricePerKg").value),
      });
    } else {
      const length = Number(document.getElementById("panjangBahan").value);
      const width = Number(document.getElementById("lebarBahan").value);
      const pricePerM2 = Number(document.getElementById("hargaPerMeter").value);
      if (mode === "multi") {
        const items = [...sizeRows.querySelectorAll(".size-row")].map((row) => {
          const inputs = row.querySelectorAll("input");
          return {
            length: Number(inputs[0].value),
            width: Number(inputs[1].value),
          };
        });
        calculation = calculateMixed({ length, width, pricePerM2, items });
      } else {
        calculation = calculate({
          length,
          width,
          pieceLength: Number(document.getElementById("panjangPotong").value),
          pieceWidth: Number(document.getElementById("lebarPotong").value),
          pricePerM2,
          mode: "single",
        });
      }
    }
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

  const { layout, ...recordData } = calculation;
  const record = {
    ...recordData,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  const nextHistory = [record, ...historyRecords];
  try {
    await AppStorage.writeHistory(nextHistory);
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

historyList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button || !historyAvailable) {
    return;
  }

  const nextHistory = historyRecords.filter(
    (record) => record.id !== button.dataset.deleteId,
  );
  try {
    await AppStorage.writeHistory(nextHistory);
    historyRecords = nextHistory;
    renderHistory();
    setStatus("Kalkulasi dihapus dari riwayat.", false);
  } catch (error) {
    setStatus(`Riwayat gagal diperbarui: ${error.message}`, true);
  }
});

async function loadHistory() {
  try {
    const migration = await AppStorage.initialize();
    historyRecords = await AppStorage.readHistory();
    renderHistory();
    if (migration.warning) {
      setStatus(migration.warning, true);
    }
  } catch (error) {
    historyAvailable = false;
    setStatus(`Riwayat tidak dapat dibaca: ${error.message}`, true);
  }
}

setMode(getMode());
renderHistory();
loadHistory();
