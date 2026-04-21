import { Text } from '@mantine/core';
import { ReactNode } from 'react';
import {
  ActivityLogRow,
  Algorithm,
  AlgorithmDataRow,
  AlgorithmSummary,
  CompressedAlgorithmDataRow,
  CompressedListing,
  CompressedObservations,
  CompressedOrder,
  CompressedOrderDepth,
  CompressedTrade,
  CompressedTradingState,
  ConversionObservation,
  Listing,
  Observation,
  Order,
  OrderDepth,
  Product,
  ProsperitySymbol,
  ResultLog,
  ResultLogTradeHistoryItem,
  Trade,
  TradingState,
} from '../models.ts';
import { authenticatedAxios } from './axios.ts';

export class AlgorithmParseError extends Error {
  public constructor(public readonly node: ReactNode) {
    super('Failed to parse algorithm logs');
  }
}

function getColumnValues(columns: string[], indices: number[]): number[] {
  const values: number[] = [];

  for (const index of indices) {
    const value = columns[index];
    if (value !== '') {
      values.push(parseFloat(value));
    }
  }

  return values;
}

// Parse activity log rows from a CSV string (P4 format: has a named header row on line 0)
function parseActivityLogCsv(csv: string): ActivityLogRow[] {
  const lines = csv.split('\n');
  const rows: ActivityLogRow[] = [];

  // Skip line 0 if it's the named header (starts with "day")
  const startIdx = lines[0].startsWith('day') ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') break;

    const columns = line.split(';');
    rows.push({
      day: Number(columns[0]),
      timestamp: Number(columns[1]),
      product: columns[2],
      bidPrices: getColumnValues(columns, [3, 5, 7]),
      bidVolumes: getColumnValues(columns, [4, 6, 8]),
      askPrices: getColumnValues(columns, [9, 11, 13]),
      askVolumes: getColumnValues(columns, [10, 12, 14]),
      midPrice: Number(columns[15]),
      profitLoss: Number(columns[16]),
    });
  }

  return rows;
}

// Parse activity log rows from backtest text log (finds "Activities log:" section)
function getActivityLogs(logLines: string[]): ActivityLogRow[] {
  const headerIndex = logLines.indexOf('Activities log:');
  if (headerIndex === -1) {
    return [];
  }

  // Join remaining lines and pass to CSV parser (handles optional named header row)
  const csv = logLines.slice(headerIndex + 1).join('\n');
  return parseActivityLogCsv(csv);
}

function decompressListings(compressed: CompressedListing[]): Record<ProsperitySymbol, Listing> {
  const listings: Record<ProsperitySymbol, Listing> = {};

  for (const [symbol, product, denomination] of compressed) {
    listings[symbol] = {
      symbol,
      product,
      denomination,
    };
  }

  return listings;
}

function decompressOrderDepths(
  compressed: Record<ProsperitySymbol, CompressedOrderDepth>,
): Record<ProsperitySymbol, OrderDepth> {
  const orderDepths: Record<ProsperitySymbol, OrderDepth> = {};

  for (const [symbol, [buyOrders, sellOrders]] of Object.entries(compressed)) {
    orderDepths[symbol] = {
      buyOrders,
      sellOrders,
    };
  }

  return orderDepths;
}

function decompressTrades(compressed: CompressedTrade[]): Record<ProsperitySymbol, Trade[]> {
  const trades: Record<ProsperitySymbol, Trade[]> = {};

  for (const [symbol, price, quantity, buyer, seller, timestamp] of compressed) {
    if (trades[symbol] === undefined) {
      trades[symbol] = [];
    }

    trades[symbol].push({
      symbol,
      price,
      quantity,
      buyer,
      seller,
      timestamp,
    });
  }

  return trades;
}

function decompressObservations(compressed: CompressedObservations): Observation {
  const conversionObservations: Record<Product, ConversionObservation> = {};

  for (const [
    product,
    [bidPrice, askPrice, transportFees, exportTariff, importTariff, sugarPrice, sunlightIndex],
  ] of Object.entries(compressed[1])) {
    conversionObservations[product] = {
      bidPrice,
      askPrice,
      transportFees,
      exportTariff,
      importTariff,
      sugarPrice,
      sunlightIndex,
    };
  }

  return {
    plainValueObservations: compressed[0],
    conversionObservations,
  };
}

function decompressState(compressed: CompressedTradingState): TradingState {
  return {
    timestamp: compressed[0],
    traderData: compressed[1],
    listings: decompressListings(compressed[2]),
    orderDepths: decompressOrderDepths(compressed[3]),
    ownTrades: decompressTrades(compressed[4]),
    marketTrades: decompressTrades(compressed[5]),
    position: compressed[6],
    observations: decompressObservations(compressed[7]),
  };
}

function decompressOrders(compressed: CompressedOrder[]): Record<ProsperitySymbol, Order[]> {
  const orders: Record<ProsperitySymbol, Order[]> = {};

  for (const [symbol, price, quantity] of compressed) {
    if (orders[symbol] === undefined) {
      orders[symbol] = [];
    }

    orders[symbol].push({
      symbol,
      price,
      quantity,
    });
  }

  return orders;
}

function decompressDataRow(compressed: CompressedAlgorithmDataRow, sandboxLogs: string): AlgorithmDataRow {
  return {
    state: decompressState(compressed[0]),
    orders: decompressOrders(compressed[1]),
    conversions: compressed[2],
    traderData: compressed[3],
    algorithmLogs: compressed[4],
    sandboxLogs,
  };
}

// Parse compressed TradingState data from a backtest text log (the "Sandbox logs:" section).
// In P4, lambdaLog is usually plain trader stdout — we silently skip non-JSON entries.
function getAlgorithmData(logLines: string[]): AlgorithmDataRow[] {
  const headerIndex = logLines.indexOf('Sandbox logs:');
  if (headerIndex === -1) {
    return [];
  }

  const rows: AlgorithmDataRow[] = [];
  let nextSandboxLogs = '';

  const sandboxLogPrefix = '  "sandboxLog": ';
  const lambdaLogPrefix = '  "lambdaLog": ';

  for (let i = headerIndex + 1; i < logLines.length; i++) {
    const line = logLines[i];
    if (line.endsWith(':')) {
      break;
    }

    if (line.startsWith(sandboxLogPrefix)) {
      nextSandboxLogs = JSON.parse(line.substring(sandboxLogPrefix.length, line.length - 1)).trim();

      if (nextSandboxLogs.startsWith('Conversion request')) {
        const lastRow = rows[rows.length - 1];
        lastRow.sandboxLogs += (lastRow.sandboxLogs.length > 0 ? '\n' : '') + nextSandboxLogs;
        nextSandboxLogs = '';
      }

      continue;
    }

    if (!line.startsWith(lambdaLogPrefix) || line === '  "lambdaLog": "",') {
      continue;
    }

    const start = line.indexOf('[[');
    const end = line.lastIndexOf(']') + 1;
    if (start === -1) continue; // plain text lambdaLog — skip gracefully

    try {
      const compressedDataRow = JSON.parse(JSON.parse('"' + line.substring(start, end) + '"'));
      rows.push(decompressDataRow(compressedDataRow, nextSandboxLogs));
    } catch (err) {
      console.warn('Skipping unparseable lambdaLog line:', line, err);
    }
  }

  return rows;
}

// Parse compressed TradingState data from a server run ResultLog.
// lambdaLog in P4 is usually plain trader stdout — silently skip non-JSON entries.
function getAlgorithmDataFromResultLog(resultLog: ResultLog): AlgorithmDataRow[] {
  const rows: AlgorithmDataRow[] = [];

  for (const lg of resultLog.logs) {
    const lambdaLog = lg.lambdaLog.trim();
    if (lambdaLog === '' || !lambdaLog.startsWith('[[')) {
      continue; // plain text trader output — skip
    }

    try {
      const compressedDataRow = JSON.parse(lambdaLog);
      rows.push(decompressDataRow(compressedDataRow, lg.sandboxLog));
    } catch (err) {
      console.warn('Skipping unparseable lambdaLog:', lambdaLog, err);
    }
  }

  return rows;
}

export function parseAlgorithmLogs(input: string, summary?: AlgorithmSummary): Algorithm {
  let activityLogs: ActivityLogRow[];
  let data: AlgorithmDataRow[];
  let tradeHistory: ResultLogTradeHistoryItem[] = [];

  // Auto-detect: if the input is JSON it's a server run log; otherwise it's a backtest text log
  let resultLog: ResultLog | null = null;
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === 'object' && 'activitiesLog' in parsed) {
      resultLog = parsed as ResultLog;
    }
  } catch {
    // not JSON — treat as backtest text log
  }

  if (resultLog !== null) {
    activityLogs = parseActivityLogCsv(resultLog.activitiesLog);
    data = getAlgorithmDataFromResultLog(resultLog);
    tradeHistory = resultLog.tradeHistory ?? [];
  } else {
    const logLines = input.trim().split(/\r?\n/);
    activityLogs = getActivityLogs(logLines);
    data = getAlgorithmData(logLines);
  }

  if (activityLogs.length === 0) {
    throw new AlgorithmParseError(
      <Text>
        Logs are empty or in an unrecognised format. Make sure you&apos;re uploading a Prosperity 4 server run log
        (JSON) or a prosperity4btest backtest log.
      </Text>,
    );
  }

  return {
    summary,
    activityLogs,
    data,
    tradeHistory,
  };
}

export async function getAlgorithmLogsUrl(algorithmId: string): Promise<string> {
  const urlResponse = await authenticatedAxios.get(
    `https://bz97lt8b1e.execute-api.eu-west-1.amazonaws.com/prod/submission/logs/${algorithmId}`,
  );

  return urlResponse.data;
}

function downloadFile(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = new URL(url).pathname.split('/').pop()!;
  link.target = '_blank';
  link.rel = 'noreferrer';

  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function downloadAlgorithmLogs(algorithmId: string): Promise<void> {
  const logsUrl = await getAlgorithmLogsUrl(algorithmId);
  downloadFile(logsUrl);
}

export async function downloadAlgorithmResults(algorithmId: string): Promise<void> {
  const detailsResponse = await authenticatedAxios.get(
    `https://bz97lt8b1e.execute-api.eu-west-1.amazonaws.com/prod/results/tutorial/${algorithmId}`,
  );

  downloadFile(detailsResponse.data.algo.summary.activitiesLog);
}
