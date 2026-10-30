import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  LayoutDashboard, Package, ArrowLeftRight, Search, Plus, Bell, Menu,
  Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, X, Boxes,
  CircleAlert, CircleCheck, TrendingUp, RefreshCw, ChevronDown,
  Filter, Activity, ClipboardList, CalendarClock, CalendarDays,
  AlertTriangle, Clock, ScanLine
} from "lucide-react";

const money = value => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
}).format(Number(value || 0));

const dateLabel = value => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN")
  : "—";

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = response.status === 204
    ? null
    : await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Something went wrong.");
  }

  return data;
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handle = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  return (
    <div
      className="overlay"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <section className="modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}



function ProductScanner({ onDetected }) {
  const scannerElementId = "stockwise-camera-scanner";
  const onDetectedRef = useRef(onDetected);
  const scannerRef = useRef(null);
  const handledRef = useRef(false);

  const [scannerError, setScannerError] = useState("");
  const [scannerStatus, setScannerStatus] = useState("Starting camera…");

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let cancelled = false;
    let scanner;

    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode(scannerElementId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF
          ],
          verbose: false
        });

        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => ({
              width: Math.floor(Math.min(width * 0.85, 350)),
              height: Math.floor(Math.min(height * 0.55, 220))
            }),
            aspectRatio: 1.5
          },
          (decodedText) => {
            if (handledRef.current || !decodedText) return;

            handledRef.current = true;
            setScannerStatus("Scanned: " + decodedText);

            scanner.stop()
              .then(() => {
                onDetectedRef.current?.(decodedText);
              })
              .catch((error) => {
                console.error(error);
                onDetectedRef.current?.(decodedText);
              });
          },
          () => {}
        );

        if (!cancelled) {
          setScannerStatus("Camera active. Point at a QR code or barcode.");
        }
      } catch (error) {
        console.error("Scanner error:", error);

        if (!cancelled) {
          setScannerError(error.message || "Unable to start camera.");
          setScannerStatus("Scanner unavailable");
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;

      if (scanner?.isScanning) {
        scanner.stop()
          .then(() => scanner.clear())
          .catch((error) => console.error("Scanner cleanup:", error));
      } else if (scanner) {
        scanner.clear().catch(() => {});
      }

      scannerRef.current = null;
    };
  }, []);

  return (
    <div className="scanner-container">
      <div id={scannerElementId} />

      <p className="scanner-status">{scannerStatus}</p>

      {scannerError && (
        <div className="scanner-error">{scannerError}</div>
      )}

      <p className="scanner-help">
        Keep the QR code or barcode inside the camera frame.
        Ensure good lighting and hold your device steady.
      </p>
    </div>
  );
}

function ProductForm({ initial, onSave, onClose, busy }) {
  const [form, setForm] = useState(initial || {
    name: "",
    sku: "",
    category: "Electronics",
    price: "",
    quantity: "",
    min_stock: "5",
    manufacturing_date: "",
    expiry_date: ""
  });

  const [error, setError] = useState("");

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (
      form.manufacturing_date &&
      form.expiry_date &&
      form.expiry_date < form.manufacturing_date
    ) {
      setError("Expiry date cannot be before manufacturing date.");
      return;
    }

    try {
      await onSave({
        ...form,
        price: Number(form.price),
        quantity: Number(form.quantity),
        min_stock: Number(form.min_stock)
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field full">
          Product name
          <input
            required
            maxLength="100"
            value={form.name}
            onChange={e => set("name", e.target.value)}
            placeholder="e.g. Wireless Mouse"
          />
        </label>

        <label className="field">
          SKU / Product code
          <input
            required
            maxLength="40"
            value={form.sku}
            onChange={e => set("sku", e.target.value.toUpperCase())}
            placeholder="e.g. WM001"
          />
        </label>

        <label className="field">
          Category
          <select
            value={form.category}
            onChange={e => set("category", e.target.value)}
          >
            {[
              "Electronics", "Accessories", "Stationery",
              "Furniture", "Office Supplies", "General"
            ].map(x => <option key={x}>{x}</option>)}
          </select>
        </label>

        <label className="field">
          Unit price (₹)
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={e => set("price", e.target.value)}
            placeholder="599"
          />
        </label>

        <label className="field">
          Current quantity
          <input
            required
            type="number"
            min="0"
            step="1"
            value={form.quantity}
            disabled={!!initial}
            onChange={e => set("quantity", e.target.value)}
            placeholder="20"
          />
          {initial && <small>Use Stock In/Out to change quantity.</small>}
        </label>

        <label className="field full">
          Low-stock threshold
          <input
            required
            type="number"
            min="0"
            step="1"
            value={form.min_stock}
            onChange={e => set("min_stock", e.target.value)}
          />
        </label>

        <div className="field full">
          <strong>Expiry information</strong>
          <small>Optional. Leave blank for products without expiry dates.</small>
        </div>

        <label className="field">
          Manufacturing date
          <input
            type="date"
            value={form.manufacturing_date || ""}
            onChange={e => set("manufacturing_date", e.target.value)}
          />
        </label>

        <label className="field">
          Expiry date
          <input
            type="date"
            min={form.manufacturing_date || undefined}
            value={form.expiry_date || ""}
            onChange={e => set("expiry_date", e.target.value)}
          />
        </label>
      </div>

      {error && <div className="inline-error">{error}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn-light" onClick={onClose}>
          Cancel
        </button>
        <button disabled={busy} className="btn btn-primary" type="submit">
          {busy ? "Saving…" : initial ? "Save changes" : "Add product"}
        </button>
      </div>
    </form>
  );
}

function MovementForm({ product, type, onSave, onClose, busy }) {
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");

    try {
      await onSave({ type, quantity: Number(quantity), note });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="movement-product">
        <div className="product-icon"><Package size={22} /></div>
        <div>
          <strong>{product.name}</strong>
          <small>{product.sku} · Available: {product.quantity} units</small>
        </div>
      </div>

      <label className="field">
        Quantity
        <input
          required
          type="number"
          min="1"
          max={type === "OUT" ? product.quantity : undefined}
          step="1"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
        />
      </label>

      <label className="field">
        Note (optional)
        <input
          maxLength="200"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={type === "IN" ? "Supplier delivery" : "Sale / stock issued"}
        />
      </label>

      {error && <div className="inline-error">{error}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn-light" onClick={onClose}>
          Cancel
        </button>
        <button
          disabled={busy}
          className={`btn ${type === "IN" ? "btn-primary" : "btn-dark"}`}
          type="submit"
        >
          {busy ? "Saving…" : type === "IN" ? "Record stock in" : "Record stock out"}
        </button>
      </div>
    </form>
  );
}

function OrderForm({ products, suppliers, onSave, onClose, busy }) {
  const today = new Date().toISOString().slice(0, 10);

  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(today);
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([
    { product_id: "", quantity: "1", unit_price: "" }
  ]);
  const [error, setError] = useState("");

  const updateItem = (index, key, value) => {
    setItems(current => current.map((item, i) => {
      if (i !== index) return item;

      if (key === "product_id") {
        const product = products.find(p => p.id === Number(value));

        return {
          ...item,
          product_id: value,
          unit_price: product ? String(product.price) : ""
        };
      }

      return { ...item, [key]: value };
    }));
  };

  const total = items.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  );

  async function submit(e) {
    e.preventDefault();
    setError("");

    const validItems = items.map(item => ({
      product_id: Number(item.product_id),
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price)
    }));

    if (validItems.some(item =>
      !item.product_id ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      !Number.isFinite(item.unit_price) ||
      item.unit_price < 0
    )) {
      setError("Choose a product and enter a valid quantity and price.");
      return;
    }

    try {
      await onSave({
        supplier_id: supplierId ? Number(supplierId) : null,
        order_date: orderDate,
        expected_delivery: expectedDelivery,
        notes,
        items: validItems
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field full">
          Supplier
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">Use product's default supplier</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>

        <label className="field">
          Order date
          <input
            type="date"
            required
            value={orderDate}
            onChange={e => setOrderDate(e.target.value)}
          />
        </label>

        <label className="field">
          Expected delivery
          <input
            type="date"
            min={orderDate}
            value={expectedDelivery}
            onChange={e => setExpectedDelivery(e.target.value)}
          />
        </label>
      </div>

      <div className="panel-heading" style={{ margin: "22px 0 12px" }}>
        <div>
          <h2>Products in this order</h2>
          <p>Add one or more products and quantities.</p>
        </div>
        <button
          type="button"
          className="btn btn-light"
          onClick={() => setItems(current => [
            ...current,
            { product_id: "", quantity: "1", unit_price: "" }
          ])}
        >
          <Plus size={15} /> Add item
        </button>
      </div>

      {items.map((item, index) => (
        <div
          key={index}
          className="form-grid"
          style={{
            padding: "14px",
            marginBottom: "12px",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            alignItems: "end"
          }}
        >
          <label className="field full">
            Product
            <select
              required
              value={item.product_id}
              onChange={e => updateItem(index, "product_id", e.target.value)}
            >
              <option value="">Select product</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku}) — Stock: {product.quantity}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Quantity
            <input
              required
              type="number"
              min="1"
              step="1"
              value={item.quantity}
              onChange={e => updateItem(index, "quantity", e.target.value)}
            />
          </label>

          <label className="field">
            Unit price (₹)
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={item.unit_price}
              onChange={e => updateItem(index, "unit_price", e.target.value)}
            />
          </label>

          {items.length > 1 && (
            <button
              type="button"
              className="btn btn-light"
              onClick={() => setItems(current => current.filter((_, i) => i !== index))}
              style={{ gridColumn: "1 / -1", justifySelf: "end" }}
            >
              <Trash2 size={15} /> Remove item
            </button>
          )}
        </div>
      ))}

      <label className="field">
        Notes (optional)
        <input
          maxLength="500"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add order notes"
        />
      </label>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 0",
        fontWeight: 700
      }}>
        <span>Estimated order total</span>
        <strong>{money(total)}</strong>
      </div>

      {error && <div className="inline-error">{error}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn-light" onClick={onClose}>
          Cancel
        </button>
        <button disabled={busy || !products.length} className="btn btn-primary" type="submit">
          {busy ? "Creating…" : "Create purchase order"}
        </button>
      </div>
    </form>
  );
}

function OrderStatus({ status }) {
  const className =
    status === "Received" ? "good" :
    status === "Partially Received" ? "low" :
    status === "Cancelled" ? "out" : "low";

  return (
    <span className={`status status-${className}`}>
      <i />{status}
    </span>
  );
}

function ExpiryStatus({ status }) {
  const className =
    status === "Expired" ? "out" :
    status === "Expiring Soon" ? "low" : "good";

  return (
    <span className={`status status-${className}`}>
      <i />{status}
    </span>
  );
}
export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("admin@stockwise.com");
  const [password, setPassword] = useState("Admin@123");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [page, setPage] = useState("Overview");
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalUnits: 0,
    inventoryValue: 0,
    lowStockCount: 0,
    healthy: 0,
    low: 0,
    outOfStock: 0,
    expiredCount: 0,
    expiringSoonCount: 0
  });

  const [movements, setMovements] = useState([]);
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [expiryData, setExpiryData] = useState({
    summary: { expired: 0, expiringSoon: 0, good: 0, total: 0 },
    products: []
  });

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [lowOnly, setLowOnly] = useState(false);
  const [expiryFilter, setExpiryFilter] = useState("All");
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    setLoginBusy(true);

    try {
      const result = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      setUser(result.user);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginBusy(false);
    }
  }

  function handleLogout() {
    setUser(null);
    setPassword("");
    setPage("Overview");
  }

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  async function refresh() {
    setLoading(true);

    try {
      const [p, s, m, o, supplierList, expiry] = await Promise.all([
        api(`/api/products?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&lowStock=${lowOnly}`),
        api("/api/dashboard"),
        api("/api/movements"),
        api("/api/orders"),
        api("/api/suppliers"),
        api("/api/expiry")
      ]);

      setProducts(p);
      setStats(s);
      setMovements(m);
      setOrders(o);
      setSuppliers(supplierList);
      setExpiryData(expiry);
    } catch (err) {
      notify(`Could not load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) refresh();
  }, [search, category, lowOnly, user]);

  async function saveProduct(form) {
    setBusy(true);

    try {
      if (modal.product) {
        await api(`/api/products/${modal.product.id}`, {
          method: "PUT",
          body: JSON.stringify(form)
        });
      } else {
        await api("/api/products", {
          method: "POST",
          body: JSON.stringify(form)
        });
      }

      setModal(null);
      await refresh();
      notify(modal.product ? "Product updated successfully." : "Product added successfully.");
    } finally {
      setBusy(false);
    }
  }

  async function removeProduct(product) {
    if (!window.confirm(`Delete "${product.name}"? Its stock movement history will also be deleted.`)) {
      return;
    }

    try {
      await api(`/api/products/${product.id}`, { method: "DELETE" });
      await refresh();
      notify("Product deleted.");
    } catch (err) {
      notify(err.message);
    }
  }

  async function saveMovement(form) {
    setBusy(true);

    try {
      await api(`/api/products/${modal.product.id}/movement`, {
        method: "POST",
        body: JSON.stringify(form)
      });

      setModal(null);
      await refresh();
      notify(`Stock ${form.type === "IN" ? "added" : "reduced"} successfully.`);
    } finally {
      setBusy(false);
    }
  }

  async function saveOrder(form) {
    setBusy(true);

    try {
      await api("/api/orders", {
        method: "POST",
        body: JSON.stringify(form)
      });

      setModal(null);
      await refresh();
      notify("Purchase order created successfully.");
    } finally {
      setBusy(false);
    }
  }

  async function receiveOrder(order) {
    const confirmed = window.confirm(
      `Receive all remaining items for ${order.order_number || `PO-${order.id}`}? This will increase inventory stock.`
    );

    if (!confirmed) return;

    try {
      await api(`/api/orders/${order.id}/receive`, {
        method: "PATCH",
        body: JSON.stringify({})
      });

      await refresh();
      notify("Purchase order stock received successfully.");
    } catch (err) {
      notify(err.message);
    }
  }

  async function changeOrderStatus(order, status) {
    try {
      await api(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });

      await refresh();
      notify(`Purchase order marked as ${status.toLowerCase()}.`);
    } catch (err) {
      notify(err.message);
    }
  }

  function handleScannedCode(scannedValue) {
    const code = String(scannedValue || "").trim();

    setScannerOpen(false);

    if (!code) {
      notify("No code was detected. Please try again.");
      return;
    }

    const matchedProduct = products.find(product =>
      String(product.sku || "").trim().toLowerCase() === code.toLowerCase() ||
      String(product.barcode || "").trim().toLowerCase() === code.toLowerCase() ||
      String(product.qr_code || "").trim().toLowerCase() === code.toLowerCase()
    );

    if (matchedProduct) {
      setSearch(matchedProduct.sku || code);
      setCategory("All categories");
      setLowOnly(false);
      setPage("Products");
      notify(`Product found: ${matchedProduct.name}`);
    } else {
      setSearch(code);
      setCategory("All categories");
      setLowOnly(false);
      setPage("Products");
      notify(`Scanned code: ${code}. No matching product was found.`);
    }
  }

  const lowProducts = useMemo(
    () => products.filter(p => p.quantity <= p.min_stock),
    [products]
  );

  const navItems = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Products", icon: Package },
    { label: "Purchase Orders", icon: ClipboardList },
    { label: "Expiry Tracking", icon: CalendarClock },
    { label: "Stock movements", icon: ArrowLeftRight }
  ];

  const setSection = label => {
    setPage(label);
    setMobileNav(false);

    if (label === "Products") setLowOnly(false);
  };

  const displayedProducts = products;

  const statusOf = p =>
    p.quantity === 0 ? "Out of stock" :
    p.quantity <= p.min_stock ? "Low stock" : "In stock";

  const expiryProducts = expiryData.products || [];

  const filteredExpiryProducts = expiryProducts.filter(product => {
    if (expiryFilter === "All") return true;
    return product.expiry_status === expiryFilter;
  });

  // Login screen
  if (!user) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f5fa",
        padding: "20px",
        fontFamily: "Arial, sans-serif"
      }}>
        <form onSubmit={handleLogin} style={{
          width: "100%",
          maxWidth: "420px",
          background: "#fff",
          padding: "38px",
          borderRadius: "16px",
          boxShadow: "0 12px 45px rgba(0,0,0,0.08)"
        }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <div style={{
              fontSize: "30px",
              fontWeight: "800",
              color: "#2563eb"
            }}>
              STOCKWISE
            </div>
            <p style={{ color: "#64748b" }}>
              Inventory Management System
            </p>
          </div>

          <h2 style={{ color: "#172033" }}>Welcome back</h2>
          <p style={{ color: "#64748b", marginBottom: "25px" }}>
            Sign in to access your workspace.
          </p>

          <label className="field">
            Email address
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </label>

          <label className="field" style={{ marginTop: "16px" }}>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </label>

          {loginError && (
            <div className="inline-error" style={{ marginTop: "15px" }}>
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={loginBusy}
            className="btn btn-primary"
            style={{
              width: "100%",
              justifyContent: "center",
              marginTop: "24px"
            }}
          >
            {loginBusy ? "Signing in..." : "Sign in"}
          </button>

          <div style={{
            marginTop: "25px",
            padding: "15px",
            background: "#f8fafc",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#475569",
            lineHeight: "1.8"
          }}>
            <strong>Demo accounts</strong><br />
            Admin: admin@stockwise.com / Admin@123<br />
            Manager: manager@stockwise.com / Manager@123<br />
            Staff: staff@stockwise.com / Staff@123
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Boxes size={22} /></div>
          <div>
            <strong>stockwise</strong>
            <span>INVENTORY SUITE</span>
          </div>
          <button className="icon-btn mobile-close" onClick={() => setMobileNav(false)}>
            <X />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav>
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${page === label ? "active" : ""}`}
              onClick={() => setSection(label)}
            >
              <Icon size={18} />
              <span>{label}</span>

              {label === "Products" && (
                <span className="nav-count">{stats.totalProducts}</span>
              )}

              {label === "Expiry Tracking" && stats.expiredCount + stats.expiringSoonCount > 0 && (
                <span className="nav-count">
                  {stats.expiredCount + stats.expiringSoonCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><Activity size={17} /></div>
            <strong>Inventory health</strong>
            <p>Monitor your stock levels and expiry alerts.</p>
            <button onClick={() => {
              setPage("Expiry Tracking");
              setMobileNav(false);
            }}>
              Review alerts <span>→</span>
            </button>
          </div>

          <div className="profile">
            <div className="avatar">
              {user.name?.charAt(0) || "U"}
            </div>
            <div>
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </div>
            <ChevronDown size={16} />
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>

          <div className="breadcrumbs">
            Workspace <span>/</span> <strong>{page}</strong>
          </div>

          <div className="top-actions">
            <div className="api-status">
              <span></span> API connected
            </div>

            <button
              className="icon-btn notification"
              title="Expiry alerts"
              onClick={() => setPage("Expiry Tracking")}
            >
              <Bell size={18} />
              {(stats.expiredCount + stats.expiringSoonCount) > 0 && <i />}
            </button>

            <div className="avatar avatar-small">
              {user.name?.charAt(0) || "U"}
            </div>

            <button className="btn btn-light" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <div className="content">
                  {/* OVERVIEW */}
          {page === "Overview" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">MONITOR YOUR BUSINESS</div>
                <h1>Inventory overview</h1>
                <p>Here's what's happening with your stock today.</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setModal({ kind: "product" })}
              >
                <Plus size={17} /> Add product
              </button>
            </div>

            <div className="stat-grid">
              <StatCard
                icon={Package}
                label="Total products"
                value={stats.totalProducts.toLocaleString("en-IN")}
                note="Unique items tracked"
                tone="blue"
              />
              <StatCard
                icon={Boxes}
                label="Units in stock"
                value={stats.totalUnits.toLocaleString("en-IN")}
                note="Across all products"
                tone="violet"
              />
              <StatCard
                icon={TrendingUp}
                label="Inventory value"
                value={money(stats.inventoryValue)}
                note="Quantity × unit price"
                tone="green"
              />
              <StatCard
                icon={CircleAlert}
                label="Low-stock items"
                value={stats.lowStockCount.toLocaleString("en-IN")}
                note="At or below threshold"
                tone="orange"
              />
            </div>

            <div className="stat-grid">
              <StatCard
                icon={AlertTriangle}
                label="Expired products"
                value={expiryData.summary.expired || 0}
                note="Require immediate attention"
                tone="orange"
              />
              <StatCard
                icon={Clock}
                label="Expiring soon"
                value={expiryData.summary.expiringSoon || 0}
                note="Within the next 30 days"
                tone="blue"
              />
            </div>

            <div className="overview-grid">
              <section className="panel inventory-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Product inventory</h2>
                    <p>Your latest stock overview</p>
                  </div>
                  <button className="text-btn" onClick={() => setPage("Products")}>
                    View all <span>→</span>
                  </button>
                </div>

                <ProductTable
                  products={displayedProducts.slice(0, 5)}
                  loading={loading}
                  statusOf={statusOf}
                  onEdit={p => setModal({ kind: "product", product: p })}
                  onDelete={removeProduct}
                  onMovement={(p, type) => setModal({ kind: "movement", product: p, type })}
                />
              </section>

              <section className="panel health-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Stock health</h2>
                    <p>Based on minimum stock levels</p>
                  </div>
                  <div className="health-dot" />
                </div>

                <div className="health-number">
                  {stats.totalProducts
                    ? Math.round((stats.healthy / stats.totalProducts) * 100)
                    : 0}
                  <span>%</span>
                </div>

                <p className="health-caption">Products adequately stocked</p>

                <div className="health-bar">
                  <span
                    className="healthy"
                    style={{
                      width: `${stats.totalProducts ? stats.healthy / stats.totalProducts * 100 : 0}%`
                    }}
                  />
                  <span
                    className="low"
                    style={{
                      width: `${stats.totalProducts ? stats.low / stats.totalProducts * 100 : 0}%`
                    }}
                  />
                  <span
                    className="empty"
                    style={{
                      width: `${stats.totalProducts ? stats.outOfStock / stats.totalProducts * 100 : 0}%`
                    }}
                  />
                </div>

                <div className="health-legend">
                  <div><i className="dot dot-green" /><span>Healthy</span><strong>{stats.healthy}</strong></div>
                  <div><i className="dot dot-orange" /><span>Low stock</span><strong>{stats.low}</strong></div>
                  <div><i className="dot dot-red" /><span>Out of stock</span><strong>{stats.outOfStock}</strong></div>
                </div>

                <button className="alert-box" onClick={() => {
                  setPage("Expiry Tracking");
                }}>
                  <div><CalendarClock size={18} /></div>
                  <span>
                    <strong>{stats.expiredCount + stats.expiringSoonCount} expiry alerts</strong>
                    <small>Review expired and soon-to-expire products.</small>
                  </span>
                  <span className="alert-arrow">→</span>
                </button>
              </section>
            </div>

            <section className="panel movements-panel">
              <div className="panel-heading">
                <div>
                  <h2>Recent stock movements</h2>
                  <p>Latest stock additions and reductions</p>
                </div>
                <button className="text-btn" onClick={() => setPage("Stock movements")}>
                  View history <span>→</span>
                </button>
              </div>
              <MovementTable rows={movements.slice(0, 5)} />
            </section>
          </>}

          {/* PRODUCTS */}
          {page === "Products" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">CATALOG MANAGEMENT</div>
                <h1>Products</h1>
                <p>Manage your products, quantities and expiry dates.</p>
              </div>
              <div className="page-heading-actions">
                <button
                  className="btn btn-light"
                  onClick={() => setScannerOpen(true)}
                >
                  <ScanLine size={17} /> Scan QR / Barcode
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setModal({ kind: "product" })}
                >
                  <Plus size={17} /> Add product
                </button>
              </div>
            </div>

            <div className="filter-bar">
              <div className="search-box">
                <Search size={17} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search product, SKU or category…"
                />
              </div>

              <div className="select-wrap">
                <Filter size={16} />
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  <option>All categories</option>
                  {[
                    "Electronics", "Accessories", "Stationery",
                    "Furniture", "Office Supplies", "General"
                  ].map(x => <option key={x}>{x}</option>)}
                </select>
              </div>

              <button
                className={`btn ${lowOnly ? "btn-dark" : "btn-light"}`}
                onClick={() => setLowOnly(v => !v)}
              >
                <CircleAlert size={16} />
                {lowOnly ? "Showing low stock" : "Low stock only"}
              </button>

              <button className="icon-btn refresh-btn" onClick={refresh} title="Refresh">
                <RefreshCw size={17} />
              </button>
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>All products <span className="muted-count">{displayedProducts.length}</span></h2>
                  <p>Product details, stock and expiry status</p>
                </div>
              </div>

              <ProductTable
                products={displayedProducts}
                loading={loading}
                statusOf={statusOf}
                onEdit={p => setModal({ kind: "product", product: p })}
                onDelete={removeProduct}
                onMovement={(p, type) => setModal({ kind: "movement", product: p, type })}
              />
            </section>
          </>}

          {/* PURCHASE ORDERS */}
          {page === "Purchase Orders" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">PROCUREMENT MANAGEMENT</div>
                <h1>Purchase Orders</h1>
                <p>Create supplier orders and receive products into your inventory.</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setModal({ kind: "order" })}
                disabled={!products.length}
              >
                <Plus size={17} /> Create purchase order
              </button>
            </div>

            <div className="stat-grid">
              <StatCard
                icon={ClipboardList}
                label="Total orders"
                value={orders.length.toLocaleString("en-IN")}
                note="All purchase orders"
                tone="blue"
              />
              <StatCard
                icon={Activity}
                label="Pending / ordered"
                value={orders.filter(o =>
                  ["Pending", "Ordered", "Partially Received"].includes(o.status)
                ).length.toLocaleString("en-IN")}
                note="Awaiting completion"
                tone="orange"
              />
              <StatCard
                icon={CircleCheck}
                label="Received orders"
                value={orders.filter(o => o.status === "Received").length.toLocaleString("en-IN")}
                note="Completed deliveries"
                tone="green"
              />
              <StatCard
                icon={TrendingUp}
                label="Order value"
                value={money(orders.reduce((sum, o) => sum + Number(o.total || 0), 0))}
                note="Total recorded order value"
                tone="violet"
              />
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>All purchase orders <span className="muted-count">{orders.length}</span></h2>
                  <p>Track supplier orders, deliveries and received stock.</p>
                </div>
                <button className="icon-btn refresh-btn" onClick={refresh} title="Refresh orders">
                  <RefreshCw size={17} />
                </button>
              </div>

              {!orders.length ? (
                <div className="table-state">
                  <ClipboardList size={28} />
                  <strong>No purchase orders yet</strong>
                  <span>Create a purchase order to start tracking supplier deliveries.</span>
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>ORDER</th>
                        <th>SUPPLIER</th>
                        <th>PRODUCTS</th>
                        <th>ORDER DATE</th>
                        <th>EXPECTED DELIVERY</th>
                        <th>TOTAL</th>
                        <th>STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => {
                        const itemList = Array.isArray(order.items) ? order.items : [];

                        const productSummary = itemList.length
                          ? itemList.map(item => `${item.product_name} × ${item.quantity}`).join(", ")
                          : `${order.product_name || "Product"} × ${order.quantity || 0}`;

                        const canReceive = !["Received", "Cancelled"].includes(order.status);
                        const canChange = !["Received", "Partially Received", "Cancelled"].includes(order.status);

                        return (
                          <tr key={order.id}>
                            <td>
                              <strong>{order.order_number || `PO-${String(order.id).padStart(4, "0")}`}</strong>
                            </td>
                            <td>{order.supplier_name || suppliers.find(s => s.id === order.supplier_id)?.name || "—"}</td>
                            <td className="note-cell" title={productSummary}>{productSummary}</td>
                            <td>{order.order_date ? dateLabel(order.order_date) : "—"}</td>
                            <td>{order.expected_delivery ? dateLabel(order.expected_delivery) : "—"}</td>
                            <td className="price-cell">{money(order.total ?? (order.quantity * order.unit_price))}</td>
                            <td><OrderStatus status={order.status || "Pending"} /></td>
                            <td>
                              <div className="row-actions">
                                {canReceive && (
                                  <button
                                    className="btn btn-primary"
                                    style={{ padding: "7px 10px", fontSize: "12px" }}
                                    onClick={() => receiveOrder(order)}
                                  >
                                    Receive
                                  </button>
                                )}

                                {canChange && order.status === "Pending" && (
                                  <button
                                    className="action-icon"
                                    title="Mark as ordered"
                                    onClick={() => changeOrderStatus(order, "Ordered")}
                                  >
                                    <CircleCheck size={16} />
                                  </button>
                                )}

                                {canChange && (
                                  <button
                                    className="action-icon danger"
                                    title="Cancel order"
                                    onClick={() => {
                                      if (window.confirm("Cancel this purchase order?")) {
                                        changeOrderStatus(order, "Cancelled");
                                      }
                                    }}
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>}
                    {/* EXPIRY TRACKING */}
          {page === "Expiry Tracking" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">PRODUCT SHELF-LIFE MANAGEMENT</div>
                <h1>Expiry Tracking</h1>
                <p>Monitor product expiry dates and identify items that need attention.</p>
              </div>
              <button className="btn btn-light" onClick={refresh}>
                <RefreshCw size={16} /> Refresh
              </button>
            </div>

            <div className="stat-grid">
              <StatCard
                icon={Package}
                label="Products with expiry dates"
                value={expiryData.summary.total || 0}
                note="Tracked products"
                tone="blue"
              />
              <StatCard
                icon={AlertTriangle}
                label="Expired products"
                value={expiryData.summary.expired || 0}
                note="Already past expiry date"
                tone="orange"
              />
              <StatCard
                icon={Clock}
                label="Expiring soon"
                value={expiryData.summary.expiringSoon || 0}
                note="Within the next 30 days"
                tone="violet"
              />
              <StatCard
                icon={CircleCheck}
                label="Good condition"
                value={expiryData.summary.good || 0}
                note="More than 30 days remain"
                tone="green"
              />
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Expiry alerts</h2>
                  <p>Products are sorted by their expiry date.</p>
                </div>

                <div className="select-wrap">
                  <Filter size={16} />
                  <select
                    value={expiryFilter}
                    onChange={e => setExpiryFilter(e.target.value)}
                  >
                    <option value="All">All statuses</option>
                    <option value="Expired">Expired</option>
                    <option value="Expiring Soon">Expiring Soon</option>
                    <option value="Good">Good</option>
                  </select>
                </div>
              </div>

              {!filteredExpiryProducts.length ? (
                <div className="table-state">
                  <CalendarDays size={28} />
                  <strong>No expiry records found</strong>
                  <span>
                    Add manufacturing and expiry dates to products to see them here.
                  </span>
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>PRODUCT</th>
                        <th>SKU</th>
                        <th>QUANTITY</th>
                        <th>MANUFACTURING DATE</th>
                        <th>EXPIRY DATE</th>
                        <th>DAYS LEFT</th>
                        <th>EXPIRY STATUS</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredExpiryProducts.map(product => (
                        <tr key={product.id}>
                          <td>
                            <div className="product-cell">
                              <div className="product-icon">
                                <Package size={18} />
                              </div>
                              <strong>{product.name}</strong>
                            </div>
                          </td>

                          <td><span className="sku">{product.sku}</span></td>
                          <td>{product.quantity}</td>
                          <td>{dateLabel(product.manufacturing_date)}</td>
                          <td>{dateLabel(product.expiry_date)}</td>
                          <td>
                            {product.days_to_expiry < 0
                              ? `${Math.abs(product.days_to_expiry)} days overdue`
                              : `${product.days_to_expiry} days`}
                          </td>
                          <td><ExpiryStatus status={product.expiry_status} /></td>
                          <td>
                            <button
                              className="action-icon"
                              title="Edit product expiry dates"
                              onClick={() => setModal({ kind: "product", product })}
                            >
                              <Pencil size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel" style={{ marginTop: "20px" }}>
              <div className="panel-heading">
                <div>
                  <h2>Expiry management guide</h2>
                  <p>How StockWise classifies expiry dates.</p>
                </div>
              </div>

              <div className="expiry-guide">
                <div>
                  <ExpiryStatus status="Expired" />
                  <p>Expiry date has passed. Review and remove from sale as appropriate.</p>
                </div>
                <div>
                  <ExpiryStatus status="Expiring Soon" />
                  <p>Expiry date is within the next 30 days. Prioritise these products.</p>
                </div>
                <div>
                  <ExpiryStatus status="Good" />
                  <p>More than 30 days remain before the expiry date.</p>
                </div>
              </div>
            </section>
          </>}

          {/* STOCK MOVEMENTS */}
          {page === "Stock movements" && <>
            <div className="page-heading">
              <div>
                <div className="eyebrow">AUDIT TRAIL</div>
                <h1>Stock movements</h1>
                <p>Review the latest stock additions and reductions.</p>
              </div>
              <button className="btn btn-light" onClick={refresh}>
                <RefreshCw size={16} /> Refresh
              </button>
            </div>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Movement history</h2>
                  <p>Up to 250 most recent transactions</p>
                </div>
              </div>
              <MovementTable rows={movements} />
            </section>
          </>}

        </div>
   <footer className="footer">
  <span>© {new Date().getFullYear()} StockWise Inventory</span>
  <span>Built with React · Express · JSON storage</span>
</footer>
</main>

      {mobileNav && (
        <div className="mobile-scrim" onClick={() => setMobileNav(false)} />
      )}

      {scannerOpen && (
        <Modal
          title="Scan QR code or barcode"
          onClose={() => setScannerOpen(false)}
        >
          <ProductScanner onDetected={handleScannedCode} />
        </Modal>
      )}

      {modal?.kind === "product" && (
        <Modal
          title={modal.product ? "Edit product" : "Add new product"}
          onClose={() => setModal(null)}
        >
          <ProductForm
            initial={modal.product ? {
              ...modal.product,
              price: String(modal.product.price),
              quantity: String(modal.product.quantity),
              min_stock: String(modal.product.min_stock),
              manufacturing_date: modal.product.manufacturing_date || "",
              expiry_date: modal.product.expiry_date || ""
            } : null}
            onSave={saveProduct}
            onClose={() => setModal(null)}
            busy={busy}
          />
        </Modal>
      )}

      {modal?.kind === "order" && (
        <Modal
          title="Create purchase order"
          onClose={() => setModal(null)}
        >
          <OrderForm
            products={products}
            suppliers={suppliers}
            onSave={saveOrder}
            onClose={() => setModal(null)}
            busy={busy}
          />
        </Modal>
      )}

      {modal?.kind === "movement" && (
        <Modal
          title={modal.type === "IN" ? "Stock in" : "Stock out"}
          onClose={() => setModal(null)}
        >
          <MovementForm
            product={modal.product}
            type={modal.type}
            onSave={saveMovement}
            onClose={() => setModal(null)}
            busy={busy}
          />
        </Modal>
      )}

      {toast && (
        <div className="toast">
          <CircleCheck size={18} />{toast}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, note, tone }) {
  return (
    <section className="stat-card">
      <div className="stat-top">
        <div className={`stat-icon ${tone}`}>
          <Icon size={19} />
        </div>
        <span className="stat-note">
          {tone === "orange" ? "Action needed" : "Live data"}
        </span>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">{note}</div>
    </section>
  );
}

function ProductTable({
  products,
  loading,
  statusOf,
  onEdit,
  onDelete,
  onMovement
}) {
  if (loading) {
    return (
      <div className="table-state">
        <RefreshCw className="spin" size={22} /> Loading inventory…
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="table-state">
        <Package size={28} />
        <strong>No products found</strong>
        <span>Add a product or change your search filters.</span>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>PRODUCT</th>
            <th>SKU</th>
            <th>CATEGORY</th>
            <th>PRICE</th>
            <th>QUANTITY</th>
            <th>STOCK STATUS</th>
            <th>EXPIRY</th>
            <th className="actions-head">ACTIONS</th>
          </tr>
        </thead>

        <tbody>
          {products.map((p, i) => (
            <tr key={p.id}>
              <td>
                <div className="product-cell">
                  <div className={`product-icon icon-color-${i % 4}`}>
                    <Package size={18} />
                  </div>
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.created_at
                        ? `Added ${new Date(p.created_at).toLocaleDateString("en-IN")}`
                        : "Inventory item"}
                    </small>
                  </div>
                </div>
              </td>

              <td><span className="sku">{p.sku}</span></td>
              <td><span className="category-pill">{p.category}</span></td>
              <td className="price-cell">{money(p.price)}</td>

              <td>
                <div className="quantity-cell">
                  <strong>{p.quantity}</strong>
                  <small>Min. {p.min_stock}</small>
                </div>
              </td>

              <td>
                <span className={`status status-${
                  statusOf(p) === "In stock"
                    ? "good"
                    : statusOf(p) === "Low stock"
                      ? "low"
                      : "out"
                }`}>
                  <i />{statusOf(p)}
                </span>
              </td>

              <td>
                {p.expiry_date
                  ? <ExpiryStatus status={p.expiry_status || "Good"} />
                  : <span className="muted-count">Not set</span>}
              </td>

              <td>
                <div className="row-actions">
                  <button
                    className="action-icon in"
                    title="Stock in"
                    onClick={() => onMovement(p, "IN")}
                  >
                    <ArrowDownToLine size={16} />
                  </button>

                  <button
                    className="action-icon out"
                    title="Stock out"
                    disabled={p.quantity === 0}
                    onClick={() => onMovement(p, "OUT")}
                  >
                    <ArrowUpFromLine size={16} />
                  </button>

                  <button
                    className="action-icon"
                    title="Edit"
                    onClick={() => onEdit(p)}
                  >
                    <Pencil size={15} />
                  </button>

                  <button
                    className="action-icon danger"
                    title="Delete"
                    onClick={() => onDelete(p)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MovementTable({ rows }) {
  if (!rows.length) {
    return (
      <div className="table-state">
        <ArrowLeftRight size={28} />
        <strong>No stock movements yet</strong>
        <span>Stock additions and reductions will appear here.</span>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>PRODUCT</th>
            <th>SKU</th>
            <th>TYPE</th>
            <th>QUANTITY</th>
            <th>NOTE</th>
            <th>DATE & TIME</th>
          </tr>
        </thead>

        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>
                <div className="product-cell">
                  <div className={`movement-icon ${
                    r.type === "IN" ? "movement-in" : "movement-out"
                  }`}>
                    {r.type === "IN"
                      ? <ArrowDownToLine size={17} />
                      : <ArrowUpFromLine size={17} />}
                  </div>
                  <strong>{r.product_name}</strong>
                </div>
              </td>

              <td><span className="sku">{r.sku || "—"}</span></td>

              <td>
                <span className={`movement-type ${
                  r.type === "IN" ? "type-in" : "type-out"
                }`}>
                  {r.type === "IN" ? "Stock in" : "Stock out"}
                </span>
              </td>

              <td>
                <strong className={r.type === "IN" ? "text-green" : "text-red"}>
                  {r.type === "IN" ? "+" : "−"}{r.quantity}
                </strong>
              </td>

              <td className="note-cell">{r.note || "—"}</td>

              <td className="date-cell">
                {r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
