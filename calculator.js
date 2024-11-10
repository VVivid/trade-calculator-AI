// State management
let state = {
  accountSize: 1000,
  riskPercentage: 1.5,
  leverage: 5,
  isLong: true,
  entryPrice: 0,
  stopLossPercentage: 3.62,
  stopLoss: 0,
  targetRR: 0.7,
  tpPercentages: {
    tp1: 25,
    tp2: 25,
    tp3: 25,
    tp4: 25,
  },
};

// Utility functions
function roundToThree(num) {
  return Math.ceil(num * 1000) / 1000;
}

function formatNumber(num) {
  const rounded = roundToThree(num).toFixed(3);
  return rounded.replace(/\.?0+$/, "");
}

function calculateStopLoss(entry, percentage, isLong) {
  if (!entry || !percentage) return 0;
  return roundToThree(
    isLong
      ? entry * (1 - percentage / 100) // Long: SL below entry
      : entry * (1 + percentage / 100)
  ); // Short: SL above entry
}

function calculatePercentage(entry, stopLoss, isLong) {
  if (!entry || !stopLoss) return 0;
  return roundToThree(
    isLong
      ? ((entry - stopLoss) / entry) * 100 // Long: how far below entry
      : ((stopLoss - entry) / entry) * 100
  ); // Short: how far above entry
}

function calculatePosition() {
  if (!state.entryPrice) {
    hideResults();
    return;
  }

  // Ensure we're working with valid numbers
  const entry = parseFloat(state.entryPrice);
  const stopLoss =
    state.stopLoss ||
    calculateStopLoss(entry, state.stopLossPercentage, state.isLong);

  // Calculate price movement and risk amount
  const priceMovement = roundToThree(Math.abs(entry - stopLoss));
  const riskAmount = roundToThree(
    state.accountSize * (state.riskPercentage / 100)
  );

  // Calculate token size based on risk
  const tokenSize = roundToThree(riskAmount / priceMovement);
  const positionValue = roundToThree(tokenSize * entry);
  const initialMargin = roundToThree(positionValue / state.leverage);

  // Calculate stop loss distance and account risk
  const stopLossDistance = roundToThree(
    calculatePercentage(entry, stopLoss, state.isLong)
  );
  const maxLoss = roundToThree(
    state.isLong
      ? tokenSize * (entry - stopLoss)
      : tokenSize * (stopLoss - entry)
  );
  const accountRisk = roundToThree(
    (Math.abs(maxLoss) / state.accountSize) * 100
  );

  // Calculate take profit levels with custom RR and percentages
  const riskAmount2 = Math.abs(maxLoss);
  const tpPercentages = [
    state.tpPercentages.tp1 / 100,
    state.tpPercentages.tp2 / 100,
    state.tpPercentages.tp3 / 100,
    state.tpPercentages.tp4 / 100,
  ];

  const takeProfitLevels = [1, 2, 3, 4].map((multiplier, index) => {
    const profitTarget = roundToThree(
      riskAmount2 * (multiplier * state.targetRR)
    );
    const priceMove = roundToThree(profitTarget / tokenSize);
    const profitPrice = roundToThree(
      state.isLong ? entry + priceMove : entry - priceMove
    );

    const actualProfit = roundToThree(
      state.isLong
        ? (profitPrice - entry) * tokenSize
        : (entry - profitPrice) * tokenSize
    );

    return {
      price: profitPrice,
      profit: Math.abs(actualProfit),
      priceMove: formatNumber(priceMove),
      riskRewardRatio: roundToThree(multiplier * state.targetRR),
      percentageMove: formatNumber(
        (Math.abs(profitPrice - entry) / entry) * 100
      ),
      percentage: tpPercentages[index] * 100,
    };
  });

  // Calculate total potential profit and metrics
  const totalPotentialProfit = roundToThree(
    takeProfitLevels.reduce(
      (sum, level, index) => sum + level.profit * tpPercentages[index],
      0
    )
  );
  const returnOnAccount = roundToThree(
    (totalPotentialProfit / state.accountSize) * 100
  );
  const returnOnRisk = roundToThree(
    (totalPotentialProfit / Math.abs(maxLoss)) * 100
  );
  const averageRR = roundToThree(
    takeProfitLevels.reduce(
      (sum, level, index) => sum + level.riskRewardRatio * tpPercentages[index],
      0
    )
  );

  updateUI({
    tokenSize,
    initialMargin,
    positionValue,
    stopLossDistance,
    maxLoss,
    accountRisk,
    takeProfitLevels,
    totalPotentialProfit,
    returnOnAccount,
    returnOnRisk,
    averageRR,
  });
}

function hideResults() {
  document.getElementById("summaryBox").classList.add("hidden");
  document.getElementById("resultsDisplay").classList.add("hidden");
}

function showResults() {
  document.getElementById("summaryBox").classList.remove("hidden");
  document.getElementById("resultsDisplay").classList.remove("hidden");
}

function updateUI(calculations) {
  showResults();

  // Update Quick Summary Box
  document.querySelector(".position-size").textContent = formatNumber(
    calculations.tokenSize
  );
  document.querySelector(".position-type").textContent = `${
    state.isLong ? "Long" : "Short"
  } ${state.leverage}x`;
  document.querySelector(".max-loss").textContent = `-${formatNumber(
    Math.abs(calculations.maxLoss)
  )} USDT`;
  document.querySelector(".total-profit").textContent = `+${formatNumber(
    calculations.totalPotentialProfit
  )} USDT`;
  document.querySelector(".avg-rr").textContent = formatNumber(
    calculations.averageRR
  );

  // Update Position Details
  document.querySelector(".initial-margin").textContent = `${formatNumber(
    calculations.initialMargin
  )} USDT`;
  document.querySelector(".position-value").textContent = `${formatNumber(
    calculations.positionValue
  )} USDT`;
  document.querySelector(".return-on-account").textContent = `${formatNumber(
    calculations.returnOnAccount
  )}%`;
  document.querySelector(".return-on-risk").textContent = `${formatNumber(
    calculations.returnOnRisk
  )}%`;

  // Update Take Profit Levels
  const tpContainer = document.querySelector(".tp-levels");
  tpContainer.innerHTML = calculations.takeProfitLevels
    .map(
      (level, index) => `
    <div class="flex justify-between bg-gray-50 p-2 rounded">
      <span>TP${index + 1} (${level.percentage}%): ${formatNumber(
        level.price
      )} USDT (${level.percentageMove}%)</span>
      <span>Profit: ${formatNumber(level.profit)} USDT</span>
      <span>R:R ${formatNumber(level.riskRewardRatio)}</span>
    </div>
  `
    )
    .join("");

  // Update Risk Warning
  const warningElement = document.querySelector(".risk-warning");
  if (calculations.accountRisk > state.riskPercentage) {
    warningElement.classList.remove("hidden");
    warningElement.querySelector(
      "p"
    ).textContent = `Warning: Account risk (${formatNumber(
      calculations.accountRisk
    )}%) exceeds target risk (${formatNumber(state.riskPercentage)}%)`;
  } else {
    warningElement.classList.add("hidden");
  }
}

function updateButtonStyles() {
  const longBtn = document.querySelector(".btn-long");
  const shortBtn = document.querySelector(".btn-short");

  if (state.isLong) {
    longBtn.classList.add("bg-green-500", "text-white");
    longBtn.classList.remove("bg-gray-200", "text-gray-700");
    shortBtn.classList.add("bg-gray-200", "text-gray-700");
    shortBtn.classList.remove("bg-red-500", "text-white");
  } else {
    shortBtn.classList.add("bg-red-500", "text-white");
    shortBtn.classList.remove("bg-gray-200", "text-gray-700");
    longBtn.classList.add("bg-gray-200", "text-gray-700");
    longBtn.classList.remove("bg-green-500", "text-white");
  }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  // Account Settings
  document
    .querySelector('input[name="accountSize"]')
    .addEventListener("input", (e) => {
      state.accountSize = parseFloat(e.target.value) || 0;
      calculatePosition();
    });

  document
    .querySelector('input[name="riskPercentage"]')
    .addEventListener("input", (e) => {
      state.riskPercentage = parseFloat(e.target.value) || 0;
      calculatePosition();
    });

  document
    .querySelector('input[name="leverage"]')
    .addEventListener("input", (e) => {
      state.leverage = parseFloat(e.target.value) || 1;
      calculatePosition();
    });

  document
    .querySelector('input[name="targetRR"]')
    .addEventListener("input", (e) => {
      state.targetRR = parseFloat(e.target.value) || 0.1;
      calculatePosition();
    });

  // TP Distribution
  ["tp1", "tp2", "tp3", "tp4"].forEach((tp) => {
    document
      .querySelector(`input[name="${tp}Percentage"]`)
      .addEventListener("input", (e) => {
        state.tpPercentages[tp] = parseFloat(e.target.value) || 0;
        calculatePosition();
      });
  });

  // Long/Short Buttons
  document.querySelector(".btn-long").addEventListener("click", () => {
    state.isLong = true;
    const newStopLoss = calculateStopLoss(
      state.entryPrice,
      state.stopLossPercentage,
      true
    );
    state.stopLoss = newStopLoss;
    document.querySelector('input[name="stopLossPrice"]').value =
      formatNumber(newStopLoss);
    calculatePosition();
    updateButtonStyles();
  });

  document.querySelector(".btn-short").addEventListener("click", () => {
    state.isLong = false;
    const newStopLoss = calculateStopLoss(
      state.entryPrice,
      state.stopLossPercentage,
      false
    );
    state.stopLoss = newStopLoss;
    document.querySelector('input[name="stopLossPrice"]').value =
      formatNumber(newStopLoss);
    calculatePosition();
    updateButtonStyles();
  });

  // Entry Setup
  document
    .querySelector('input[name="entryPrice"]')
    .addEventListener("input", (e) => {
      const newEntry = parseFloat(e.target.value) || 0;
      state.entryPrice = newEntry;
      if (newEntry) {
        const newStopLoss = calculateStopLoss(
          newEntry,
          state.stopLossPercentage,
          state.isLong
        );
        state.stopLoss = newStopLoss;
        document.querySelector('input[name="stopLossPrice"]').value =
          formatNumber(newStopLoss);
      }
      calculatePosition();
    });

  document
    .querySelector('input[name="stopLossPercentage"]')
    .addEventListener("input", (e) => {
      const newPercentage = parseFloat(e.target.value) || 0;
      state.stopLossPercentage = newPercentage;
      if (state.entryPrice) {
        const newStopLoss = calculateStopLoss(
          state.entryPrice,
          newPercentage,
          state.isLong
        );
        state.stopLoss = newStopLoss;
        document.querySelector('input[name="stopLossPrice"]').value =
          formatNumber(newStopLoss);
      }
      calculatePosition();
    });

  document
    .querySelector('input[name="stopLossPrice"]')
    .addEventListener("input", (e) => {
      const newStopLoss = parseFloat(e.target.value) || 0;
      state.stopLoss = newStopLoss;
      if (state.entryPrice && newStopLoss) {
        const newPercentage = calculatePercentage(
          state.entryPrice,
          newStopLoss,
          state.isLong
        );
        state.stopLossPercentage = newPercentage;
        document.querySelector('input[name="stopLossPercentage"]').value =
          formatNumber(newPercentage);
      }
      calculatePosition();
    });
});

// Initialize calculation
calculatePosition();

