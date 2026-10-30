
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;
const file = path.join(__dirname, "stockwise-data.json");

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// --------------------------------------------------
// INITIAL DATA
// --------------------------------------------------

const seed = {
  products: [
    {
      id: 1,
      name: "Wireless Mouse",
      sku: "WM001",
      category: "Electronics",
      price: 599,
      quantity: 24,
      min_stock: 5,
      manufacturing_date: "",
      expiry_date: "",
      supplier_id: 1
    },
    {
      id: 2,
      name: "USB-C Hub",
      sku: "UCH002",
      category: "Accessories",
      price: 1299,
      quantity: 3,
      min_stock: 5,
      manufacturing_date: "",
      expiry_date: "",
      supplier_id: 2
    },
    {
      id: 3,
      name: "Notebook A5",
      sku: "NB003",
      category: "Stationery",
      price: 80,
      quantity: 42,
      min_stock: 10,
      manufacturing_date: "",
      expiry_date: "",
      supplier_id: 1
    }
  ],

  movements: [],

  suppliers: [
    {
      id: 1,
      name: "TechSource Supplies",
      contact: "9876543210",
      email: "sales@techsource.example",
      address: "Bengaluru"
    },
    {
      id: 2,
      name: "Digital World",
      contact: "9876501234",
      email: "orders@digitalworld.example",
      address: "Bengaluru"
    }
  ],

  orders: [],

  users: [
    {
      id: 1,
      name: "Administrator",
      email: "admin@stockwise.com",
      password: "Admin@123",
      role: "Admin"
    },
    {
      id: 2,
      name: "Store Manager",
      email: "manager@stockwise.com",
      password: "Manager@123",
      role: "Manager"
    },
    {
      id: 3,
      name: "Staff Member",
      email: "staff@stockwise.com",
      password: "Staff@123",
      role: "Staff"
    }
  ]
};

// --------------------------------------------------
// DATABASE
// --------------------------------------------------

function load() {
  try {
    if (fs.existsSync(file)) {
      const saved = JSON.parse(fs.readFileSync(file, "utf8"));

      const data = {
        ...structuredClone(seed),
        ...saved
      };

      data.products = Array.isArray(saved.products)
        ? saved.products
        : structuredClone(seed.products);

      data.movements = Array.isArray(saved.movements)
        ? saved.movements
        : [];

      data.suppliers = Array.isArray(saved.suppliers)
        ? saved.suppliers
        : structuredClone(seed.suppliers);

      data.orders = Array.isArray(saved.orders)
        ? saved.orders
        : [];

      data.users = Array.isArray(saved.users)
        ? saved.users
        : structuredClone(seed.users);

      // Add new expiry fields to older product records.
      data.products = data.products.map(product => ({
        manufacturing_date: "",
        expiry_date: "",
        ...product
      }));

      return data;
    }
  } catch (error) {
    console.error("Data read error:", error);
    throw new Error(
      "Could not read stockwise-data.json. Check the file before restarting."
    );
  }

  fs.writeFileSync(file, JSON.stringify(seed, null, 2));
  return structuredClone(seed);
}

let db = load();

const save = () => {
  fs.writeFileSync(file, JSON.stringify(db, null, 2));
};

const id = array =>
  array.reduce(
    (max, item) => Math.max(max, Number(item.id) || 0),
    0
  ) + 1;

const stamp = () => new Date().toISOString();

const validDate = value => {
  if (!value) return true;

  if (typeof value !== "string") return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};

// --------------------------------------------------
// EXPIRY TRACKING HELPERS
// --------------------------------------------------

const EXPIRY_ALERT_DAYS = 30;

function validProductDates(manufacturingDate, expiryDate) {
  if (
    !validDate(manufacturingDate) ||
    !validDate(expiryDate)
  ) {
    return false;
  }

  if (
    manufacturingDate &&
    expiryDate &&
    expiryDate < manufacturingDate
  ) {
    return false;
  }

  return true;
}

function getExpiryInfo(expiryDate) {
  if (!expiryDate) {
    return {
      expiry_status: "No Expiry Date",
      days_to_expiry: null
    };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const expiry = new Date(`${expiryDate}T00:00:00.000Z`);

  const days = Math.round(
    (expiry.getTime() - today.getTime()) /
    (1000 * 60 * 60 * 24)
  );

  if (days < 0) {
    return {
      expiry_status: "Expired",
      days_to_expiry: days
    };
  }

  if (days <= EXPIRY_ALERT_DAYS) {
    return {
      expiry_status: "Expiring Soon",
      days_to_expiry: days
    };
  }

  return {
    expiry_status: "Good",
    days_to_expiry: days
  };
}

function enrichProduct(product) {
  return {
    ...product,
    ...getExpiryInfo(product.expiry_date)
  };
}

// --------------------------------------------------
// PURCHASE ORDER HELPERS
// --------------------------------------------------

function getOrderItems(order) {
  if (Array.isArray(order.items)) {
    return order.items;
  }

  // Compatibility with older single-product orders.
  if (order.product_id) {
    return [{
      product_id: Number(order.product_id),
      product_name: order.product_name || "",
      sku: "",
      quantity: Number(order.quantity || 0),
      received_quantity:
        order.status === "Received"
          ? Number(order.quantity || 0)
          : 0,
      unit_price: Number(order.unit_price || 0),
      total: Number(order.total || 0)
    }];
  }

  return [];
}

function enrichOrder(order) {
  const supplier = db.suppliers.find(
    s => s.id === Number(order.supplier_id)
  );

  const items = getOrderItems(order).map(item => {
    const product = db.products.find(
      p => p.id === Number(item.product_id)
    );

    return {
      ...item,
      product_name: product?.name || item.product_name || "Deleted product",
      sku: product?.sku || item.sku || ""
    };
  });

  return {
    ...order,
    items,
    supplier_name: supplier?.name || "Unknown supplier"
  };
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (_, res) => {
  res.json({
    status: "ok",
    application: "StockWise Inventory Management System"
  });
});

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

app.post("/api/login", (req, res) => {
  const email = String(req.body.email || "")
    .toLowerCase()
    .trim();

  const password = String(req.body.password || "");

  const user = db.users.find(
    u =>
      String(u.email).toLowerCase() === email &&
      u.password === password
  );

  if (!user) {
    return res.status(401).json({
      error: "Invalid email or password"
    });
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

// --------------------------------------------------
// DASHBOARD
// --------------------------------------------------

app.get("/api/dashboard", (_, res) => {
  const products = db.products;

  const totalProducts = products.length;

  const totalUnits = products.reduce(
    (sum, p) => sum + Number(p.quantity || 0),
    0
  );

  const inventoryValue = products.reduce(
    (sum, p) =>
      sum + Number(p.price || 0) * Number(p.quantity || 0),
    0
  );

  const healthy = products.filter(
    p => Number(p.quantity) > Number(p.min_stock)
  ).length;

  const low = products.filter(
    p =>
      Number(p.quantity) <= Number(p.min_stock) &&
      Number(p.quantity) > 0
  ).length;

  const outOfStock = products.filter(
    p => Number(p.quantity) === 0
  ).length;

  const expiryProducts = products
    .filter(p => p.expiry_date)
    .map(enrichProduct);

  const expiredCount = expiryProducts.filter(
    p => p.expiry_status === "Expired"
  ).length;

  const expiringSoonCount = expiryProducts.filter(
    p => p.expiry_status === "Expiring Soon"
  ).length;

  res.json({
    totalProducts,
    totalUnits,
    inventoryValue,
    lowStockCount: low + outOfStock,
    healthy,
    low,
    outOfStock,
    expiredCount,
    expiringSoonCount
  });
});

// --------------------------------------------------
// PRODUCTS - GET
// --------------------------------------------------

app.get("/api/products", (req, res) => {
  const search = String(req.query.search || "").toLowerCase();
  const category = String(req.query.category || "");

  let products = db.products;

  if (search) {
    products = products.filter(p =>
      `${p.name} ${p.sku} ${p.category}`
        .toLowerCase()
        .includes(search)
    );
  }

  if (category && category !== "All categories") {
    products = products.filter(
      p => p.category === category
    );
  }

  if (req.query.lowStock === "true") {
    products = products.filter(
      p => Number(p.quantity) <= Number(p.min_stock)
    );
  }

  res.json(products.map(enrichProduct));
});

// --------------------------------------------------
// PRODUCTS - CREATE
// --------------------------------------------------

app.post("/api/products", (req, res) => {
  const b = req.body;

  const product = {
    id: id(db.products),
    name: String(b.name || "").trim(),
    sku: String(b.sku || "").trim().toUpperCase(),
    category: b.category || "General",
    price: Number(b.price),
    quantity: Number(b.quantity),
    min_stock: Number(b.min_stock),
    manufacturing_date: b.manufacturing_date || "",
    expiry_date: b.expiry_date || "",
    supplier_id: Number(b.supplier_id) || null
  };

  if (
    !product.name ||
    !product.sku ||
    ![
      product.price,
      product.quantity,
      product.min_stock
    ].every(Number.isFinite) ||
    product.price < 0 ||
    product.quantity < 0 ||
    product.min_stock < 0 ||
    !Number.isInteger(product.quantity) ||
    !Number.isInteger(product.min_stock)
  ) {
    return res.status(400).json({
      error: "Check product fields"
    });
  }

  if (!validProductDates(
    product.manufacturing_date,
    product.expiry_date
  )) {
    return res.status(400).json({
      error: "Enter valid dates. Expiry date cannot be before manufacturing date."
    });
  }

  if (db.products.some(p => p.sku === product.sku)) {
    return res.status(409).json({
      error: "SKU already exists"
    });
  }

  db.products.push(product);

  if (product.quantity > 0) {
    db.movements.unshift({
      id: id(db.movements),
      product_id: product.id,
      product_name: product.name,
      type: "IN",
      quantity: product.quantity,
      note: "Opening stock",
      created_at: stamp()
    });
  }

  save();

  res.status(201).json(enrichProduct(product));
});

// --------------------------------------------------
// PRODUCTS - UPDATE
// --------------------------------------------------

app.put("/api/products/:id", (req, res) => {
  const product = db.products.find(
    p => p.id === Number(req.params.id)
  );

  if (!product) {
    return res.status(404).json({
      error: "Product not found"
    });
  }

  const b = req.body;

  const updated = {
    ...product,

    name: b.name !== undefined
      ? String(b.name).trim()
      : product.name,

    sku: b.sku !== undefined
      ? String(b.sku).trim().toUpperCase()
      : product.sku,

    category: b.category ?? product.category,

    price: b.price !== undefined
      ? Number(b.price)
      : product.price,

    min_stock: b.min_stock !== undefined
      ? Number(b.min_stock)
      : product.min_stock,

    manufacturing_date: b.manufacturing_date !== undefined
      ? b.manufacturing_date
      : (product.manufacturing_date || ""),

    expiry_date: b.expiry_date !== undefined
      ? b.expiry_date
      : (product.expiry_date || ""),

    supplier_id: b.supplier_id !== undefined
      ? Number(b.supplier_id) || null
      : product.supplier_id
  };

  if (
    !updated.name ||
    !updated.sku ||
    !Number.isFinite(updated.price) ||
    updated.price < 0 ||
    !Number.isFinite(updated.min_stock) ||
    updated.min_stock < 0 ||
    !Number.isInteger(updated.min_stock)
  ) {
    return res.status(400).json({
      error: "Check product fields"
    });
  }

  if (!validProductDates(
    updated.manufacturing_date,
    updated.expiry_date
  )) {
    return res.status(400).json({
      error: "Enter valid dates. Expiry date cannot be before manufacturing date."
    });
  }

  if (
    db.products.some(
      p => p.id !== product.id && p.sku === updated.sku
    )
  ) {
    return res.status(409).json({
      error: "SKU already exists"
    });
  }

  Object.assign(product, updated);

  save();

  res.json(enrichProduct(product));
});

// --------------------------------------------------
// PRODUCTS - DELETE
// --------------------------------------------------

app.delete("/api/products/:id", (req, res) => {
  const productId = Number(req.params.id);

  const productExists = db.products.some(
    p => p.id === productId
  );

  if (!productExists) {
    return res.status(404).json({
      error: "Product not found"
    });
  }

  const hasActiveOrder = db.orders.some(order => {
    const items = getOrderItems(order);

    return (
      !["Received", "Cancelled"].includes(order.status) &&
      items.some(
        item => Number(item.product_id) === productId
      )
    );
  });

  if (hasActiveOrder) {
    return res.status(409).json({
      error: "This product is linked to an active purchase order."
    });
  }

  db.products = db.products.filter(
    p => p.id !== productId
  );

  save();

  res.json({ success: true });
});

// --------------------------------------------------
// EXPIRY TRACKING
// --------------------------------------------------

app.get("/api/expiry", (req, res) => {
  const products = db.products
    .filter(p => p.expiry_date)
    .map(enrichProduct)
    .sort((a, b) =>
      a.expiry_date.localeCompare(b.expiry_date)
    );

  const expired = products.filter(
    p => p.expiry_status === "Expired"
  );

  const expiringSoon = products.filter(
    p => p.expiry_status === "Expiring Soon"
  );

  const good = products.filter(
    p => p.expiry_status === "Good"
  );

  res.json({
    summary: {
      expired: expired.length,
      expiringSoon: expiringSoon.length,
      good: good.length,
      total: products.length
    },
    products
  });
});

// --------------------------------------------------
// STOCK MOVEMENTS - CREATE
// --------------------------------------------------

app.post("/api/products/:id/movement", (req, res) => {
  const product = db.products.find(
    p => p.id === Number(req.params.id)
  );

  let { type, quantity, note } = req.body;

  quantity = Number(quantity);

  if (
    !product ||
    !["IN", "OUT"].includes(type) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    (type === "OUT" && quantity > product.quantity)
  ) {
    return res.status(400).json({
      error: "Invalid stock movement"
    });
  }

  product.quantity += type === "IN"
    ? quantity
    : -quantity;

  db.movements.unshift({
    id: id(db.movements),
    product_id: product.id,
    product_name: product.name,
    type,
    quantity,
    note: String(note || ""),
    created_at: stamp()
  });

  save();

  res.json(enrichProduct(product));
});

// --------------------------------------------------
// STOCK MOVEMENTS - HISTORY
// --------------------------------------------------

app.get("/api/movements", (_, res) => {
  res.json(db.movements.slice(0, 250));
});

// --------------------------------------------------
// SUPPLIERS - GET
// --------------------------------------------------

app.get("/api/suppliers", (_, res) => {
  res.json(db.suppliers);
});

// --------------------------------------------------
// SUPPLIERS - CREATE
// --------------------------------------------------

app.post("/api/suppliers", (req, res) => {
  const b = req.body;
  const name = String(b.name || "").trim();

  if (!name) {
    return res.status(400).json({
      error: "Supplier name required"
    });
  }

  const supplier = {
    id: id(db.suppliers),
    name,
    contact: b.contact || "",
    email: b.email || "",
    address: b.address || ""
  };

  db.suppliers.push(supplier);

  save();

  res.status(201).json(supplier);
});

// --------------------------------------------------
// SUPPLIERS - DELETE
// --------------------------------------------------

app.delete("/api/suppliers/:id", (req, res) => {
  const supplierId = Number(req.params.id);

  const hasActiveOrder = db.orders.some(
    order =>
      Number(order.supplier_id) === supplierId &&
      !["Received", "Cancelled"].includes(order.status)
  );

  if (hasActiveOrder) {
    return res.status(409).json({
      error: "This supplier has active purchase orders."
    });
  }

  db.suppliers = db.suppliers.filter(
    s => s.id !== supplierId
  );

  save();

  res.json({ success: true });
});

// --------------------------------------------------
// PURCHASE ORDERS - GET
// --------------------------------------------------

app.get("/api/orders", (_, res) => {
  res.json(db.orders.map(enrichOrder));
});

// --------------------------------------------------
// PURCHASE ORDERS - CREATE
// --------------------------------------------------

app.post("/api/orders", (req, res) => {
  const b = req.body;

  // Supports multi-product orders and older
  // single-product order requests.
  const requestedItems = Array.isArray(b.items)
    ? b.items
    : [{
        product_id: b.product_id,
        quantity: b.quantity,
        unit_price: b.unit_price
      }];

  if (requestedItems.length === 0) {
    return res.status(400).json({
      error: "Add at least one product to the purchase order."
    });
  }

  const supplierId = Number(b.supplier_id) || null;

  const supplier = supplierId
    ? db.suppliers.find(s => s.id === supplierId)
    : null;

  if (supplierId && !supplier) {
    return res.status(400).json({
      error: "Selected supplier does not exist."
    });
  }

  const items = [];

  for (const requested of requestedItems) {
    const product = db.products.find(
      p => p.id === Number(requested.product_id)
    );

    if (!product) {
      return res.status(400).json({
        error: `Product ${requested.product_id} was not found.`
      });
    }

    const quantity = Number(requested.quantity);

    const unitPrice = requested.unit_price !== undefined
      ? Number(requested.unit_price)
      : Number(product.price || 0);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      return res.status(400).json({
        error: `Invalid quantity or price for ${product.name}.`
      });
    }

    items.push({
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      quantity,
      received_quantity: 0,
      unit_price: unitPrice,
      total: quantity * unitPrice
    });
  }

  const orderSupplierId =
    supplierId ||
    db.products.find(
      p => p.id === items[0].product_id
    )?.supplier_id ||
    null;

  const orderDate = b.order_date ||
    new Date().toISOString().slice(0, 10);

  const expectedDelivery = b.expected_delivery || "";

  if (
    !validDate(orderDate) ||
    !validDate(expectedDelivery)
  ) {
    return res.status(400).json({
      error: "Enter valid order and expected delivery dates."
    });
  }

  if (
    orderDate &&
    expectedDelivery &&
    expectedDelivery < orderDate
  ) {
    return res.status(400).json({
      error: "Expected delivery cannot be before the order date."
    });
  }

  const total = items.reduce(
    (sum, item) => sum + item.total,
    0
  );

  const nextOrderId = id(db.orders);

  const order = {
    id: nextOrderId,
    order_number: `PO-${String(nextOrderId).padStart(4, "0")}`,
    supplier_id: orderSupplierId,
    items,
    total,
    order_date: orderDate,
    expected_delivery: expectedDelivery,
    notes: String(b.notes || ""),
    status: "Pending",
    created_at: stamp()
  };

  // Retain compatibility with older single-product data.
  if (items.length === 1) {
    order.product_id = items[0].product_id;
    order.product_name = items[0].product_name;
    order.quantity = items[0].quantity;
    order.unit_price = items[0].unit_price;
  } else {
    order.product_id = null;
    order.product_name = `${items.length} products`;
    order.quantity = items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }

  db.orders.unshift(order);

  save();

  res.status(201).json(enrichOrder(order));
});

// --------------------------------------------------
// PURCHASE ORDERS - UPDATE STATUS
// --------------------------------------------------

app.patch("/api/orders/:id/status", (req, res) => {
  const order = db.orders.find(
    o => o.id === Number(req.params.id)
  );

  if (!order) {
    return res.status(404).json({
      error: "Purchase order not found."
    });
  }

  const status = String(req.body.status || "");

  if (!["Pending", "Ordered", "Cancelled"].includes(status)) {
    return res.status(400).json({
      error: "Invalid status. Use Pending, Ordered or Cancelled."
    });
  }

  if (["Received", "Partially Received"].includes(order.status)) {
    return res.status(400).json({
      error: "A received purchase order cannot be changed to this status."
    });
  }

  if (order.status === "Cancelled" && status !== "Cancelled") {
    return res.status(400).json({
      error: "A cancelled purchase order cannot be reopened."
    });
  }

  order.status = status;
  order.updated_at = stamp();

  save();

  res.json(enrichOrder(order));
});

// --------------------------------------------------
// PURCHASE ORDERS - RECEIVE STOCK
// --------------------------------------------------

app.patch("/api/orders/:id/receive", (req, res) => {
  const order = db.orders.find(
    o => o.id === Number(req.params.id)
  );

  if (!order) {
    return res.status(404).json({
      error: "Purchase order not found."
    });
  }

  if (order.status === "Cancelled") {
    return res.status(400).json({
      error: "Cancelled orders cannot be received."
    });
  }

  if (order.status === "Received") {
    return res.status(400).json({
      error: "This purchase order has already been fully received."
    });
  }

  // For legacy single-product orders, convert the stored
  // order into the new items format before receiving stock.
  if (!Array.isArray(order.items)) {
    order.items = getOrderItems(order);
  }

  const items = order.items;

  if (!items.length) {
    return res.status(400).json({
      error: "This purchase order has no products."
    });
  }

  // Optional request body:
  // { items: [{ product_id: 1, received_quantity: 5 }] }
  //
  // If no items are provided, all remaining quantities
  // are received automatically.

  const requestedReceipts = Array.isArray(req.body.items)
    ? req.body.items
    : null;

  const receipts = [];

  for (const item of items) {
    const product = db.products.find(
      p => p.id === Number(item.product_id)
    );

    if (!product) {
      return res.status(400).json({
        error: `Product ${item.product_name || item.product_id} no longer exists.`
      });
    }

    const ordered = Number(item.quantity || 0);
    const alreadyReceived = Number(item.received_quantity || 0);
    const remaining = ordered - alreadyReceived;

    const requested = requestedReceipts
      ? requestedReceipts.find(
          r => Number(r.product_id) === Number(item.product_id)
        )
      : null;

    const receiveQuantity = requestedReceipts
      ? Number(requested?.received_quantity || 0)
      : remaining;

    if (
      !Number.isInteger(receiveQuantity) ||
      receiveQuantity < 0 ||
      receiveQuantity > remaining
    ) {
      return res.status(400).json({
        error: `Invalid received quantity for ${product.name}. Remaining quantity: ${remaining}.`
      });
    }

    receipts.push({
      item,
      product,
      receiveQuantity
    });
  }

  const totalReceivedNow = receipts.reduce(
    (sum, r) => sum + r.receiveQuantity,
    0
  );

  if (totalReceivedNow < 1) {
    return res.status(400).json({
      error: "Enter at least one quantity to receive."
    });
  }

  // Apply stock updates and movement records.
  for (const receipt of receipts) {
    const { item, product, receiveQuantity } = receipt;

    if (receiveQuantity > 0) {
      product.quantity += receiveQuantity;

      item.received_quantity =
        Number(item.received_quantity || 0) + receiveQuantity;

      db.movements.unshift({
        id: id(db.movements),
        product_id: product.id,
        product_name: product.name,
        type: "IN",
        quantity: receiveQuantity,
        note: `Purchase order #${order.order_number || order.id}`,
        created_at: stamp()
      });
    }
  }

  const fullyReceived = items.every(
    item =>
      Number(item.received_quantity || 0) >=
      Number(item.quantity || 0)
  );

  order.status = fullyReceived
    ? "Received"
    : "Partially Received";

  if (fullyReceived) {
    order.received_at = stamp();
  }

  order.updated_at = stamp();

  save();

  res.json(enrichOrder(order));
});

// --------------------------------------------------
// USERS
// --------------------------------------------------

app.get("/api/users", (_, res) => {
  res.json(
    db.users.map(({ password, ...user }) => user)
  );
});

// --------------------------------------------------
// BASIC STOCK FORECAST
// --------------------------------------------------

app.get("/api/forecast", (_, res) => {
  const rows = db.products.map(product => {
    const outgoing = db.movements.filter(
      m =>
        m.product_id === product.id &&
        m.type === "OUT"
    );

    const average = outgoing.reduce(
      (sum, m) => sum + Number(m.quantity || 0),
      0
    ) / Math.max(1, outgoing.length);

    return {
      id: product.id,
      name: product.name,
      quantity: product.quantity,
      averageOut: Math.round(average * 10) / 10,
      recommended: Math.max(
        0,
        Math.ceil(average * 2 - product.quantity)
      )
    };
  });

  res.json(rows);
});

// --------------------------------------------------
// SERVE FRONTEND BUILD
// --------------------------------------------------

const dist = path.join(__dirname, "..", "dist");

app.use(express.static(dist));

app.get("*", (req, res) => {
  res.sendFile(
    path.join(dist, "index.html"),
    error => {
      if (error) {
        res.status(404).send(
          "Run npm.cmd run dev or npm.cmd run build first."
        );
      }
    }
  );
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`StockWise API: http://localhost:${PORT}`);
});
