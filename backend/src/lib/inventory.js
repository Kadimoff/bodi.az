import { badRequest, conflict, notFound } from './errors.js';

export const MOVEMENT_LABELS = {
  receipt: 'Mədaxil',
  issue: 'Məxaric',
  transfer_in: 'Transfer (giriş)',
  transfer_out: 'Transfer (çıxış)',
  adjustment: 'İnventarizasiya düzəlişi',
  sale: 'Satış',
  return: 'Qaytarma',
};

export const DOCUMENT_TYPES = {
  receipt: { prefix: 'MDX', label: 'Mədaxil' },
  issue: { prefix: 'MXR', label: 'Məxaric' },
  transfer: { prefix: 'TRF', label: 'Transfer' },
  adjustment: { prefix: 'INV', label: 'İnventarizasiya' },
};

/**
 * Applies a signed quantity change to one variant in one warehouse and logs the
 * movement. The upsert takes a row lock, so concurrent movements serialize.
 */
export async function applyMovement(tx, m) {
  const { variantId, warehouseId, type, quantity, unitCost = null, documentId = null, orderId = null, note = '', userId = null, allowNegative = true } = m;
  if (!Number.isInteger(quantity) || quantity === 0) return null;
  const [lvl] = await tx`
    INSERT INTO stock_levels (variant_id, warehouse_id, quantity)
    VALUES (${variantId}, ${warehouseId}, ${quantity})
    ON CONFLICT (variant_id, warehouse_id)
    DO UPDATE SET quantity = stock_levels.quantity + EXCLUDED.quantity, updated_at = now()
    RETURNING quantity`;
  if (!allowNegative && lvl.quantity < 0) {
    const [v] = await tx`SELECT sku FROM product_variants WHERE id = ${variantId}`;
    throw conflict(`Anbarda kifayət qədər qalıq yoxdur: ${v ? v.sku : variantId} (çatışmır: ${-lvl.quantity} ədəd).`);
  }
  await tx`
    INSERT INTO stock_movements (variant_id, warehouse_id, type, quantity, balance_after, unit_cost, document_id, order_id, note, user_id)
    VALUES (${variantId}, ${warehouseId}, ${type}, ${quantity}, ${lvl.quantity}, ${unitCost}, ${documentId}, ${orderId}, ${note}, ${userId})`;
  return lvl.quantity;
}

export async function nextDocumentNumber(tx, type) {
  const [{ id }] = await tx`SELECT nextval('stock_documents_id_seq')::int AS id`;
  const year = new Date().getFullYear();
  return { id, docNo: `${DOCUMENT_TYPES[type].prefix}-${year}-${String(id).padStart(5, '0')}` };
}

// Turns a draft document into stock movements. Must run inside a transaction.
export async function postDocument(tx, docId, userId) {
  const [doc] = await tx`SELECT * FROM stock_documents WHERE id = ${docId} FOR UPDATE`;
  if (!doc) throw notFound('Sənəd tapılmadı.');
  if (doc.status !== 'draft') throw conflict('Yalnız qaralama sənədlər təsdiqlənə bilər.');
  const lines = await tx`SELECT * FROM stock_document_lines WHERE document_id = ${docId} ORDER BY id`;
  if (!lines.length) throw badRequest('Sənəddə heç bir məhsul sətri yoxdur.');

  const note = `${DOCUMENT_TYPES[doc.type].label} ${doc.doc_no}${doc.reference ? ` (${doc.reference})` : ''}`;
  for (const line of lines) {
    const base = { variantId: line.variant_id, documentId: doc.id, userId, note: line.note || note, unitCost: line.unit_cost };
    if (doc.type === 'receipt') {
      await applyMovement(tx, { ...base, warehouseId: doc.warehouse_id, type: 'receipt', quantity: line.quantity });
    } else if (doc.type === 'issue') {
      await applyMovement(tx, { ...base, warehouseId: doc.warehouse_id, type: 'issue', quantity: -line.quantity, allowNegative: false });
    } else if (doc.type === 'transfer') {
      await applyMovement(tx, { ...base, warehouseId: doc.warehouse_id, type: 'transfer_out', quantity: -line.quantity, allowNegative: false });
      await applyMovement(tx, { ...base, warehouseId: doc.target_warehouse_id, type: 'transfer_in', quantity: line.quantity });
    } else if (doc.type === 'adjustment') {
      const [cur] = await tx`
        SELECT quantity FROM stock_levels WHERE variant_id = ${line.variant_id} AND warehouse_id = ${doc.warehouse_id} FOR UPDATE`;
      const delta = line.quantity - (cur ? cur.quantity : 0);
      await applyMovement(tx, { ...base, warehouseId: doc.warehouse_id, type: 'adjustment', quantity: delta });
    }
  }

  // Receipts carry the latest purchase cost onto the product (maya dəyəri).
  if (doc.type === 'receipt') {
    await tx`
      UPDATE products p SET cost_price = l.unit_cost, updated_at = now()
      FROM (
        SELECT DISTINCT ON (v.product_id) v.product_id, dl.unit_cost
        FROM stock_document_lines dl JOIN product_variants v ON v.id = dl.variant_id
        WHERE dl.document_id = ${doc.id} AND dl.unit_cost IS NOT NULL
        ORDER BY v.product_id, dl.id DESC
      ) l
      WHERE p.id = l.product_id`;
  }

  const [posted] = await tx`
    UPDATE stock_documents SET status = 'posted', posted_by = ${userId}, posted_at = now(), updated_at = now()
    WHERE id = ${doc.id} RETURNING *`;
  return posted;
}

/**
 * Locks and checks stock for order lines whose product tracks stock, and
 * decides which warehouses they ship from (default first, then the fullest).
 * Throws when a quantity is not available and backorders are not allowed.
 * Run it before inserting the order so a rejected checkout leaves no trace.
 */
export async function planOrderStock(tx, items) {
  const plan = [];
  for (const item of items) {
    if (!item.variant_id || !item.track_stock) continue;
    const levels = await tx`
      SELECT sl.warehouse_id, sl.quantity
      FROM stock_levels sl JOIN warehouses w ON w.id = sl.warehouse_id
      WHERE sl.variant_id = ${item.variant_id} AND w.is_active
      ORDER BY w.is_default DESC, sl.quantity DESC
      FOR UPDATE OF sl`;
    const available = levels.reduce((s, l) => s + Math.max(0, l.quantity), 0);
    if (available < item.quantity && !item.allow_backorder) {
      const what = `“${item.name}” (${[item.color, item.size].filter(Boolean).join(', ')})`;
      throw conflict(
        available > 0 ? `${what} üçün anbarda yalnız ${available} ədəd qalıb.` : `${what} hazırda stokda yoxdur.`,
        { variant_id: item.variant_id, available },
      );
    }
    let remaining = item.quantity;
    for (const l of levels) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Math.max(0, l.quantity));
      if (take > 0) {
        plan.push({ variantId: item.variant_id, warehouseId: l.warehouse_id, quantity: take });
        remaining -= take;
      }
    }
    if (remaining > 0) {
      // Backorder: book the shortfall against the default (or first) warehouse.
      const [w] = await tx`SELECT id FROM warehouses WHERE is_active ORDER BY is_default DESC, id LIMIT 1`;
      if (w) plan.push({ variantId: item.variant_id, warehouseId: w.id, quantity: remaining, backorder: true });
    }
  }
  return plan;
}

export async function applyOrderStock(tx, orderId, plan, userId = null) {
  for (const p of plan) {
    await applyMovement(tx, {
      variantId: p.variantId,
      warehouseId: p.warehouseId,
      type: 'sale',
      quantity: -p.quantity,
      orderId,
      userId,
      note: `Sifariş #${orderId}${p.backorder ? ' (öncədən sifariş)' : ''}`,
    });
  }
  await tx`UPDATE orders SET stock_applied = ${plan.length > 0} WHERE id = ${orderId}`;
  return plan.length > 0;
}

export async function deductOrderStock(tx, orderId, items, userId = null) {
  return applyOrderStock(tx, orderId, await planOrderStock(tx, items), userId);
}

// Reverses whatever net quantity an order took out of each warehouse.
export async function restoreOrderStock(tx, orderId, userId = null) {
  const rows = await tx`
    SELECT variant_id, warehouse_id, SUM(quantity)::int AS net
    FROM stock_movements
    WHERE order_id = ${orderId} AND type IN ('sale', 'return')
    GROUP BY variant_id, warehouse_id
    HAVING SUM(quantity) < 0`;
  for (const r of rows) {
    await applyMovement(tx, { variantId: r.variant_id, warehouseId: r.warehouse_id, type: 'return', quantity: -r.net, orderId, userId, note: `Sifariş #${orderId} — stoka qaytarıldı` });
  }
  await tx`UPDATE orders SET stock_applied = false WHERE id = ${orderId}`;
  return rows.length > 0;
}

// Creates the colour × size variant matrix for a product (idempotent).
export async function syncVariants(tx, product) {
  const colors = product.colors.length ? product.colors : [''];
  const sizes = product.sizes.length ? product.sizes : [''];
  const base = (product.sku || product.slug).toUpperCase();
  const created = [];
  for (const color of colors) {
    for (const size of sizes) {
      const sku = [base, color.toUpperCase(), size.replace(/\s+/g, '').toUpperCase()].filter(Boolean).join('-').replace(/[^A-Z0-9-]/g, '');
      const [row] = await tx`
        INSERT INTO product_variants (product_id, sku, color, size)
        VALUES (${product.id}, ${sku}, ${color}, ${size})
        ON CONFLICT (product_id, color, size) DO UPDATE SET is_active = true
        RETURNING id, (xmax = 0) AS inserted`;
      if (row.inserted) created.push(row.id);
    }
  }
  // Variants for colours/sizes no longer offered are deactivated, not deleted,
  // so their stock history stays intact.
  await tx`
    UPDATE product_variants SET is_active = false
    WHERE product_id = ${product.id}
      AND NOT (color = ANY(${colors}) AND size = ANY(${sizes}))`;
  return created;
}
