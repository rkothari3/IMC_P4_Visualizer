import Highcharts from 'highcharts';
import { ReactNode } from 'react';
import { Algorithm, ProsperitySymbol, ResultLogTradeHistoryItem } from '../../models.ts';
import { useStore } from '../../store.ts';
import { Chart } from './Chart.tsx';

// P4 Round 0 products and their position limits
const KNOWN_LIMITS: Record<string, number> = {
  EMERALDS: 80,
  TOMATOES: 80,
};

function getLimit(algorithm: Algorithm, symbol: ProsperitySymbol): number {
  if (KNOWN_LIMITS[symbol] !== undefined) {
    return KNOWN_LIMITS[symbol];
  }

  // Fallback: estimate from observed positions in compressed state data (if available)
  if (algorithm.data.length > 0) {
    const positions = algorithm.data.map(row => row.state.position[symbol] || 0);
    const minPosition = Math.min(...positions);
    const maxPosition = Math.max(...positions);
    return Math.max(Math.abs(minPosition), maxPosition, 1);
  }

  // Fallback: estimate from trade history net position
  if (algorithm.tradeHistory.length > 0) {
    let net = 0;
    let maxAbsNet = 1;
    for (const trade of algorithm.tradeHistory) {
      if (trade.symbol !== symbol) continue;
      if (trade.buyer.includes('SUBMISSION')) net += trade.quantity;
      else if (trade.seller.includes('SUBMISSION')) net -= trade.quantity;
      maxAbsNet = Math.max(maxAbsNet, Math.abs(net));
    }
    return maxAbsNet;
  }

  return 80; // default guess
}

// Build position-over-time from tradeHistory (for server runs without compressed state)
function buildPositionFromTrades(
  tradeHistory: ResultLogTradeHistoryItem[],
  symbols: string[],
  limits: Record<string, number>,
): Record<string, [number, number][]> {
  const positions: Record<string, number> = {};
  const result: Record<string, [number, number][]> = {};

  for (const symbol of symbols) {
    positions[symbol] = 0;
    result[symbol] = [];
  }

  const sorted = [...tradeHistory].sort((a, b) => a.timestamp - b.timestamp);

  for (const trade of sorted) {
    if (!symbols.includes(trade.symbol)) continue;

    if (trade.buyer.includes('SUBMISSION')) {
      positions[trade.symbol] += trade.quantity;
    } else if (trade.seller.includes('SUBMISSION')) {
      positions[trade.symbol] -= trade.quantity;
    }

    const limit = limits[trade.symbol] || 1;
    result[trade.symbol].push([trade.timestamp, (positions[trade.symbol] / limit) * 100]);
  }

  return result;
}

export interface PositionChartProps {
  symbols: string[];
}

export function PositionChart({ symbols }: PositionChartProps): ReactNode {
  const algorithm = useStore(state => state.algorithm)!;

  const limits: Record<string, number> = {};
  for (const symbol of symbols) {
    limits[symbol] = getLimit(algorithm, symbol);
  }

  let data: Record<string, [number, number][]>;

  if (algorithm.data.length > 0) {
    // Preferred path: use compressed TradingState positions (exact)
    data = {};
    for (const symbol of symbols) {
      data[symbol] = [];
    }
    for (const row of algorithm.data) {
      for (const symbol of symbols) {
        const position = row.state.position[symbol] || 0;
        data[symbol].push([row.state.timestamp, (position / limits[symbol]) * 100]);
      }
    }
  } else if (algorithm.tradeHistory.length > 0) {
    // Fallback: reconstruct positions by accumulating trade fills
    data = buildPositionFromTrades(algorithm.tradeHistory, symbols, limits);
  } else {
    // No position data available — return empty chart
    data = {};
    for (const symbol of symbols) {
      data[symbol] = [];
    }
  }

  const series: Highcharts.SeriesOptionsType[] = symbols.map((symbol, i) => ({
    type: 'line',
    name: symbol,
    data: data[symbol],
    // Offset by 1 so colors align with ProfitLossChart (Total is always color 0)
    colorIndex: (i + 1) % 10,
  }));

  return <Chart title="Positions (% of limit)" series={series} min={-100} max={100} />;
}
