// Change this key or the record fields below if the saved sales format changes.
const STORAGE_KEY = "kalkulatorProduk.salesData.v1";
const currencyFormat = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const quantityFormat = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});
const compactFormat = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});
// Customize these category-series colors; the total-sales line uses the lime accent.
const CATEGORY_CHART_COLORS = [
  "#83c6ff",
  "#d9a6ff",
  "#f7b867",
  "#ff9f80",
  "#73d6a1",
  "#8bd3c7",
];
const TOTAL_CHART_COLOR = "#c5f36b";

const salesForm = document.getElementById("salesForm");
const saleDateInput = document.getElementById("saleDate");
const productNameInput = document.getElementById("productName");
const categoryInput = document.getElementById("productCategory");
const quantityInput = document.getElementById("quantity");
const unitPriceInput = document.getElementById("unitPrice");
const noteInput = document.getElementById("saleNote");
const salesStatus = document.getElementById("salesStatus");
const salesTableBody = document.getElementById("data-table-body");
const productSuggestions = document.getElementById("productSuggestions");
const categorySuggestions = document.getElementById("categorySuggestions");
const filterStartInput = document.getElementById("filterStart");
const filterEndInput = document.getElementById("filterEnd");
const menuToggle = document.getElementById("menuToggle");
const pageMenu = document.getElementById("pageMenu");

let sales = [];
// Keep this catalog after a sale is deleted so product entry suggestions persist.
let productCatalog = [];
let storageAvailable = true;

function createLocalDateValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function setStatus(message, isError = false) {
  salesStatus.textContent = message;
  salesStatus.classList.toggle("is-error", isError);
}

function isValidSale(record) {
  return (
    record !== null &&
    typeof record === "object" &&
    typeof record.id === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
    Number.isFinite(Date.parse(`${record.date}T00:00:00`)) &&
    typeof record.product === "string" &&
    typeof record.category === "string" &&
    typeof record.note === "string" &&
    Number.isFinite(record.quantity) &&
    record.quantity > 0 &&
    Number.isFinite(record.unitPrice) &&
    record.unitPrice >= 0 &&
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
    product.unitPrice >= 0
  );
}

// Keep sales and remembered products together so one save updates the whole store.
function readSavedData() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) {
    return { sales: [], products: [] };
  }

  const parsed = JSON.parse(stored);
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !Array.isArray(parsed.sales) ||
    !Array.isArray(parsed.products) ||
    !parsed.sales.every(isValidSale) ||
    !parsed.products.every(isValidProduct)
  ) {
    throw new Error("Format data penjualan tersimpan tidak valid.");
  }
  return parsed;
}

function saveData(successMessage) {
  if (!storageAvailable) {
    setStatus(
      "Perubahan hanya tersedia selama halaman ini terbuka karena penyimpanan browser tidak dapat digunakan.",
      true,
    );
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sales, products: productCatalog }),
    );
    setStatus(successMessage);
  } catch (error) {
    storageAvailable = false;
    setStatus(`Data berubah, tetapi gagal disimpan: ${error.message}`, true);
  }
}

function formatCurrency(value) {
  return currencyFormat.format(value);
}

function formatDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("id-ID", options).format(
    new Date(`${value}T00:00:00`),
  );
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

function createSvgElement(svg, tagName, attributes, text) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, String(value));
  });
  if (text !== undefined) {
    element.textContent = text;
  }
  svg.appendChild(element);
  return element;
}

function renderSuggestions() {
  productSuggestions.replaceChildren();
  categorySuggestions.replaceChildren();

  productCatalog
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, "id"))
    .forEach((product) => {
      const option = createElement("option");
      option.value = product.name;
      productSuggestions.appendChild(option);
    });

  const categories = [...new Set(
    productCatalog
      .map((product) => product.category.trim())
      .filter((category) => category && category !== "Tanpa kategori"),
  )].sort((left, right) => left.localeCompare(right, "id"));
  categories.forEach((category) => {
    const option = createElement("option");
    option.value = category;
    categorySuggestions.appendChild(option);
  });
}

function rememberProduct(sale) {
  // Reuse a product name but refresh its latest category and unit price.
  const existing = productCatalog.find(
    (product) => product.name.toLocaleLowerCase("id") === sale.product.toLocaleLowerCase("id"),
  );
  if (existing) {
    existing.name = sale.product;
    existing.category = sale.category;
    existing.unitPrice = sale.unitPrice;
  } else {
    productCatalog.push({
      name: sale.product,
      category: sale.category,
      unitPrice: sale.unitPrice,
    });
  }
  renderSuggestions();
}

function fillRememberedProduct() {
  const typedName = productNameInput.value.trim().toLocaleLowerCase("id");
  const remembered = productCatalog.find(
    (product) => product.name.toLocaleLowerCase("id") === typedName,
  );
  if (remembered) {
    categoryInput.value =
      remembered.category === "Tanpa kategori" ? "" : remembered.category;
    unitPriceInput.value = String(remembered.unitPrice);
  }
}

function getFilteredSales() {
  const start = filterStartInput.value;
  const end = filterEndInput.value;
  if (start && end && start > end) {
    throw new Error("Tanggal awal harus sama atau sebelum tanggal akhir.");
  }
  return sales.filter(
    (sale) => (!start || sale.date >= start) && (!end || sale.date <= end),
  );
}

function renderSalesTable(records) {
  salesTableBody.replaceChildren();
  document.getElementById("tableCount").textContent =
    `${quantityFormat.format(records.length)} catatan`;
  document.getElementById("emptySales").hidden = records.length > 0;

  records
    .slice()
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.createdAt.localeCompare(left.createdAt),
    )
    .forEach((sale) => {
      const row = document.createElement("tr");
      // Keep this cell order aligned with the table headings in moneydata.html.
      const cells = [
        formatDate(sale.date),
        sale.product,
        sale.category,
        quantityFormat.format(sale.quantity),
        formatCurrency(sale.unitPrice),
        formatCurrency(sale.quantity * sale.unitPrice),
        sale.note || "—",
      ];
      cells.forEach((value) => {
        row.appendChild(createElement("td", "", value));
      });

      const actionCell = document.createElement("td");
      actionCell.className = "sales-actions";
      const editButton = createElement("button", "sales-action-button", "Edit");
      editButton.type = "button";
      editButton.dataset.action = "edit";
      editButton.dataset.saleId = sale.id;
      editButton.setAttribute("aria-label", `Edit penjualan ${sale.product}`);
      const deleteButton = createElement("button", "sales-action-button", "Hapus");
      deleteButton.type = "button";
      deleteButton.dataset.action = "delete";
      deleteButton.dataset.saleId = sale.id;
      deleteButton.setAttribute("aria-label", `Hapus penjualan ${sale.product}`);
      actionCell.append(editButton, deleteButton);
      row.appendChild(actionCell);
      salesTableBody.appendChild(row);
    });
}

function renderLineChart(records) {
  const container = document.getElementById("lineChart");
  const legend = document.getElementById("lineLegend");
  container.replaceChildren();
  legend.replaceChildren();
  // Keep daily totals and per-category amounts so every line uses the same dates.
  const dailyRevenue = new Map();
  const dailyCategoryRevenue = new Map();
  const categoryTotals = new Map();
  records.forEach((sale) => {
    const category = sale.category.trim() || "Tanpa kategori";
    const revenue = sale.quantity * sale.unitPrice;
    dailyRevenue.set(
      sale.date,
      (dailyRevenue.get(sale.date) || 0) + revenue,
    );
    if (!dailyCategoryRevenue.has(sale.date)) {
      dailyCategoryRevenue.set(sale.date, new Map());
    }
    const dailyCategories = dailyCategoryRevenue.get(sale.date);
    dailyCategories.set(category, (dailyCategories.get(category) || 0) + revenue);
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + revenue);
  });
  const dates = [...dailyRevenue.keys()].sort((left, right) =>
    left.localeCompare(right),
  );

  if (dates.length === 0) {
    container.appendChild(
      createElement("p", "chart-empty", "Belum ada penjualan pada rentang tanggal ini."),
    );
    return;
  }

  const categories = [...categoryTotals.keys()].sort(
    (left, right) => categoryTotals.get(right) - categoryTotals.get(left),
  );
  const categorySeries = categories.map((name, index) => ({
    name,
    color: CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length],
    values: dates.map(
      (date) => dailyCategoryRevenue.get(date).get(name) || 0,
    ),
    type: "category",
  }));
  const totalSeries = {
    name: "Total penjualan",
    color: TOTAL_CHART_COLOR,
    values: dates.map((date) => dailyRevenue.get(date)),
    type: "total",
  };

  const width = 900;
  const height = 320;
  const margins = { top: 24, right: 24, bottom: 58, left: 90 };
  const plotWidth = width - margins.left - margins.right;
  const plotHeight = height - margins.top - margins.bottom;
  const maxRevenue = Math.max(1, ...dailyRevenue.values());
  const firstDay = Date.parse(`${dates[0]}T00:00:00Z`);
  const lastDay = Date.parse(`${dates[dates.length - 1]}T00:00:00Z`);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    "Grafik garis total penjualan dan pendapatan per kategori berdasarkan tanggal",
  );

  // Grid labels make the chart readable without an external charting library.
  for (let tick = 0; tick <= 4; tick += 1) {
    const y = margins.top + (plotHeight * tick) / 4;
    const value = maxRevenue * (1 - tick / 4);
    createSvgElement(svg, "line", {
      x1: margins.left,
      y1: y,
      x2: width - margins.right,
      y2: y,
      stroke: "#2e3545",
      "stroke-width": 1,
    });
    createSvgElement(
      svg,
      "text",
      {
        x: margins.left - 10,
        y: y + 4,
        "text-anchor": "end",
        fill: "#9aa4b6",
        "font-size": 11,
      },
      `Rp ${compactFormat.format(value)}`,
    );
  }

  const xForDate = (date) =>
    firstDay === lastDay
      ? margins.left + plotWidth / 2
      : margins.left +
        (plotWidth * (Date.parse(`${date}T00:00:00Z`) - firstDay)) /
          (lastDay - firstDay);
  const chartSeries = [...categorySeries, totalSeries].map((series) => ({
    ...series,
    points: series.values.map((revenue, index) => ({
      date: dates[index],
      revenue,
      x: xForDate(dates[index]),
      y: margins.top + plotHeight * (1 - revenue / maxRevenue),
    })),
  }));

  // Category lines are drawn first so the brighter total line stays easy to see.
  chartSeries.forEach((series) => {
    createSvgElement(svg, "polyline", {
      points: series.points.map((point) => `${point.x},${point.y}`).join(" "),
      fill: "none",
      stroke: series.color,
      "stroke-width": series.type === "total" ? 4 : 2.5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "data-series": series.type,
      "aria-label": series.name,
    });
    series.points.forEach((point) => {
      createSvgElement(svg, "circle", {
        cx: point.x,
        cy: point.y,
        r: series.type === "total" ? 4 : 3,
        fill: series.color,
        stroke: "#10131d",
        "stroke-width": 2,
      });
    });
  });

  const labelIndexes = new Set([
    0,
    Math.floor((dates.length - 1) / 2),
    dates.length - 1,
  ]);
  labelIndexes.forEach((index) => {
    createSvgElement(
      svg,
      "text",
      {
        x: xForDate(dates[index]),
        y: height - 23,
        "text-anchor": "middle",
        fill: "#9aa4b6",
        "font-size": 11,
      },
      formatDate(dates[index], { day: "numeric", month: "short" }),
    );
  });
  container.appendChild(svg);

  // The legend names the total and each category drawn above.
  [totalSeries, ...categorySeries].forEach((series) => {
    const item = createElement("div", "line-legend-item");
    const swatch = createElement("span", "line-legend-swatch");
    swatch.style.backgroundColor = series.color;
    item.append(
      swatch,
      createElement("span", "", series.name),
    );
    legend.appendChild(item);
  });
}

function renderPieChart(records) {
  const chart = document.getElementById("pieChart");
  const legend = document.getElementById("pieLegend");
  chart.replaceChildren();
  legend.replaceChildren();
  // Change this grouping key if the pie chart should compare products instead.
  const categoryRevenue = new Map();
  records.forEach((sale) => {
    const category = sale.category.trim() || "Tanpa kategori";
    categoryRevenue.set(
      category,
      (categoryRevenue.get(category) || 0) + sale.quantity * sale.unitPrice,
    );
  });
  const categories = [...categoryRevenue.entries()]
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((left, right) => right.revenue - left.revenue);
  const totalRevenue = categories.reduce((total, item) => total + item.revenue, 0);

  if (categories.length === 0 || totalRevenue === 0) {
    chart.appendChild(
      createElement("p", "chart-empty", "Belum ada pendapatan untuk dikelompokkan."),
    );
    return;
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const center = 150;
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  let dashOffset = 0;
  svg.setAttribute("viewBox", "0 0 300 300");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Diagram lingkaran pendapatan berdasarkan kategori");
  createSvgElement(svg, "circle", {
    cx: center,
    cy: center,
    r: radius,
    fill: "none",
    stroke: "#2e3545",
    "stroke-width": 34,
  });

  categories.forEach((item, index) => {
    const fraction = item.revenue / totalRevenue;
    const dashLength = fraction * circumference;
    createSvgElement(svg, "circle", {
      cx: center,
      cy: center,
      r: radius,
      fill: "none",
      stroke:
        CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length],
      "stroke-width": 34,
      "stroke-dasharray": `${dashLength} ${circumference - dashLength}`,
      "stroke-dashoffset": -dashOffset,
      transform: `rotate(-90 ${center} ${center})`,
    });
    dashOffset += dashLength;

    const legendRow = createElement("div", "chart-legend-item");
    const swatch = createElement("span", "chart-swatch");
    swatch.style.backgroundColor =
      CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length];
    swatch.setAttribute("aria-hidden", "true");
    const name = createElement("span", "chart-legend-name", item.name);
    const amount = createElement(
      "strong",
      "chart-legend-amount",
      `${formatCurrency(item.revenue)} · ${quantityFormat.format(fraction * 100)}%`,
    );
    legendRow.append(swatch, name, amount);
    legend.appendChild(legendRow);
  });
  createSvgElement(
    svg,
    "text",
    {
      x: center,
      y: center - 3,
      "text-anchor": "middle",
      fill: "#9aa4b6",
      "font-size": 12,
    },
    "Total",
  );
  createSvgElement(
    svg,
    "text",
    {
      x: center,
      y: center + 19,
      "text-anchor": "middle",
      fill: "#f3f5f8",
      "font-size": 13,
      "font-weight": 700,
    },
    formatCurrency(totalRevenue),
  );
  chart.appendChild(svg);
}

function renderDashboard() {
  let filteredSales;
  try {
    filteredSales = getFilteredSales();
  } catch (error) {
    setStatus(error.message, true);
    return;
  }

  const totalRevenue = filteredSales.reduce(
    (total, sale) => total + sale.quantity * sale.unitPrice,
    0,
  );
  const unitsSold = filteredSales.reduce((total, sale) => total + sale.quantity, 0);
  document.getElementById("totalRevenue").textContent = formatCurrency(totalRevenue);
  document.getElementById("transactionCount").textContent =
    quantityFormat.format(filteredSales.length);
  document.getElementById("unitsSold").textContent = quantityFormat.format(unitsSold);
  renderSalesTable(filteredSales);
  renderLineChart(filteredSales);
  renderPieChart(filteredSales);
}

function resetSaleForm() {
  salesForm.reset();
  delete salesForm.dataset.editId;
  saleDateInput.value = createLocalDateValue();
  document.getElementById("submitLabel").textContent = "Simpan penjualan";
  document.getElementById("cancelEditButton").hidden = true;
}

function startEditingSale(sale) {
  saleDateInput.value = sale.date;
  productNameInput.value = sale.product;
  categoryInput.value = sale.category === "Tanpa kategori" ? "" : sale.category;
  quantityInput.value = String(sale.quantity);
  unitPriceInput.value = String(sale.unitPrice);
  noteInput.value = sale.note;
  salesForm.dataset.editId = sale.id;
  document.getElementById("submitLabel").textContent = "Simpan perubahan";
  document.getElementById("cancelEditButton").hidden = false;
  salesForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createSaleId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Product and category inputs are intentionally free text; saved values only act as suggestions.
salesForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setStatus("");

  const date = saleDateInput.value;
  const product = productNameInput.value.trim();
  const category = categoryInput.value.trim() || "Tanpa kategori";
  const quantity = Number(quantityInput.value);
  const unitPrice = Number(unitPriceInput.value);
  if (
    !date ||
    !Number.isFinite(Date.parse(`${date}T00:00:00`)) ||
    !product ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    unitPriceInput.value.trim() === "" ||
    !Number.isFinite(unitPrice) ||
    unitPrice < 0
  ) {
    setStatus("Isi tanggal, produk, jumlah, dan harga dengan nilai yang valid.", true);
    return;
  }

  const editId = salesForm.dataset.editId;
  const existing = editId ? sales.find((sale) => sale.id === editId) : null;
  const sale = {
    id: existing ? existing.id : createSaleId(),
    date,
    product,
    category,
    quantity,
    unitPrice,
    note: noteInput.value.trim(),
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
  };
  if (existing) {
    sales = sales.map((item) => (item.id === editId ? sale : item));
  } else {
    sales = [sale, ...sales];
  }
  rememberProduct(sale);
  resetSaleForm();
  renderDashboard();
  saveData(existing ? "Perubahan penjualan berhasil disimpan." : "Penjualan berhasil disimpan.");
});

productNameInput.addEventListener("input", fillRememberedProduct);
document.getElementById("cancelEditButton").addEventListener("click", () => {
  resetSaleForm();
  setStatus("Edit dibatalkan.");
});
document.getElementById("clearFiltersButton").addEventListener("click", () => {
  filterStartInput.value = "";
  filterEndInput.value = "";
  setStatus("");
  renderDashboard();
});
[filterStartInput, filterEndInput].forEach((input) => {
  input.addEventListener("change", () => {
    setStatus("");
    renderDashboard();
  });
});

salesTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }
  const sale = sales.find((item) => item.id === button.dataset.saleId);
  if (!sale) {
    return;
  }
  if (button.dataset.action === "edit") {
    startEditingSale(sale);
    return;
  }
  if (button.dataset.action === "delete") {
    sales = sales.filter((item) => item.id !== sale.id);
    renderDashboard();
    saveData("Penjualan dihapus. Produk tetap tersimpan sebagai saran.");
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

try {
  const savedData = readSavedData();
  sales = savedData.sales;
  productCatalog = savedData.products;
} catch (error) {
  storageAvailable = false;
  setStatus(`Data tersimpan tidak dapat dibaca: ${error.message}`, true);
}

saleDateInput.value = createLocalDateValue();
renderSuggestions();
renderDashboard();
