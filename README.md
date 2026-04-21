# IMC Prosperity 4 Visualizer

[![Build Status](https://github.com/rkothari3/imc-prosperity-4-visualizer/workflows/Build/badge.svg)](https://github.com/rkothari3/imc-prosperity-4-visualizer/actions/workflows/build.yml)

A web-based tool for visualizing and debugging trading algorithms from the [IMC Prosperity 4](https://prosperity.imc.com/) competition. Load your log files and interactively explore profit/loss curves, order books, positions, trades, and more.

**Live demo:** [rkothari3.github.io/imc-prosperity-4-visualizer](https://rkothari3.github.io/imc-prosperity-4-visualizer/)

---

## Features

- **Profit/Loss chart** — cumulative score over time per product
- **Candlestick chart** — mid-price OHLC with bid/ask spread
- **Order book** — depth visualization at each timestamp
- **Position tracking** — inventory as % of limit over time
- **Trades** — market trades vs. your own fills
- **Conversion observations** — transport/export metrics
- **Timestamp detail view** — full snapshot of state at any tick (requires Logger integration)
- **Dark/light mode**

---

## Quickstart

### Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [pnpm](https://pnpm.io/) v10+ (`npm install -g pnpm`)

### Run locally

```bash
git clone https://github.com/rkothari3/imc-prosperity-4-visualizer.git
cd imc-prosperity-4-visualizer
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production

```bash
pnpm build      # outputs to dist/
pnpm preview    # preview the production build locally
```

---

## Deploy to GitHub Pages

1. Fork this repository.
2. Go to **Settings → Pages** in your fork and set the source to the `gh-pages` branch.
3. Push to `master` — the GitHub Actions workflow will automatically build and deploy.

The base path is auto-detected from your repository name, so no config changes are needed.

---

## Loading log files

The visualizer accepts two log formats:

**Server run logs** — JSON exported from the Prosperity submission portal.

**Local backtest logs** — output from the [IMC P4 Backtester](https://github.com/rkothari3/IMC_P4_Backtester). Add the Logger class below to your algorithm to enable detailed per-timestamp inspection:

```python
from datamodel import Listing, Observation, Order, OrderDepth, ProsperityEncoder, Symbol, Trade, TradingState
from typing import Any
import json


class Logger:
    def __init__(self) -> None:
        self.logs = ""
        self.max_log_length = 3750

    def print(self, *objects: Any, sep: str = " ", end: str = "\n") -> None:
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
                compressed.append(
                    [
                        trade.symbol,
                        trade.price,
                        trade.quantity,
                        trade.buyer,
                        trade.seller,
                        trade.timestamp,
                    ]
                )
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
                observation.sugarPrice,
                observation.sunlightIndex,
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
        if len(value) <= max_length:
            return value
        return value[: max_length - 3] + "..."


logger = Logger()


class Trader:
    def run(self, state: TradingState) -> tuple[dict[Symbol, list[Order]], int, str]:
        # Your trading logic here
        result = {}
        conversions = 0
        trader_data = ""

        logger.flush(state, result, conversions, trader_data)
        return result, conversions, trader_data
```

---

## Development

```bash
pnpm lint       # check for lint/formatting issues
pnpm fix        # auto-fix lint and formatting
```

---

## Credits

Based on [jmerle/imc-prosperity-3-visualizer](https://github.com/jmerle/imc-prosperity-3-visualizer) by [Jasper van Merle](https://github.com/jmerle), which itself builds on his visualizers for [Prosperity 1](https://github.com/jmerle/imc-prosperity-visualizer) and [Prosperity 2](https://github.com/jmerle/imc-prosperity-2-visualizer).

## License

MIT
