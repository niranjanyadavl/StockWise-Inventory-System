# StockWise — Inventory Management System

A full-stack FSD mini project built with React, Express, Node.js and SQLite.

## Features

- Dashboard with product count, total units, inventory value and low-stock count
- Product CRUD (create, read, update, delete)
- Search by product name, SKU or category
- Category filter and low-stock filter
- Stock-in and stock-out transactions
- Validation to prevent negative stock
- Stock movement history
- SQLite database persists records between refreshes
- Responsive layout for desktop and mobile

## Requirements

- Node.js 18 or newer (Node.js 20 LTS recommended)
- npm
- VS Code

## Run locally

1. Extract the project ZIP and open the `stockwise-fsd` folder in VS Code.
2. Open Terminal → New Terminal.
3. Install packages:

   ```bash
   npm install
   ```

4. Start frontend and backend:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173`.
6. Backend health check: `http://localhost:4000/api/health`.

The SQLite database is created automatically at `server/stockwise.db`. Five sample products are inserted on the first run.

## Useful API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check API |
| GET | `/api/dashboard` | Dashboard metrics |
| GET | `/api/products` | List/search products |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product details |
| DELETE | `/api/products/:id` | Delete product |
| POST | `/api/products/:id/movement` | Stock in/out |
| GET | `/api/movements` | Stock movement history |

## Build and run production version

```bash
npm run build
npm start
```

Then open `http://localhost:4000`.

## Database schema

### products
- `id`: integer primary key
- `name`: product name
- `sku`: unique stock keeping unit
- `category`: product category
- `price`: unit price
- `quantity`: current quantity
- `min_stock`: low-stock threshold
- `created_at`: creation timestamp

### stock_movements
- `id`: integer primary key
- `product_id`: foreign key to products
- `type`: `IN` or `OUT`
- `quantity`: positive integer
- `note`: reason or description
- `created_at`: timestamp

## Demo checklist

1. Open Overview and explain the four summary cards.
2. Add a product with a unique SKU.
3. Edit its name or price.
4. Click Stock In and add units.
5. Click Stock Out and remove units.
6. Try to remove more than available to show validation.
7. Set quantity at or below the minimum threshold to show low-stock status.
8. Open Stock movements and explain the audit trail.
9. Refresh the browser and confirm data persists.

## Notes

- This is a mini-project demonstration. It does not include login or multi-user access control.
- SQLite is used to keep setup quick and reliable for local submission.
- If the evaluator mandates MongoDB/MySQL or authentication, adapt the stack to that requirement before submission.
