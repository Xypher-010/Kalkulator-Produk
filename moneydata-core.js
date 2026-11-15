(function (global) {
  "use strict";

  const STORAGE_KEY = "kalkulatorProduk.salesData.v1";

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
      /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
      Number.isFinite(Date.parse(`${record.date}T00:00:00`)) &&
      typeof record.description === "string" &&
      typeof record.category === "string" &&
      typeof record.note === "string" &&
      Number.isFinite(record.amount) &&
      record.amount >= 0 &&
      typeof record.createdAt === "string"
    );
  }

  function readSavedData() {
    const stored = global.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return { sales: [], products: [], expenses: [] };
    }

    const parsed = JSON.parse(stored);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.sales) ||
      !Array.isArray(parsed.products) ||
      !parsed.sales.every(isValidSale) ||
      !parsed.products.every(isValidProduct) ||
      (parsed.expenses !== undefined &&
        (!Array.isArray(parsed.expenses) || !parsed.expenses.every(isValidExpense)))
    ) {
      throw new Error("Format data keuangan tersimpan tidak valid.");
    }

    return {
      ...parsed,
      products: parsed.products.map((product) => ({
        ...product,
        unitCost: product.unitCost === undefined ? 0 : product.unitCost,
      })),
      sales: parsed.sales.map((sale) => ({
        ...sale,
        unitCost: sale.unitCost === undefined ? 0 : sale.unitCost,
        cuttingCost: sale.cuttingCost === undefined ? 0 : sale.cuttingCost,
      })),
      expenses: parsed.expenses || [],
    };
  }

  function writeSavedData(data) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function filterByDateRange(records, start, end) {
    if (start && end && start > end) {
      throw new Error("Tanggal awal harus sama atau sebelum tanggal akhir.");
    }
    return records.filter(
      (record) => (!start || record.date >= start) && (!end || record.date <= end),
    );
  }

  function getSaleFinancials(sale) {
    const revenue = sale.quantity * sale.unitPrice;
    const costOfGoods = sale.quantity * (sale.unitCost || 0);
    const cuttingCost = sale.cuttingCost || 0;
    return {
      revenue,
      costOfGoods,
      cuttingCost,
      profit: revenue - costOfGoods - cuttingCost,
    };
  }

  function summarize(sales, expenses) {
    const summary = {
      revenue: 0,
      costOfGoods: 0,
      cuttingCosts: 0,
      otherExpenses: 0,
      totalExpenses: 0,
      netProfit: 0,
      unitsSold: 0,
      transactionCount: sales.length + expenses.length,
    };

    sales.forEach((sale) => {
      const financials = getSaleFinancials(sale);
      summary.revenue += financials.revenue;
      summary.costOfGoods += financials.costOfGoods;
      summary.cuttingCosts += financials.cuttingCost;
      summary.unitsSold += sale.quantity;
    });
    expenses.forEach((expense) => {
      summary.otherExpenses += expense.amount;
    });
    summary.totalExpenses =
      summary.costOfGoods + summary.cuttingCosts + summary.otherExpenses;
    summary.netProfit = summary.revenue - summary.totalExpenses;
    return summary;
  }

  function getSalesChartData(records, maxCategories = 5) {
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

    const topCategories = [...categoryTotals.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, maxCategories)
      .map(([name]) => name);
    const topCategorySet = new Set(topCategories);
    const visibleCategoryTotals = new Map();
    const visibleDailyCategoryRevenue = new Map();
    const displayCategory = (category) =>
      topCategorySet.has(category) ? category : "Lainnya";

    categoryTotals.forEach((revenue, category) => {
      const visibleName = displayCategory(category);
      visibleCategoryTotals.set(
        visibleName,
        (visibleCategoryTotals.get(visibleName) || 0) + revenue,
      );
    });
    dailyCategoryRevenue.forEach((categories, date) => {
      const visibleCategories = new Map();
      categories.forEach((revenue, category) => {
        const visibleName = displayCategory(category);
        visibleCategories.set(
          visibleName,
          (visibleCategories.get(visibleName) || 0) + revenue,
        );
      });
      visibleDailyCategoryRevenue.set(date, visibleCategories);
    });

    return {
      dates: [...dailyRevenue.keys()].sort((left, right) =>
        left.localeCompare(right),
      ),
      dailyRevenue,
      dailyCategoryRevenue: visibleDailyCategoryRevenue,
      categories: [...visibleCategoryTotals.entries()]
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((left, right) => right.revenue - left.revenue),
    };
  }

  global.FinanceCore = Object.freeze({
    filterByDateRange,
    getSaleFinancials,
    getSalesChartData,
    readSavedData,
    summarize,
    writeSavedData,
  });
})(window);
