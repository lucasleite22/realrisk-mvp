// Scoring engine - calculates derived metrics and tier classification
// Inputs come from data.js (raw property data)
// Outputs feed the UI in app.js

const CLOSING_COSTS_PCT = 0.05;

// Convert raw property to enriched property with all computed fields
function enrichProperty(p, weights = { financial: 0.6, risk: 0.4 }) {
  const pricePerSqft = p.price / p.sqft;
  const closingCosts = p.price * CLOSING_COSTS_PCT;
  const allIn = p.price + p.capexEstimated + closingCosts;
  const profit = p.arvEstimated - allIn;
  const roi = profit / allIn;
  const monthlyHoldingCost = p.hoaMonthly + (p.propertyTaxAnnual / 12);

  // Financial score (0-100) based on ROI
  let financialScore;
  if (roi >= 0.25) financialScore = 100;
  else if (roi >= 0.20) financialScore = 80;
  else if (roi >= 0.15) financialScore = 60;
  else if (roi >= 0.10) financialScore = 40;
  else financialScore = 20;

  // Risk score (0-100) compound from Florida-specific factors
  // Weights calibrated by Jales Castro (criterios-elegibilidade-jales, rev1, 17/Jun)
  let riskScore = 0;

  // Flood zone (max 40 points)
  switch (p.floodZone) {
    case "X": riskScore += 40; break;
    case "A":
    case "AE": riskScore += 24; break;
    case "VE": riskScore += 8; break;
    default: riskScore += 0;
  }

  // Roof age (max 30 points)
  if (p.roofAgeYears <= 5) riskScore += 30;
  else if (p.roofAgeYears <= 10) riskScore += 20;
  else if (p.roofAgeYears <= 15) riskScore += 10;

  // HVAC age (max 20 points)
  if (p.hvacAgeYears <= 5) riskScore += 20;
  else if (p.hvacAgeYears <= 10) riskScore += 10;

  // STR allowed bonus (max 10 points)
  if (p.strAllowed) riskScore += 10;

  // Cap at 100
  riskScore = Math.min(100, riskScore);

  // Composite score using weights
  const totalScore = financialScore * weights.financial + riskScore * weights.risk;

  // Tier classification
  let tier;
  if (totalScore >= 80) tier = 1;
  else if (totalScore >= 60) tier = 2;
  else tier = 3;

  return {
    ...p,
    pricePerSqft,
    closingCosts,
    allIn,
    profit,
    roi,
    monthlyHoldingCost,
    financialScore,
    riskScore,
    totalScore,
    tier
  };
}

// Risk flags for UI badges
function getRiskFlags(p) {
  const flags = [];

  // Flood
  if (p.floodZone === "X") {
    flags.push({ label: "Flood X", level: "ok", icon: "check" });
  } else if (p.floodZone === "AE" || p.floodZone === "A") {
    flags.push({ label: "Flood " + p.floodZone, level: "warn", icon: "alert" });
  } else if (p.floodZone === "VE") {
    flags.push({ label: "Flood VE", level: "bad", icon: "alert" });
  }

  // Roof
  if (p.roofAgeYears <= 5) {
    flags.push({ label: "Roof " + p.roofAgeYears + "a", level: "ok" });
  } else if (p.roofAgeYears <= 12) {
    flags.push({ label: "Roof " + p.roofAgeYears + "a", level: "neutral" });
  } else {
    flags.push({ label: "Roof " + p.roofAgeYears + "a", level: "warn" });
  }

  // HVAC
  if (p.hvacAgeYears <= 7) {
    flags.push({ label: "HVAC " + p.hvacAgeYears + "a", level: "neutral" });
  } else {
    flags.push({ label: "HVAC " + p.hvacAgeYears + "a", level: "warn" });
  }

  // STR
  if (p.strAllowed) {
    flags.push({ label: "STR ok", level: "ok" });
  }

  return flags;
}

// Format helpers
function formatCurrency(n) {
  if (n >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return "$" + Math.round(n / 1000) + "k";
  return "$" + Math.round(n);
}

function formatCurrencyFull(n) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function formatPercent(n, decimals = 1) {
  return (n * 100).toFixed(decimals) + "%";
}
