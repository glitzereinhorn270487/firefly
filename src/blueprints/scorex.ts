/**
 * ScoreX Blueprint - Simplified ScoreX calculation and Policy Engine
 * 
 * This module implements the V1 ScoreX system with Alpha Potential (AP),
 * Confidence Score (KS), Risk Factor (RF) calculations, and sell rules policy engine.
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Token forensics data structure containing all metrics for scoring
 */
export interface TokenForensics {
  /** Gini coefficient for token distribution (0 = equal, 1 = unequal) */
  giniCoefficient: number;
  /** Top 10 holders percentage (0-100) */
  top10HoldersPercent: number;
  /** Social signals strength (0-1) */
  socialSignals: number;
  /** Age of liquidity in hours */
  liquidityAgeHours: number;
  /** Red flag indicators */
  redFlags: string[];
  /** Hard no-go indicators that force exclusion */
  hardNoGo: string[];
  /** Market cap in USD */
  marketCapUsd?: number;
  /** Liquidity in USD */
  liquidityUsd?: number;
}

/**
 * Score components breakdown
 */
export interface ScoreComponents {
  /** Alpha Potential score (0-100) */
  alphaPotential: number;
  /** Confidence Score (0-1) */
  confidenceScore: number;
  /** Risk Factor (0-10000+) */
  riskFactor: number;
  /** Final ScoreX (0-1000) */
  finalScore: number;
}

/**
 * Trading position information
 */
export interface Position {
  /** Position identifier */
  id: string;
  /** Token mint address */
  mint: string;
  /** Entry price in USD */
  entryPrice: number;
  /** Current token amount */
  tokenAmount: number;
  /** Entry timestamp */
  entryTimestamp: number;
  /** Investment category */
  category: 'Insider' | 'Newborn' | 'Momentum' | 'MoonshotShort';
  /** Peak price achieved */
  peakPrice?: number;
  /** Last update timestamp */
  lastUpdateTimestamp?: number;
}

/**
 * On-chain metrics for real-time decision making
 */
export interface OnChainMetrics {
  /** Current volume in USD */
  volumeUsd: number;
  /** Number of unique buyers */
  buyerCount: number;
  /** Number of unique sellers */
  sellerCount: number;
  /** Price change percentage over time window */
  priceChangePercent: number;
  /** Time window in seconds for metrics calculation */
  timeWindowSeconds: number;
  /** Volatility indicator (standard deviation of price movements) */
  volatility?: number;
}

/**
 * Policy preset configuration for sell decisions
 */
export interface PolicyPreset {
  /** Target percentage gain for de-risking */
  deRiskTargetPct: number;
  /** Percentage of position to sell when de-risking */
  deRiskAmountPercent: number;
  /** Trailing stop percentage (negative value) */
  baseTrailingStopPct: number;
  /** Volatility multiplier factor */
  volatilityFactor: number;
  /** Stagnation sensitivity in seconds */
  stagnationSensitivity: number;
}

/**
 * Sell decision output
 */
export interface SellDecision {
  /** Action to take */
  action: 'hold' | 'partial' | 'sell';
  /** Percentage of position to sell (0-1) */
  amountPercent: number;
  /** Reason for the decision */
  reason: string;
}

// =============================================================================
// ALPHA POTENTIAL CALCULATION
// =============================================================================

/**
 * Computes Alpha Potential (AP) score based on token forensics
 * 
 * AP Rules:
 * - Gini coefficient: Lower is better (more equal distribution)
 * - Top 10 holders: Lower percentage is better
 * - Social signals: Higher is better
 * 
 * @param forensics Token forensics data
 * @returns Alpha Potential score (0-100)
 */
export function computeAlphaPotential(forensics: TokenForensics): number {
  // Weights for different components
  const GINI_WEIGHT = 0.3;
  const TOP10_WEIGHT = 0.4;
  const SOCIAL_WEIGHT = 0.3;
  
  // Gini score: Lower Gini is better (invert for scoring)
  const giniScore = Math.max(0, 100 - (forensics.giniCoefficient * 100));
  
  // Top 10 holders score: Lower percentage is better (invert for scoring)  
  const top10Score = Math.max(0, 100 - forensics.top10HoldersPercent);
  
  // Social signals score: Higher is better (direct mapping)
  const socialScore = forensics.socialSignals * 100;
  
  // Weighted combination
  const baseAP = (giniScore * GINI_WEIGHT) + (top10Score * TOP10_WEIGHT) + (socialScore * SOCIAL_WEIGHT);
  
  // Social boost: If social signals > 0.7, apply 1.2x multiplier
  const socialBoost = forensics.socialSignals > 0.7 ? 1.2 : 1.0;
  
  // Distribution boost: If both Gini < 0.3 and Top10 < 20%, apply 1.15x multiplier
  const distributionBoost = (forensics.giniCoefficient < 0.3 && forensics.top10HoldersPercent < 20) ? 1.15 : 1.0;
  
  const finalAP = baseAP * socialBoost * distributionBoost;
  
  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, finalAP));
}

// =============================================================================
// CONFIDENCE SCORE CALCULATION
// =============================================================================

/**
 * Computes Confidence Score (KS) from social and market confidence
 * 
 * @param socialConfidence Social confidence level (0-1)
 * @param marketConfidence Market confidence level (0-1)  
 * @returns Confidence Score (0-1)
 */
export function computeConfidenceScore(socialConfidence: number, marketConfidence: number): number {
  // Geometric mean of the two confidence scores
  const ks = Math.sqrt(socialConfidence * marketConfidence);
  
  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, ks));
}

// =============================================================================
// RISK FACTOR CALCULATION
// =============================================================================

/**
 * Computes Risk Factor (RF) including liquidity age malus and red-flag checks
 * 
 * @param forensics Token forensics data
 * @returns Risk Factor (0-10000+, where >=10000 forces exclusion)
 */
export function computeRiskFactor(forensics: TokenForensics): number {
  // Base risk factor
  let riskFactor = 0;
  
  // Hard no-go checks - return high value to force exclusion
  if (forensics.hardNoGo && forensics.hardNoGo.length > 0) {
    return 10000 + (forensics.hardNoGo.length * 1000);
  }
  
  // Red flag penalties (10 points per red flag, max 500)
  if (forensics.redFlags && forensics.redFlags.length > 0) {
    riskFactor += Math.min(forensics.redFlags.length * 10, 500);
  }
  
  // Liquidity age malus - newer liquidity is riskier
  if (forensics.liquidityAgeHours < 24) {
    // Linear penalty: 0 hours = +200 RF, 24 hours = +0 RF
    const ageMalus = 200 * (1 - (forensics.liquidityAgeHours / 24));
    riskFactor += Math.max(0, ageMalus);
  }
  
  // Market cap risk - very low market cap is riskier
  if (forensics.marketCapUsd && forensics.marketCapUsd < 100000) {
    // Add risk for very small market caps
    const mcMalus = 100 * (1 - (forensics.marketCapUsd / 100000));
    riskFactor += Math.max(0, mcMalus);
  }
  
  // Liquidity risk - very low liquidity is riskier  
  if (forensics.liquidityUsd && forensics.liquidityUsd < 10000) {
    // Add risk for very low liquidity
    const liquidityMalus = 150 * (1 - (forensics.liquidityUsd / 10000));
    riskFactor += Math.max(0, liquidityMalus);
  }
  
  return Math.max(0, riskFactor);
}

// =============================================================================
// FINAL SCORE CALCULATION
// =============================================================================

/**
 * Computes the final ScoreX using the formula: clamp((AP * KS) - RF, 0, 1000)
 * 
 * @param ap Alpha Potential (0-100)
 * @param ks Confidence Score (0-1)
 * @param rf Risk Factor (0-10000+)
 * @returns Final ScoreX (0-1000)
 */
export function computeFinalScore(ap: number, ks: number, rf: number): number {
  // If risk factor indicates hard no-go, return 0
  if (rf >= 10000) {
    return 0;
  }
  
  // Calculate raw score: (AP * KS) - RF
  const rawScore = (ap * ks) - rf;
  
  // Clamp to 0-1000 range
  return Math.max(0, Math.min(1000, rawScore));
}

// =============================================================================
// CATEGORY MULTIPLIERS
// =============================================================================

/**
 * Returns the investment size multiplier for a given category
 * 
 * @param categoryName Investment category name
 * @returns Multiplier value
 */
export function categoryMultiplier(categoryName: string): number {
  const multipliers: Record<string, number> = {
    'Insider': 1.25,
    'Newborn': 1.0,
    'Momentum': 0.75,
    'MoonshotShort': 1.0
  };
  
  return multipliers[categoryName] || 1.0;
}

// =============================================================================
// INVESTMENT SIZE CALCULATION
// =============================================================================

/**
 * Computes investment size based on global capital, final score, and category
 * 
 * Formula: Basis-Einsatz = max(globalCapital * 0.02, floorUsd||2) * multiplier * (finalScore/1000)
 * 
 * @param globalCapitalUsd Total available capital in USD
 * @param finalScore Final ScoreX (0-1000)
 * @param category Investment category
 * @param floorUsd Minimum investment floor (default: 2)
 * @returns Investment amount in USD, rounded to 2 decimals
 */
export function computeInvestmentSize(
  globalCapitalUsd: number,
  finalScore: number,
  category: string,
  floorUsd: number = 2
): number {
  // Base investment calculation
  const baseInvestment = Math.max(globalCapitalUsd * 0.02, floorUsd);
  
  // Apply category multiplier
  const multiplier = categoryMultiplier(category);
  const adjustedInvestment = baseInvestment * multiplier;
  
  // Apply score factor (finalScore/1000)
  const scoreFactor = finalScore / 1000;
  const finalInvestment = adjustedInvestment * scoreFactor;
  
  // Round to 2 decimal places
  return Math.round(finalInvestment * 100) / 100;
}

// =============================================================================
// POLICY ENGINE - SELL RULES
// =============================================================================

/**
 * Checks sell rules based on position, current price, metrics, and policy preset
 * 
 * Implements three policies:
 * - Quick-Scalp: Fast gains with tight stops
 * - MomentumRide: Medium-term momentum following  
 * - VolatilityRide: Long-term volatility riding
 * 
 * @param position Current position information
 * @param currentPrice Current token price in USD
 * @param onChainMetrics Current on-chain metrics
 * @param policy Policy preset configuration
 * @returns Sell decision with action, amount, and reason
 */
export function checkSellRules(
  position: Position,
  currentPrice: number,
  onChainMetrics: OnChainMetrics,
  policy: PolicyPreset
): SellDecision {
  // Calculate current gain/loss percentage
  const gainPercent = (currentPrice - position.entryPrice) / position.entryPrice;
  
  // Update peak price tracking
  const currentPeak = Math.max(position.peakPrice || position.entryPrice, currentPrice);
  const peakDrawdown = (currentPrice - currentPeak) / currentPeak;
  
  // Time since entry in seconds
  const timeSinceEntry = (Date.now() - position.entryTimestamp) / 1000;
  
  // Time since last significant activity
  const timeSinceUpdate = position.lastUpdateTimestamp 
    ? (Date.now() - position.lastUpdateTimestamp) / 1000
    : timeSinceEntry;
  
  // Check for immediate de-risk conditions
  if (gainPercent >= policy.deRiskTargetPct) {
    return {
      action: 'partial',
      amountPercent: policy.deRiskAmountPercent,
      reason: `De-risk: ${(gainPercent * 100).toFixed(1)}% gain reached target of ${(policy.deRiskTargetPct * 100).toFixed(1)}%`
    };
  }
  
  // Check trailing stop with volatility adjustment
  const adjustedTrailingStop = policy.baseTrailingStopPct * (1 + (onChainMetrics.volatility || 0) * policy.volatilityFactor);
  if (peakDrawdown <= adjustedTrailingStop) {
    return {
      action: 'sell',
      amountPercent: 1.0,
      reason: `Trailing stop triggered: ${(peakDrawdown * 100).toFixed(1)}% drawdown from peak (limit: ${(adjustedTrailingStop * 100).toFixed(1)}%)`
    };
  }
  
  // Check stagnation conditions
  if (timeSinceUpdate > policy.stagnationSensitivity) {
    // Check if volume is declining significantly
    const volumeThreshold = 1000; // USD threshold for meaningful volume
    if (onChainMetrics.volumeUsd < volumeThreshold) {
      return {
        action: 'sell',
        amountPercent: 1.0,
        reason: `Stagnation detected: ${Math.floor(timeSinceUpdate)}s since last activity, low volume ${onChainMetrics.volumeUsd.toFixed(0)} USD`
      };
    }
    
    // Check for negative price action during stagnation
    if (onChainMetrics.priceChangePercent < -0.05) { // -5% price change
      return {
        action: 'partial',
        amountPercent: 0.5,
        reason: `Stagnation with negative momentum: ${(onChainMetrics.priceChangePercent * 100).toFixed(1)}% price change`
      };
    }
  }
  
  // Check seller pressure
  if (onChainMetrics.sellerCount > 0 && onChainMetrics.buyerCount > 0) {
    const sellerBuyerRatio = onChainMetrics.sellerCount / onChainMetrics.buyerCount;
    if (sellerBuyerRatio > 2.0) {
      return {
        action: 'partial',
        amountPercent: 0.3,
        reason: `High seller pressure: ${sellerBuyerRatio.toFixed(1)} seller/buyer ratio`
      };
    }
  }
  
  // Default: hold position
  return {
    action: 'hold',
    amountPercent: 0,
    reason: 'All conditions met for holding position'
  };
}

// =============================================================================
// DEFAULT POLICY PRESETS
// =============================================================================

/**
 * Quick-Scalp policy: Fast gains with tight risk management
 */
export const QUICK_SCALP: PolicyPreset = {
  deRiskTargetPct: 0.25,        // 25% gain triggers de-risk
  deRiskAmountPercent: 0.5,     // Sell 50% of position
  baseTrailingStopPct: -0.15,   // 15% trailing stop
  volatilityFactor: 1.5,        // Moderate volatility adjustment
  stagnationSensitivity: 300    // 5 minutes stagnation tolerance
};

/**
 * Momentum-Ride policy: Medium-term momentum following
 */
export const MOMENTUM_RIDE: PolicyPreset = {
  deRiskTargetPct: 0.5,         // 50% gain triggers de-risk
  deRiskAmountPercent: 0.3,     // Sell 30% of position
  baseTrailingStopPct: -0.25,   // 25% trailing stop
  volatilityFactor: 2.0,        // Higher volatility tolerance
  stagnationSensitivity: 600    // 10 minutes stagnation tolerance
};

/**
 * Volatility-Ride policy: Long-term volatility riding
 */
export const VOLATILITY_RIDE: PolicyPreset = {
  deRiskTargetPct: 1.0,         // 100% gain triggers de-risk
  deRiskAmountPercent: 0.25,    // Sell 25% of position
  baseTrailingStopPct: -0.35,   // 35% trailing stop
  volatilityFactor: 3.0,        // High volatility tolerance
  stagnationSensitivity: 900    // 15 minutes stagnation tolerance
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Computes a complete ScoreX analysis for a token
 * 
 * @param forensics Token forensics data
 * @param socialConfidence Social confidence level (0-1)
 * @param marketConfidence Market confidence level (0-1)
 * @returns Complete score components breakdown
 */
export function computeCompleteScore(
  forensics: TokenForensics,
  socialConfidence: number,
  marketConfidence: number
): ScoreComponents {
  const alphaPotential = computeAlphaPotential(forensics);
  const confidenceScore = computeConfidenceScore(socialConfidence, marketConfidence);
  const riskFactor = computeRiskFactor(forensics);
  const finalScore = computeFinalScore(alphaPotential, confidenceScore, riskFactor);
  
  return {
    alphaPotential,
    confidenceScore,
    riskFactor,
    finalScore
  };
}

/**
 * Creates a sample TokenForensics object for testing
 * 
 * @returns Sample forensics data
 */
export function createSampleForensics(): TokenForensics {
  return {
    giniCoefficient: 0.4,
    top10HoldersPercent: 25,
    socialSignals: 0.6,
    liquidityAgeHours: 12,
    redFlags: ['low_volume'],
    hardNoGo: [],
    marketCapUsd: 500000,
    liquidityUsd: 50000
  };
}

/**
 * Creates a sample Position object for testing
 * 
 * @returns Sample position data
 */
export function createSamplePosition(): Position {
  return {
    id: 'pos_123',
    mint: 'So11111111111111111111111111111111111111112',
    entryPrice: 100.0,
    tokenAmount: 1000,
    entryTimestamp: Date.now() - 600000, // 10 minutes ago
    category: 'Momentum',
    peakPrice: 120.0,
    lastUpdateTimestamp: Date.now() - 60000 // 1 minute ago
  };
}

/**
 * Creates sample OnChainMetrics for testing
 * 
 * @returns Sample metrics data
 */
export function createSampleMetrics(): OnChainMetrics {
  return {
    volumeUsd: 50000,
    buyerCount: 25,
    sellerCount: 10,
    priceChangePercent: 0.05,
    timeWindowSeconds: 300,
    volatility: 0.1
  };
}