import { Center, Container, Grid, Title } from '@mantine/core';
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store.ts';
import { formatNumber } from '../../utils/format.ts';
import { AlgorithmSummaryCard } from './AlgorithmSummaryCard.tsx';
import { CandlestickChart } from './CandlestickChart.tsx';
import { ConversionPriceChart } from './ConversionPriceChart.tsx';
import { EnvironmentChart } from './EnvironmentChart.tsx';
import { OrdersChart } from './OrdersChart.tsx';
import { PlainValueObservationChart } from './PlainValueObservationChart.tsx';
import { PositionChart } from './PositionChart.tsx';
import { ProfitLossChart } from './ProfitLossChart.tsx';
import { TimestampsCard } from './TimestampsCard.tsx';
import { TransportChart } from './TransportChart.tsx';
import { VisualizerCard } from './VisualizerCard.tsx';

export function VisualizerPage(): ReactNode {
  const algorithm = useStore(state => state.algorithm);

  const { search } = useLocation();

  if (algorithm === null) {
    return <Navigate to={`/${search}`} />;
  }

  // Compute final P&L by summing the last timestamp across all products
  let profitLoss = 0;
  const lastTimestamp = algorithm.activityLogs[algorithm.activityLogs.length - 1].timestamp;
  for (let i = algorithm.activityLogs.length - 1; i >= 0 && algorithm.activityLogs[i].timestamp === lastTimestamp; i--) {
    profitLoss += algorithm.activityLogs[i].profitLoss;
  }

  // Derive symbols from activityLogs (always available in P4, even without compressed state)
  const symbols = new Set<string>();
  for (const row of algorithm.activityLogs) {
    symbols.add(row.product);
  }

  // Conversion products and plain-value observation symbols require compressed state
  const conversionProducts = new Set<string>();
  const plainValueObservationSymbols = new Set<string>();
  for (let i = 0; i < algorithm.data.length; i += 1000) {
    const row = algorithm.data[i];
    for (const key of Object.keys(row.state.observations.conversionObservations)) {
      conversionProducts.add(key);
    }
    for (const key of Object.keys(row.state.observations.plainValueObservations)) {
      plainValueObservationSymbols.add(key);
    }
  }

  const sortedSymbols = [...symbols].sort((a, b) => a.localeCompare(b));
  const sortedPlainValueObservationSymbols = [...plainValueObservationSymbols].sort((a, b) => a.localeCompare(b));

  const symbolColumns: ReactNode[] = [];
  sortedSymbols.forEach(symbol => {
    // CandlestickChart: movement/price/volume toggle — works from activityLogs alone
    symbolColumns.push(
      <Grid.Col key={`${symbol} - candlestick`} span={{ xs: 12, sm: 6 }}>
        <CandlestickChart symbol={symbol} />
      </Grid.Col>,
    );

    // OrdersChart: price + fill markers from tradeHistory — works from activityLogs + tradeHistory
    symbolColumns.push(
      <Grid.Col key={`${symbol} - orders`} span={{ xs: 12, sm: 6 }}>
        <OrdersChart symbol={symbol} />
      </Grid.Col>,
    );

    // Conversion charts only available when compressed TradingState was logged
    if (!conversionProducts.has(symbol)) {
      return;
    }

    symbolColumns.push(
      <Grid.Col key={`${symbol} - conversion price`} span={{ xs: 12, sm: 6 }}>
        <ConversionPriceChart symbol={symbol} />
      </Grid.Col>,
    );

    symbolColumns.push(
      <Grid.Col key={`${symbol} - transport`} span={{ xs: 12, sm: 6 }}>
        <TransportChart symbol={symbol} />
      </Grid.Col>,
    );

    symbolColumns.push(
      <Grid.Col key={`${symbol} - environment`} span={{ xs: 12, sm: 6 }}>
        <EnvironmentChart symbol={symbol} />
      </Grid.Col>,
    );

    symbolColumns.push(<Grid.Col key={`${symbol} - spacer`} span={{ xs: 12, sm: 6 }} />);
  });

  sortedPlainValueObservationSymbols.forEach(symbol => {
    symbolColumns.push(
      <Grid.Col key={`${symbol} - plain value observation`} span={{ xs: 12, sm: 6 }}>
        <PlainValueObservationChart symbol={symbol} />
      </Grid.Col>,
    );
  });

  return (
    <Container fluid>
      <Grid>
        <Grid.Col span={12}>
          <VisualizerCard>
            <Center>
              <Title order={2}>Final Profit / Loss: {formatNumber(profitLoss)}</Title>
            </Center>
          </VisualizerCard>
        </Grid.Col>
        <Grid.Col span={{ xs: 12, sm: 6 }}>
          <ProfitLossChart symbols={sortedSymbols} />
        </Grid.Col>
        <Grid.Col span={{ xs: 12, sm: 6 }}>
          <PositionChart symbols={sortedSymbols} />
        </Grid.Col>
        {symbolColumns}
        {/* Timestamp detail view requires compressed TradingState — only shown when available */}
        {algorithm.data.length > 0 && (
          <Grid.Col span={12}>
            <TimestampsCard />
          </Grid.Col>
        )}
        {algorithm.summary && (
          <Grid.Col span={12}>
            <AlgorithmSummaryCard />
          </Grid.Col>
        )}
      </Grid>
    </Container>
  );
}
