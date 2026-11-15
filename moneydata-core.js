(function (global) {
  "use strict";

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
    summarize,
  });
})(window);
