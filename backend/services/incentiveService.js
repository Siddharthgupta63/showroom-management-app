// backend/services/incentiveService.js

// HSRP incentive slab
function calculateHsrpIncentive(amountPaid) {
  const a = parseFloat(amountPaid || 0);
  if (isNaN(a)) return 0;
  if (a >= 130 && a <= 150) return 20;
  if (a < 130) return 10;
  // If >150 you can decide default; return 20 as max
  if (a > 150) return 20;
  return 0;
}

// Process completion incentive: Rs 10 per completed sale
function calculateProcessIncentive() {
  return 10;
}

module.exports = { calculateHsrpIncentive, calculateProcessIncentive };
