import { Anchor, Code, Container, List, Stack, Text, Title } from '@mantine/core';
import { ReactNode } from 'react';
import { ScrollableCodeHighlight } from '../../components/ScrollableCodeHighlight.tsx';
import { HomeCard } from './HomeCard.tsx';
import { LoadFromFile } from './LoadFromFile.tsx';
// import { LoadFromProsperity } from './LoadFromProsperity.tsx';
// import { LoadFromUrl } from './LoadFromUrl.tsx';

const optionalLoggerCode = `
import json
from typing import Any

from datamodel import Listing, Observation, Order, OrderDepth, ProsperityEncoder, Symbol, Trade, TradingState


class Logger:
    def __init__(self) -> None:
        self.logs = ""
        self.max_log_length = 3750

    def print(self, *objects: Any, sep: str = " ", end: str = "\\n") -> None:
        self.logs += sep.join(map(str, objects)) + end

    def flush(self, state: TradingState, orders: dict[Symbol, list[Order]], conversions: int, trader_data: str) -> None:
        base_length = len(
            self.to_json(
                [
                    self.compress_state(state, ""),
                    self.compress_orders(orders),
                    conversions,
                    "",
                    "",
                ]
            )
        )

        max_item_length = (self.max_log_length - base_length) // 3

        print(
            self.to_json(
                [
                    self.compress_state(state, self.truncate(state.traderData, max_item_length)),
                    self.compress_orders(orders),
                    conversions,
                    self.truncate(trader_data, max_item_length),
                    self.truncate(self.logs, max_item_length),
                ]
            )
        )

        self.logs = ""

    def compress_state(self, state: TradingState, trader_data: str) -> list[Any]:
        return [
            state.timestamp,
            trader_data,
            self.compress_listings(state.listings),
            self.compress_order_depths(state.order_depths),
            self.compress_trades(state.own_trades),
            self.compress_trades(state.market_trades),
            state.position,
            self.compress_observations(state.observations),
        ]

    def compress_listings(self, listings: dict[Symbol, Listing]) -> list[list[Any]]:
        compressed = []
        for listing in listings.values():
            compressed.append([listing.symbol, listing.product, listing.denomination])
        return compressed

    def compress_order_depths(self, order_depths: dict[Symbol, OrderDepth]) -> dict[Symbol, list[Any]]:
        compressed = {}
        for symbol, order_depth in order_depths.items():
            compressed[symbol] = [order_depth.buy_orders, order_depth.sell_orders]
        return compressed

    def compress_trades(self, trades: dict[Symbol, list[Trade]]) -> list[list[Any]]:
        compressed = []
        for arr in trades.values():
            for trade in arr:
                compressed.append([trade.symbol, trade.price, trade.quantity, trade.buyer, trade.seller, trade.timestamp])
        return compressed

    def compress_observations(self, observations: Observation) -> list[Any]:
        conversion_observations = {}
        for product, observation in observations.conversionObservations.items():
            conversion_observations[product] = [
                observation.bidPrice,
                observation.askPrice,
                observation.transportFees,
                observation.exportTariff,
                observation.importTariff,
            ]
        return [observations.plainValueObservations, conversion_observations]

    def compress_orders(self, orders: dict[Symbol, list[Order]]) -> list[list[Any]]:
        compressed = []
        for arr in orders.values():
            for order in arr:
                compressed.append([order.symbol, order.price, order.quantity])
        return compressed

    def to_json(self, value: Any) -> str:
        return json.dumps(value, cls=ProsperityEncoder, separators=(",", ":"))

    def truncate(self, value: str, max_length: int) -> str:
        lo, hi = 0, min(len(value), max_length)
        out = ""
        while lo <= hi:
            mid = (lo + hi) // 2
            candidate = value[:mid]
            if len(candidate) < len(value):
                candidate += "..."
            if len(json.dumps(candidate)) <= max_length:
                out = candidate
                lo = mid + 1
            else:
                hi = mid - 1
        return out


logger = Logger()


class Trader:
    def run(self, state: TradingState) -> tuple[dict[Symbol, list[Order]], int, str]:
        result = {}
        conversions = 0
        trader_data = ""

        # TODO: Add trading logic here

        logger.flush(state, result, conversions, trader_data)
        return result, conversions, trader_data
`.trim();

export function HomePage(): ReactNode {
  return (
    <Container>
      <Stack>
        <HomeCard title="Welcome!">
          <Text>
            <strong>IMC Prosperity 4 Visualizer</strong> is a tool for visualizing and analyzing your{' '}
            <Anchor href="https://prosperity.imc.com/" target="_blank" rel="noreferrer">
              IMC Prosperity 4
            </Anchor>{' '}
            trading algorithms. Inspired by and forked from{' '}
            <Anchor href="https://github.com/jmerle/imc-prosperity-3-visualizer" target="_blank" rel="noreferrer">
              jmerle&apos;s IMC Prosperity 3 Visualizer
            </Anchor>
            {' '}— all credit to the original author for the architecture and design.
          </Text>
          <Text mt="xs">
            Supports both <strong>server run logs</strong> (JSON files from your Prosperity submissions) and{' '}
            <strong>local backtest logs</strong> (from the{' '}
            <Anchor href="https://github.com/rkothari3/IMC_P4_Backtester" target="_blank" rel="noreferrer">
              IMC P4 Backtester
            </Anchor>
            ). Load a log file below to get started.
          </Text>
        </HomeCard>

        <HomeCard title="Does my bot need special setup?">
          <Text>
            <strong>No — your bot works as-is.</strong> The visualizer extracts chart data from two sources that the
            Prosperity infrastructure generates automatically, regardless of how your trader is written:
          </Text>
          <List mt="xs" spacing="xs">
            <List.Item>
              <strong>Activities log</strong> — bid/ask prices, volumes, mid-price, and P&amp;L for every product at
              every timestamp. Powers the candlestick chart, PnL chart, and order book price levels.
            </List.Item>
            <List.Item>
              <strong>Trade history</strong> — every fill your algorithm made (server runs only). Powers the buy/sell
              fill markers on the order book chart and the position chart.
            </List.Item>
          </List>

          <Title order={5} mt="md">
            Optional: unlock full order-book snapshots
          </Title>
          <Text mt="xs">
            For the timestamp-by-timestamp detail view (full order book state, your submitted orders, trader data), your
            algorithm needs to output compressed <Code>TradingState</Code> logs using the Logger class below. Add it to
            your trader and replace <Code>print()</Code> calls with <Code>logger.print()</Code>:
          </Text>
          <ScrollableCodeHighlight code={optionalLoggerCode} language="python" />
        </HomeCard>

        <HomeCard title="How to read the charts">
          <Text mb="xs">
            After loading a log file you land on the visualizer. Here is what every panel means.
          </Text>

          <Title order={5} mt="md">Profit / Loss</Title>
          <Text mt={4}>
            Cumulative seashells earned over time. A line going up-right is good. Dips are stretches
            where your position moved against you before you could unwind it. The final value is your
            score for that run.
          </Text>

          <Title order={5} mt="md">Price Movement (candlestick)</Title>
          <Text mt={4}>
            Each candle covers a group of ticks (adjustable). The candle body shows where the mid-price
            opened and closed in that window. The wicks show how far the best bid and best ask reached.
            Green = mid-price went up. Red = mid-price went down. Switch to <em>Price</em> mode for a
            plain line of the mid-price, or <em>Volume</em> mode to see how much was traded.
          </Text>

          <Title order={5} mt="md">Order Book (<Code>{'{symbol}'}</Code> - Order Book)</Title>
          <Text mt={4}>
            The live book at each tick. Green bars = bids (buyers), red bars = asks (sellers). Bar
            length is volume at that price level. Your own orders appear as dashed lines. Buy fills
            show as upward triangles (▲), sell fills as downward triangles (▽). Use this to see
            whether your quotes are sitting at the front of the queue or buried behind others.
          </Text>

          <Title order={5} mt="md">Positions (% of limit)</Title>
          <Text mt={4}>
            Your inventory for each product as a percentage of its position limit. +100% = fully long
            (maximum long position). −100% = fully short. Hovering near ±100% means your bot is
            capacity-constrained and cannot take more trades on that side — a potential source of
            missed profit.
          </Text>

          <Title order={5} mt="md">Timestamps panel (right sidebar)</Title>
          <Text mt={4}>
            Only available when your trader uses the Logger class (see setup above). Click any
            timestamp to see a freeze-frame of that exact tick:
          </Text>
          <List mt={4} spacing={4}>
            <List.Item><strong>Listings</strong> — which products exist and their currency.</List.Item>
            <List.Item><strong>Positions</strong> — your inventory at that tick.</List.Item>
            <List.Item><strong>Profit / Loss</strong> — cumulative P&amp;L per product at that tick.</List.Item>
            <List.Item>
              <strong>Order depth</strong> — the full order book (all price levels, all volumes).
              Green = bids, red = asks.
            </List.Item>
            <List.Item>
              <strong>Own trades</strong> — fills that <em>you</em> executed on the previous tick
              (your bot&apos;s orders that were matched).
            </List.Item>
            <List.Item>
              <strong>Market trades</strong> — fills between <em>other</em> participants on the
              previous tick. Useful for spotting informed traders.
            </List.Item>
            <List.Item>
              <strong>Orders</strong> — the orders your bot submitted <em>this</em> tick (what it
              just sent to the exchange).
            </List.Item>
          </List>

          <Title order={5} mt="md">Quick mental model</Title>
          <Text mt={4}>
            Think of each tick as one moment in time. Your bot looks at the order book → decides what
            orders to place → those orders show up in <strong>Orders</strong>. Next tick, if someone
            matched them, they appear in <strong>Own trades</strong>. The P&amp;L chart accumulates the
            profit from every such match. The position chart shows how much inventory you are holding
            between buys and sells.
          </Text>
        </HomeCard>

        <LoadFromFile />
        {/* <LoadFromProsperity /> */}
        {/* <LoadFromUrl /> */}
      </Stack>
    </Container>
  );
}
