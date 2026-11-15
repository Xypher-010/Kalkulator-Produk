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
const unitCostInput = document.getElementById("unitCost");
const cuttingCostInput = document.getElementById("cuttingCost");
const noteInput = document.getElementById("saleNote");
const salesStatus = document.getElementById("salesStatus");
const salesTableBody = document.getElementById("data-table-body");
const expenseForm = document.getElementById("expenseForm");
const expenseDateInput = document.getElementById("expenseDate");
const expenseDescriptionInput = document.getElementById("expenseDescription");
const expenseCategoryInput = document.getElementById("expenseCategory");
const expenseAmountInput = document.getElementById("expenseAmount");
const expenseNoteInput = document.getElementById("expenseNote");
const expenseStatus = document.getElementById("expenseStatus");
const expensesTableBody = document.getElementById("expense-table-body");
const productSuggestions = document.getElementById("productSuggestions");
const categorySuggestions = document.getElementById("categorySuggestions");
const filterStartInput = document.getElementById("filterStart");
const filterEndInput = document.getElementById("filterEnd");
const menuToggle = document.getElementById("menuToggle");
const pageMenu = document.getElementById("pageMenu");

let sales = [];
let expenses = [];
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

function setExpenseStatus(message, isError = false) {
  expenseStatus.textContent = message;
  expenseStatus.classList.toggle("is-error", isError);
}

function saveData(successMessage, statusTarget = salesStatus) {
  if (!storageAvailable) {
    const message =
      "Perubahan hanya tersedia selama halaman ini terbuka karena penyimpanan browser tidak dapat digunakan.";
    statusTarget === expenseStatus
      ? setExpenseStatus(message, true)
      : setStatus(message, true);
    return;
  }

  try {
    FinanceCore.writeSavedData({ sales, products: productCatalog, expenses });
    statusTarget === expenseStatus
      ? setExpenseStatus(successMessage)
      : setStatus(successMessage);
  } catch (error) {
    storageAvailable = false;
    const message = `Data berubah, tetapi gagal disimpan: ${error.message}`;
    statusTarget === expenseStatus
      ? setExpenseStatus(message, true)
      : setStatus(message, true);
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
    existing.unitCost = sale.unitCost;
  } else {
    productCatalog.push({
      name: sale.product,
      category: sale.category,
      unitPrice: sale.unitPrice,
      unitCost: sale.unitCost,
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
    unitCostInput.value = String(remembered.unitCost);
  }
}

function getFilteredSales() {
  return FinanceCore.filterByDateRange(
    sales,
    filterStartInput.value,
    filterEndInput.value,
  );
}

function getFilteredExpenses() {
  return FinanceCore.filterByDateRange(
    expenses,
    filterStartInput.value,
    filterEndInput.value,
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
      const financials = FinanceCore.getSaleFinancials(sale);
      const cells = [
        formatDate(sale.date),
        sale.product,
        sale.category,
        quantityFormat.format(sale.quantity),
        formatCurrency(sale.unitPrice),
        formatCurrency(financials.revenue),
        formatCurrency(financials.costOfGoods),
        formatCurrency(financials.cuttingCost),
        formatCurrency(financials.profit),
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

function renderExpensesTable(records) {
  expensesTableBody.replaceChildren();
  document.getElementById("expenseTableCount").textContent =
    `${quantityFormat.format(records.length)} catatan`;
  document.getElementById("emptyExpenses").hidden = records.length > 0;

  records
    .slice()
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.createdAt.localeCompare(left.createdAt),
    )
    .forEach((expense) => {
      const row = document.createElement("tr");
      [
        formatDate(expense.date),
        expense.description,
        expense.category || "—",
        formatCurrency(expense.amount),
        expense.note || "—",
      ].forEach((value) => row.appendChild(createElement("td", "", value)));

      const actionCell = document.createElement("td");
      actionCell.className = "sales-actions";
      const editButton = createElement("button", "sales-action-button", "Edit");
      editButton.type = "button";
      editButton.dataset.action = "edit-expense";
      editButton.dataset.expenseId = expense.id;
      editButton.setAttribute("aria-label", `Edit pengeluaran ${expense.description}`);
      const deleteButton = createElement("button", "sales-action-button", "Hapus");
      deleteButton.type = "button";
      deleteButton.dataset.action = "delete-expense";
      deleteButton.dataset.expenseId = expense.id;
      deleteButton.setAttribute("aria-label", `Hapus pengeluaran ${expense.description}`);
      actionCell.append(editButton, deleteButton);
      row.appendChild(actionCell);
      expensesTableBody.appendChild(row);
    });
}

function renderLineChart(records) {
  const container = document.getElementById("lineChart");
  const legend = document.getElementById("lineLegend");
  container.replaceChildren();
  legend.replaceChildren();
  const chartData = FinanceCore.getSalesChartData(records);
  const { dailyRevenue, dailyCategoryRevenue, categories, dates } = chartData;

  if (dates.length === 0) {
    container.appendChild(
      createElement("p", "chart-empty", "Belum ada penjualan pada rentang tanggal ini."),
    );
    return;
  }

  const categorySeries = categories.map(({ name }, index) => ({
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
  const { categories } = FinanceCore.getSalesChartData(records);
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
  let filteredExpenses;
  try {
    filteredSales = getFilteredSales();
    filteredExpenses = getFilteredExpenses();
  } catch (error) {
    setStatus(error.message, true);
    return;
  }

  const summary = FinanceCore.summarize(filteredSales, filteredExpenses);
  document.getElementById("totalRevenue").textContent = formatCurrency(summary.revenue);
  document.getElementById("totalExpenses").textContent =
    formatCurrency(summary.totalExpenses);
  document.getElementById("expenseBreakdown").textContent =
    `HPP ${formatCurrency(summary.costOfGoods)} · potong ${formatCurrency(summary.cuttingCosts)} · umum ${formatCurrency(summary.otherExpenses)}`;
  document.getElementById("netBalance").textContent =
    formatCurrency(summary.netProfit);
  document.getElementById("transactionCount").textContent =
    quantityFormat.format(summary.transactionCount);
  document.getElementById("unitsSold").textContent =
    quantityFormat.format(summary.unitsSold);
  renderSalesTable(filteredSales);
  renderExpensesTable(filteredExpenses);
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
  unitCostInput.value = String(sale.unitCost);
  cuttingCostInput.value = String(sale.cuttingCost);
  noteInput.value = sale.note;
  salesForm.dataset.editId = sale.id;
  document.getElementById("submitLabel").textContent = "Simpan perubahan";
  document.getElementById("cancelEditButton").hidden = false;
  salesForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createRecordId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function resetExpenseForm() {
  expenseForm.reset();
  delete expenseForm.dataset.editId;
  expenseDateInput.value = createLocalDateValue();
  document.getElementById("expenseSubmitLabel").textContent = "Simpan pengeluaran";
  document.getElementById("cancelExpenseEditButton").hidden = true;
}

function startEditingExpense(expense) {
  expenseDateInput.value = expense.date;
  expenseDescriptionInput.value = expense.description;
  expenseCategoryInput.value = expense.category;
  expenseAmountInput.value = String(expense.amount);
  expenseNoteInput.value = expense.note;
  expenseForm.dataset.editId = expense.id;
  document.getElementById("expenseSubmitLabel").textContent = "Simpan perubahan";
  document.getElementById("cancelExpenseEditButton").hidden = false;
  expenseForm.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const unitCost = Number(unitCostInput.value);
  const cuttingCost = Number(cuttingCostInput.value);
  if (
    !date ||
    !Number.isFinite(Date.parse(`${date}T00:00:00`)) ||
    !product ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    unitPriceInput.value.trim() === "" ||
    !Number.isFinite(unitPrice) ||
    unitPrice < 0 ||
    unitCostInput.value.trim() === "" ||
    !Number.isFinite(unitCost) ||
    unitCost < 0 ||
    cuttingCostInput.value.trim() === "" ||
    !Number.isFinite(cuttingCost) ||
    cuttingCost < 0
  ) {
    setStatus("Isi data penjualan, HPP, dan biaya potong dengan nilai yang valid.", true);
    return;
  }

  const editId = salesForm.dataset.editId;
  const existing = editId ? sales.find((sale) => sale.id === editId) : null;
  const sale = {
    id: existing ? existing.id : createRecordId(),
    date,
    product,
    category,
    quantity,
    unitPrice,
    unitCost,
    cuttingCost,
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

expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setExpenseStatus("");

  const date = expenseDateInput.value;
  const description = expenseDescriptionInput.value.trim();
  const amount = Number(expenseAmountInput.value);
  if (
    !date ||
    !Number.isFinite(Date.parse(`${date}T00:00:00`)) ||
    !description ||
    expenseAmountInput.value.trim() === "" ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    setExpenseStatus("Isi tanggal, nama, dan jumlah pengeluaran dengan nilai yang valid.", true);
    return;
  }

  const editId = expenseForm.dataset.editId;
  const existing = editId ? expenses.find((expense) => expense.id === editId) : null;
  const expense = {
    id: existing ? existing.id : createRecordId(),
    date,
    description,
    category: expenseCategoryInput.value.trim(),
    amount,
    note: expenseNoteInput.value.trim(),
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
  };
  if (existing) {
    expenses = expenses.map((item) => (item.id === editId ? expense : item));
  } else {
    expenses = [expense, ...expenses];
  }
  resetExpenseForm();
  renderDashboard();
  saveData(
    existing ? "Perubahan pengeluaran berhasil disimpan." : "Pengeluaran berhasil disimpan.",
    expenseStatus,
  );
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

document.getElementById("cancelExpenseEditButton").addEventListener("click", () => {
  resetExpenseForm();
  setExpenseStatus("Edit dibatalkan.");
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

expensesTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }
  const expense = expenses.find((item) => item.id === button.dataset.expenseId);
  if (!expense) {
    return;
  }
  if (button.dataset.action === "edit-expense") {
    startEditingExpense(expense);
    return;
  }
  if (button.dataset.action === "delete-expense") {
    expenses = expenses.filter((item) => item.id !== expense.id);
    renderDashboard();
    saveData("Pengeluaran dihapus.", expenseStatus);
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
  const savedData = FinanceCore.readSavedData();
  sales = savedData.sales;
  productCatalog = savedData.products;
  expenses = savedData.expenses;
} catch (error) {
  storageAvailable = false;
  setStatus(`Data tersimpan tidak dapat dibaca: ${error.message}`, true);
}

saleDateInput.value = createLocalDateValue();
expenseDateInput.value = createLocalDateValue();
renderSuggestions();
renderDashboard();
