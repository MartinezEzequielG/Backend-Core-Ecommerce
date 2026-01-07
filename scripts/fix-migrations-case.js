/* scripts/fix-migrations-case.js */
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

// Mapeo: tabla_en_sql (minúscula) -> nombre_real_en_mysql (según modelos Prisma, con mayúscula)
const map = {
  order: "Order",
  cart: "Cart",
  user: "User",
  category: "Category",
  product: "Product",
  productimage: "ProductImage",
  productoption: "ProductOption",
  productvariant: "ProductVariant",
  cartitem: "CartItem",
  orderitem: "OrderItem",
  shippingaddress: "ShippingAddress",
  payment: "Payment",
  paymentevent: "PaymentEvent",
  siteconfig: "SiteConfig",
  productaudit: "ProductAudit",
  stockreservation: "StockReservation",
  storesettings: "StoreSettings",
};

// Solo reemplazamos nombres de tablas cuando estén entre backticks: `order`
function fixSql(sql) {
  for (const [from, to] of Object.entries(map)) {
    const re = new RegExp("`" + from + "`", "g");
    sql = sql.replace(re, "`" + to + "`");
  }
  return sql;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.isFile() && e.name === "migration.sql") processFile(full);
  }
}

function processFile(file) {
  const before = fs.readFileSync(file, "utf8");
  const after = fixSql(before);
  if (before !== after) {
    fs.writeFileSync(file, after, "utf8");
    console.log("fixed:", path.relative(process.cwd(), file));
  }
}

walk(MIGRATIONS_DIR);
console.log("done");
