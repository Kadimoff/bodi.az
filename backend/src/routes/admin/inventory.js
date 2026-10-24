import { sql } from '../../db.js';
import { requirePerm, audit } from '../../lib/auth.js';
import { postDocument, nextDocumentNumber, DOCUMENT_TYPES, MOVEMENT_LABELS } from '../../lib/inventory.js';
import { mediaUrl } from '../../lib/media.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { str, bool, int, intOrNull, numOrNull, oneOf, required, pageParams, dateOrNull } from '../../lib/validate.js';

const DOC_TYPES = Object.keys(DOCUMENT_TYPES);

function thumbOf(formats) {
  return formats?.thumb ? mediaUrl(formats.thumb.path) : '';
}

// Variant rows with product info and per-warehouse quantities.
async function variantRows(where, { limit = 50, offset = 0, order = sql`p.name, v.color, v.size` } = {}) {
  return sql`
    SELECT v.id, v.sku, v.color, v.size, v.barcode, v.is_active, v.product_id,
           p.name AS product_name, p.slug AS product_slug, p.track_stock, p.cost_price, p.price, p.status AS product_status,
           col.name AS color_name, col.hex AS color_hex,
           (SELECT m.formats FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id = p.id ORDER BY pi.position LIMIT 1) AS formats,
           COALESCE((SELECT json_object_agg(sl.warehouse_id, json_build_object('quantity', sl.quantity, 'min_quantity', sl.min_quantity, 'bin_location', sl.bin_location))
                     FROM stock_levels sl WHERE sl.variant_id = v.id), '{}') AS levels,
           COALESCE((SELECT SUM(sl.quantity) FROM stock_levels sl JOIN warehouses w ON w.id = sl.warehouse_id AND w.is_active WHERE sl.variant_id = v.id), 0)::int AS total,
           COALESCE((SELECT SUM(sl.min_quantity) FROM stock_levels sl JOIN warehouses w ON w.id = sl.warehouse_id AND w.is_active WHERE sl.variant_id = v.id), 0)::int AS min_total
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
    LEFT JOIN colors col ON col.slug = v.color
    WHERE ${where}
    ORDER BY ${order}
    LIMIT ${limit} OFFSET ${offset}`;
}

function presentVariant(r) {
  return { ...r, thumb: thumbOf(r.formats), formats: undefined, label: [r.color_name || r.color, r.size].filter(Boolean).join(' / ') };
}

async function loadDocument(id) {
  const [d] = await sql`
    SELECT d.*, w.name AS warehouse_name, tw.name AS target_warehouse_name, s.name AS supplier_name,
           cu.username AS created_by_name, pu.username AS posted_by_name
    FROM stock_documents d
    JOIN warehouses w ON w.id = d.warehouse_id
    LEFT JOIN warehouses tw ON tw.id = d.target_warehouse_id
    LEFT JOIN suppliers s ON s.id = d.supplier_id
    LEFT JOIN users cu ON cu.id = d.created_by
    LEFT JOIN users pu ON pu.id = d.posted_by
    WHERE d.id = ${id}`;
  if (!d) throw notFound('Sənəd tapılmadı.');
  const lines = await sql`
    SELECT l.*, v.sku, v.color, v.size, p.name AS product_name, col.name AS color_name,
           COALESCE((SELECT quantity FROM stock_levels WHERE variant_id = v.id AND warehouse_id = ${d.warehouse_id}), 0)::int AS current_quantity
    FROM stock_document_lines l
    JOIN product_variants v ON v.id = l.variant_id
    JOIN products p ON p.id = v.product_id
    LEFT JOIN colors col ON col.slug = v.color
    WHERE l.document_id = ${id} ORDER BY l.id`;
  const total = lines.reduce((s, l) => s + l.quantity * (l.unit_cost || 0), 0);
  return { ...d, type_label: DOCUMENT_TYPES[d.type].label, lines, total_quantity: lines.reduce((s, l) => s + l.quantity, 0), total_cost: Math.round(total * 100) / 100 };
}

function documentInput(b) {
  const type = oneOf(b.type, DOC_TYPES, null);
  if (!type) throw badRequest('Sənəd növü yanlışdır.');
  const warehouseId = int(b.warehouse_id);
  if (!warehouseId) throw badRequest('Anbar seçilməlidir.');
  const target = intOrNull(b.target_warehouse_id);
  if (type === 'transfer' && (!target || target === warehouseId)) throw badRequest('Transfer üçün fərqli təyinat anbarı seçin.');
  const lines = (Array.isArray(b.lines) ? b.lines : [])
    .map((l) => ({ variant_id: int(l.variant_id), quantity: int(l.quantity), unit_cost: numOrNull(l.unit_cost), note: str(l.note, 200) }))
    .filter((l) => l.variant_id && (l.quantity > 0 || (type === 'adjustment' && l.quantity === 0)));
  if (lines.some((l) => l.quantity < 0)) throw badRequest('Miqdar mənfi ola bilməz.');
  return {
    doc: {
      type,
      warehouse_id: warehouseId,
      target_warehouse_id: type === 'transfer' ? target : null,
      supplier_id: type === 'receipt' ? intOrNull(b.supplier_id) : null,
      reference: str(b.reference, 100),
      note: str(b.note, 1000),
      doc_date: dateOrNull(b.doc_date) || new Date(),
    },
    lines,
  };
}

async function saveLines(tx, docId, lines) {
  await tx`DELETE FROM stock_document_lines WHERE document_id = ${docId}`;
  for (const l of lines) {
    await tx`INSERT INTO stock_document_lines ${sql({ ...l, document_id: docId })}`;
  }
}

export default async function inventoryRoutes(app) {
  app.addHook('onRequest', requirePerm('inventory'));

  // ------------------------------------------------------------- summary
  app.get('/inventory/summary', async () => {
    const [s] = await sql`
      WITH v AS (
        SELECT v.id, p.track_stock, p.cost_price, p.price,
               COALESCE((SELECT SUM(sl.quantity) FROM stock_levels sl JOIN warehouses w ON w.id = sl.warehouse_id AND w.is_active WHERE sl.variant_id = v.id), 0) AS qty,
               COALESCE((SELECT SUM(sl.min_quantity) FROM stock_levels sl WHERE sl.variant_id = v.id), 0) AS min_qty
        FROM product_variants v JOIN products p ON p.id = v.product_id
        WHERE v.is_active AND p.status <> 'archived'
      )
      SELECT COUNT(*)::int AS variants,
             COUNT(*) FILTER (WHERE track_stock)::int AS tracked,
             COALESCE(SUM(qty) FILTER (WHERE qty > 0), 0)::int AS units,
             COALESCE(SUM(qty * COALESCE(cost_price, 0)) FILTER (WHERE qty > 0), 0)::numeric(12,2) AS cost_value,
             COALESCE(SUM(qty * price) FILTER (WHERE qty > 0), 0)::numeric(12,2) AS retail_value,
             COUNT(*) FILTER (WHERE track_stock AND qty <= 0)::int AS out_of_stock,
             COUNT(*) FILTER (WHERE track_stock AND qty > 0 AND qty <= GREATEST(min_qty, 0) + 3)::int AS low_stock
      FROM v`;
    const [{ drafts }] = await sql`SELECT COUNT(*)::int AS drafts FROM stock_documents WHERE status = 'draft'`;
    return { ...s, cost_value: Number(s.cost_value), retail_value: Number(s.retail_value), draft_documents: drafts };
  });

  // ---------------------------------------------------------- warehouses
  app.get('/inventory/warehouses', async () => sql`
    SELECT w.*,
      COALESCE((SELECT SUM(quantity) FROM stock_levels WHERE warehouse_id = w.id AND quantity > 0), 0)::int AS units,
      (SELECT COUNT(*) FROM stock_levels WHERE warehouse_id = w.id AND quantity <> 0)::int AS sku_count
    FROM warehouses w ORDER BY w.is_default DESC, w.name`);

  function warehouseInput(b) {
    return {
      code: required(str(b.code, 20).toUpperCase(), 'Kod'),
      name: required(str(b.name, 120), 'Ad'),
      address: str(b.address, 300),
      is_active: b.is_active === undefined ? true : bool(b.is_active),
    };
  }

  async function setDefault(tx, id) {
    await tx`UPDATE warehouses SET is_default = false WHERE is_default AND id <> ${id}`;
    await tx`UPDATE warehouses SET is_default = true, is_active = true WHERE id = ${id}`;
  }

  app.post('/inventory/warehouses', async (request, reply) => {
    const input = warehouseInput(request.body || {});
    const w = await sql.begin(async (tx) => {
      const [row] = await tx`INSERT INTO warehouses ${sql(input)} RETURNING *`;
      const [{ n }] = await tx`SELECT COUNT(*)::int AS n FROM warehouses WHERE is_default`;
      if (bool(request.body.is_default) || !n) await setDefault(tx, row.id);
      return row;
    });
    await audit(request, 'create', 'warehouse', w.id, w.name);
    reply.status(201);
    return w;
  });

  app.put('/inventory/warehouses/:id', async (request) => {
    const id = int(request.params.id);
    const input = warehouseInput(request.body || {});
    const w = await sql.begin(async (tx) => {
      const [old] = await tx`SELECT * FROM warehouses WHERE id = ${id}`;
      if (!old) throw notFound('Anbar tapılmadı.');
      if (old.is_default && !input.is_active) throw badRequest('Əsas anbar deaktiv edilə bilməz. Əvvəlcə başqa anbarı əsas edin.');
      const [row] = await tx`UPDATE warehouses SET ${sql(input)} WHERE id = ${id} RETURNING *`;
      if (bool(request.body.is_default)) await setDefault(tx, id);
      return row;
    });
    await audit(request, 'update', 'warehouse', id, w.name);
    return w;
  });

  app.delete('/inventory/warehouses/:id', async (request) => {
    const id = int(request.params.id);
    const [w] = await sql`SELECT * FROM warehouses WHERE id = ${id}`;
    if (!w) throw notFound('Anbar tapılmadı.');
    if (w.is_default) throw conflict('Əsas anbar silinə bilməz.');
    const [{ n }] = await sql`
      SELECT ((SELECT COUNT(*) FROM stock_movements WHERE warehouse_id = ${id}) + (SELECT COUNT(*) FROM stock_documents WHERE warehouse_id = ${id} OR target_warehouse_id = ${id}))::int AS n`;
    if (n) throw conflict('Bu anbarın hərəkət tarixçəsi var. Silmək əvəzinə deaktiv edin.');
    await sql`DELETE FROM warehouses WHERE id = ${id}`;
    await audit(request, 'delete', 'warehouse', id, w.name);
    return { success: true };
  });

  // ----------------------------------------------------------- suppliers
  app.get('/inventory/suppliers', async () => sql`
    SELECT s.*, (SELECT COUNT(*)::int FROM stock_documents d WHERE d.supplier_id = s.id) AS document_count
    FROM suppliers s ORDER BY s.is_active DESC, s.name`);

  function supplierInput(b) {
    return {
      name: required(str(b.name, 160), 'Ad'),
      contact_person: str(b.contact_person, 120),
      phone: str(b.phone, 40),
      email: str(b.email, 160),
      address: str(b.address, 300),
      tax_id: str(b.tax_id, 30),
      note: str(b.note, 1000),
      is_active: b.is_active === undefined ? true : bool(b.is_active),
    };
  }

  app.post('/inventory/suppliers', async (request, reply) => {
    const [s] = await sql`INSERT INTO suppliers ${sql(supplierInput(request.body || {}))} RETURNING *`;
    await audit(request, 'create', 'supplier', s.id, s.name);
    reply.status(201);
    return s;
  });

  app.put('/inventory/suppliers/:id', async (request) => {
    const [s] = await sql`UPDATE suppliers SET ${sql(supplierInput(request.body || {}))} WHERE id = ${int(request.params.id)} RETURNING *`;
    if (!s) throw notFound('Təchizatçı tapılmadı.');
    await audit(request, 'update', 'supplier', s.id, s.name);
    return s;
  });

  app.delete('/inventory/suppliers/:id', async (request) => {
    const [s] = await sql`DELETE FROM suppliers WHERE id = ${int(request.params.id)} RETURNING id, name`;
    if (!s) throw notFound('Təchizatçı tapılmadı.');
    await audit(request, 'delete', 'supplier', s.id, s.name);
    return { success: true };
  });

  // --------------------------------------------------------------- stock
  function stockWhere(q) {
    const conds = [sql`v.is_active`, sql`p.status <> 'archived'`];
    if (q.q) {
      const like = `%${String(q.q).slice(0, 80)}%`;
      conds.push(sql`(p.name ILIKE ${like} OR v.sku ILIKE ${like} OR v.barcode = ${String(q.q)})`);
    }
    if (q.product_id) conds.push(sql`v.product_id = ${int(q.product_id)}`);
    if (q.tracked === '1') conds.push(sql`p.track_stock`);
    const totalExpr = sql`COALESCE((SELECT SUM(sl.quantity) FROM stock_levels sl JOIN warehouses w ON w.id = sl.warehouse_id AND w.is_active WHERE sl.variant_id = v.id), 0)`;
    const minExpr = sql`COALESCE((SELECT SUM(sl.min_quantity) FROM stock_levels sl WHERE sl.variant_id = v.id), 0)`;
    if (q.filter === 'out') conds.push(sql`p.track_stock AND ${totalExpr} <= 0`);
    if (q.filter === 'low') conds.push(sql`p.track_stock AND ${totalExpr} > 0 AND ${totalExpr} <= GREATEST(${minExpr}, 0) + 3`);
    if (q.filter === 'in') conds.push(sql`${totalExpr} > 0`);
    if (q.filter === 'negative') conds.push(sql`EXISTS (SELECT 1 FROM stock_levels sl WHERE sl.variant_id = v.id AND sl.quantity < 0)`);
    return conds.reduce((a, c) => sql`${a} AND ${c}`);
  }

  app.get('/inventory/stock', async (request) => {
    const { page, perPage, offset } = pageParams(request.query, 50);
    const where = stockWhere(request.query);
    const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM product_variants v JOIN products p ON p.id = v.product_id WHERE ${where}`;
    const rows = await variantRows(where, { limit: perPage, offset });
    return { total, page, per_page: perPage, items: rows.map(presentVariant) };
  });

  app.get('/inventory/stock.csv', async (request, reply) => {
    const warehouses = await sql`SELECT id, name FROM warehouses WHERE is_active ORDER BY is_default DESC, name`;
    const rows = await variantRows(stockWhere(request.query), { limit: 100000 });
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['SKU', 'Məhsul', 'Rəng', 'Ölçü', 'Barkod', ...warehouses.map((w) => w.name), 'Cəmi', 'Maya dəyəri', 'Qiymət'];
    const lines = rows.map((r) => [
      r.sku, r.product_name, r.color_name || r.color, r.size, r.barcode,
      ...warehouses.map((w) => r.levels[w.id]?.quantity ?? 0), r.total, r.cost_price ?? '', r.price,
    ].map(esc).join(';'));
    const csv = '﻿' + [header.map(esc).join(';'), ...lines].join('\r\n');
    return reply
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="anbar-qaliqlari-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(csv);
  });

  app.put('/inventory/stock/:variantId/:warehouseId', async (request) => {
    const variantId = int(request.params.variantId);
    const warehouseId = int(request.params.warehouseId);
    const [lvl] = await sql`
      INSERT INTO stock_levels (variant_id, warehouse_id, quantity, min_quantity, bin_location)
      VALUES (${variantId}, ${warehouseId}, 0, ${Math.max(0, int(request.body?.min_quantity))}, ${str(request.body?.bin_location, 60)})
      ON CONFLICT (variant_id, warehouse_id) DO UPDATE SET min_quantity = EXCLUDED.min_quantity, bin_location = EXCLUDED.bin_location, updated_at = now()
      RETURNING *`;
    return lvl;
  });

  // Variant search for document line pickers.
  app.get('/inventory/variants', async (request) => {
    const q = String(request.query.q || '').trim();
    const conds = [sql`v.is_active`];
    if (q) {
      const like = `%${q.slice(0, 80)}%`;
      conds.push(sql`(p.name ILIKE ${like} OR v.sku ILIKE ${like} OR v.barcode = ${q})`);
    }
    if (request.query.product_id) conds.push(sql`v.product_id = ${int(request.query.product_id)}`);
    const rows = await variantRows(conds.reduce((a, c) => sql`${a} AND ${c}`), { limit: 30 });
    return rows.map(presentVariant);
  });

  /**
   * One-step stock operation from the product screen: creates and posts a
   * single-line document so the change stays traceable.
   * mode: receipt (+qty) | issue (−qty) | set (count to exact qty)
   */
  app.post('/inventory/quick', async (request) => {
    const b = request.body || {};
    const mode = oneOf(b.mode, ['receipt', 'issue', 'set'], null);
    if (!mode) throw badRequest('Əməliyyat növü yanlışdır.');
    const quantity = int(b.quantity, -1);
    if (quantity < 0 || (mode !== 'set' && quantity === 0)) throw badRequest('Miqdar düzgün deyil.');
    const type = mode === 'set' ? 'adjustment' : mode;
    const doc = await sql.begin(async (tx) => {
      const { id, docNo } = await nextDocumentNumber(tx, type);
      await tx`
        INSERT INTO stock_documents (id, doc_no, type, warehouse_id, supplier_id, reference, note, created_by)
        VALUES (${id}, ${docNo}, ${type}, ${int(b.warehouse_id)}, ${type === 'receipt' ? intOrNull(b.supplier_id) : null}, ${str(b.reference, 100)}, ${str(b.note, 500) || 'Sürətli əməliyyat'}, ${request.user.id})`;
      await tx`INSERT INTO stock_document_lines (document_id, variant_id, quantity, unit_cost) VALUES (${id}, ${int(b.variant_id)}, ${quantity}, ${numOrNull(b.unit_cost)})`;
      return postDocument(tx, id, request.user.id);
    });
    await audit(request, 'post', 'stock_document', doc.id, `${doc.doc_no} (sürətli)`);
    return loadDocument(doc.id);
  });

  // ----------------------------------------------------------- movements
  app.get('/inventory/movements', async (request) => {
    const { page, perPage, offset } = pageParams(request.query, 50);
    const q = request.query;
    const conds = [sql`TRUE`];
    if (q.variant_id) conds.push(sql`sm.variant_id = ${int(q.variant_id)}`);
    if (q.product_id) conds.push(sql`v.product_id = ${int(q.product_id)}`);
    if (q.warehouse_id) conds.push(sql`sm.warehouse_id = ${int(q.warehouse_id)}`);
    if (MOVEMENT_LABELS[q.type]) conds.push(sql`sm.type = ${q.type}`);
    if (q.q) {
      const like = `%${String(q.q).slice(0, 80)}%`;
      conds.push(sql`(p.name ILIKE ${like} OR v.sku ILIKE ${like} OR sm.note ILIKE ${like})`);
    }
    const from = dateOrNull(q.from);
    const to = dateOrNull(q.to);
    if (from) conds.push(sql`sm.created_at >= ${from}`);
    if (to) conds.push(sql`sm.created_at < ${new Date(to.getTime() + 86400_000)}`);
    const where = conds.reduce((a, c) => sql`${a} AND ${c}`);
    const base = sql`
      FROM stock_movements sm
      JOIN product_variants v ON v.id = sm.variant_id
      JOIN products p ON p.id = v.product_id
      JOIN warehouses w ON w.id = sm.warehouse_id
      LEFT JOIN stock_documents d ON d.id = sm.document_id
      LEFT JOIN users u ON u.id = sm.user_id
      LEFT JOIN colors col ON col.slug = v.color
      WHERE ${where}`;
    const [{ total }] = await sql`SELECT COUNT(*)::int AS total ${base}`;
    const items = await sql`
      SELECT sm.*, v.sku, v.color, v.size, p.name AS product_name, w.name AS warehouse_name,
             d.doc_no, u.username, col.name AS color_name
      ${base}
      ORDER BY sm.created_at DESC, sm.id DESC LIMIT ${perPage} OFFSET ${offset}`;
    return { total, page, per_page: perPage, items: items.map((m) => ({ ...m, type_label: MOVEMENT_LABELS[m.type] })) };
  });

  // ----------------------------------------------------------- documents
  app.get('/inventory/documents', async (request) => {
    const { page, perPage, offset } = pageParams(request.query);
    const q = request.query;
    const conds = [sql`TRUE`];
    if (DOC_TYPES.includes(q.type)) conds.push(sql`d.type = ${q.type}`);
    if (['draft', 'posted', 'cancelled'].includes(q.status)) conds.push(sql`d.status = ${q.status}`);
    if (q.warehouse_id) conds.push(sql`(d.warehouse_id = ${int(q.warehouse_id)} OR d.target_warehouse_id = ${int(q.warehouse_id)})`);
    if (q.q) {
      const like = `%${String(q.q).slice(0, 80)}%`;
      conds.push(sql`(d.doc_no ILIKE ${like} OR d.reference ILIKE ${like} OR d.note ILIKE ${like})`);
    }
    const where = conds.reduce((a, c) => sql`${a} AND ${c}`);
    const [{ total }] = await sql`SELECT COUNT(*)::int AS total FROM stock_documents d WHERE ${where}`;
    const items = await sql`
      SELECT d.*, w.name AS warehouse_name, tw.name AS target_warehouse_name, s.name AS supplier_name, u.username AS created_by_name,
             (SELECT COUNT(*)::int FROM stock_document_lines l WHERE l.document_id = d.id) AS line_count,
             (SELECT COALESCE(SUM(l.quantity), 0)::int FROM stock_document_lines l WHERE l.document_id = d.id) AS total_quantity
      FROM stock_documents d
      JOIN warehouses w ON w.id = d.warehouse_id
      LEFT JOIN warehouses tw ON tw.id = d.target_warehouse_id
      LEFT JOIN suppliers s ON s.id = d.supplier_id
      LEFT JOIN users u ON u.id = d.created_by
      WHERE ${where}
      ORDER BY d.created_at DESC, d.id DESC LIMIT ${perPage} OFFSET ${offset}`;
    return { total, page, per_page: perPage, items: items.map((d) => ({ ...d, type_label: DOCUMENT_TYPES[d.type].label })) };
  });

  app.get('/inventory/documents/:id', async (request) => loadDocument(int(request.params.id)));

  app.post('/inventory/documents', async (request, reply) => {
    const { doc, lines } = documentInput(request.body || {});
    const post = bool(request.body.post);
    const id = await sql.begin(async (tx) => {
      const { id: newId, docNo } = await nextDocumentNumber(tx, doc.type);
      await tx`INSERT INTO stock_documents ${sql({ ...doc, id: newId, doc_no: docNo, created_by: request.user.id })}`;
      await saveLines(tx, newId, lines);
      if (post) await postDocument(tx, newId, request.user.id);
      return newId;
    });
    const d = await loadDocument(id);
    await audit(request, post ? 'post' : 'create', 'stock_document', id, d.doc_no);
    reply.status(201);
    return d;
  });

  app.put('/inventory/documents/:id', async (request) => {
    const id = int(request.params.id);
    const { doc, lines } = documentInput(request.body || {});
    const post = bool(request.body.post);
    await sql.begin(async (tx) => {
      const [old] = await tx`SELECT status, type FROM stock_documents WHERE id = ${id} FOR UPDATE`;
      if (!old) throw notFound('Sənəd tapılmadı.');
      if (old.status !== 'draft') throw conflict('Təsdiqlənmiş sənəd dəyişdirilə bilməz.');
      if (old.type !== doc.type) throw badRequest('Sənəd növü dəyişdirilə bilməz.');
      await tx`UPDATE stock_documents SET ${sql(doc)}, updated_at = now() WHERE id = ${id}`;
      await saveLines(tx, id, lines);
      if (post) await postDocument(tx, id, request.user.id);
    });
    const d = await loadDocument(id);
    await audit(request, post ? 'post' : 'update', 'stock_document', id, d.doc_no);
    return d;
  });

  app.post('/inventory/documents/:id/post', async (request) => {
    const id = int(request.params.id);
    await sql.begin((tx) => postDocument(tx, id, request.user.id));
    const d = await loadDocument(id);
    await audit(request, 'post', 'stock_document', id, d.doc_no);
    return d;
  });

  app.post('/inventory/documents/:id/cancel', async (request) => {
    const id = int(request.params.id);
    const [d] = await sql`UPDATE stock_documents SET status = 'cancelled', updated_at = now() WHERE id = ${id} AND status = 'draft' RETURNING doc_no`;
    if (!d) throw conflict('Yalnız qaralama sənəd ləğv edilə bilər. Təsdiqlənmiş sənədi düzəltmək üçün əks sənəd yaradın.');
    await audit(request, 'cancel', 'stock_document', id, d.doc_no);
    return loadDocument(id);
  });

  /**
   * Posted documents are immutable; "reverse" creates and posts the opposite
   * document (receipt ↔ issue, transfer back) so history stays auditable.
   */
  app.post('/inventory/documents/:id/reverse', async (request) => {
    const src = await loadDocument(int(request.params.id));
    if (src.status !== 'posted') throw conflict('Yalnız təsdiqlənmiş sənəd üçün əks sənəd yaradıla bilər.');
    if (src.type === 'adjustment') throw conflict('İnventarizasiya sənədini geri qaytarmaq üçün yeni inventarizasiya aparın.');
    const type = src.type === 'receipt' ? 'issue' : src.type === 'issue' ? 'receipt' : 'transfer';
    const id = await sql.begin(async (tx) => {
      const { id: newId, docNo } = await nextDocumentNumber(tx, type);
      await tx`
        INSERT INTO stock_documents (id, doc_no, type, warehouse_id, target_warehouse_id, reference, note, created_by)
        VALUES (${newId}, ${docNo}, ${type},
                ${src.type === 'transfer' ? src.target_warehouse_id : src.warehouse_id},
                ${src.type === 'transfer' ? src.warehouse_id : null},
                ${src.doc_no}, ${`${src.doc_no} sənədinin əksi`}, ${request.user.id})`;
      await saveLines(tx, newId, src.lines.map((l) => ({ variant_id: l.variant_id, quantity: l.quantity, unit_cost: l.unit_cost, note: '' })));
      await postDocument(tx, newId, request.user.id);
      return newId;
    });
    const d = await loadDocument(id);
    await audit(request, 'reverse', 'stock_document', src.id, `${src.doc_no} → ${d.doc_no}`);
    return d;
  });

  app.delete('/inventory/documents/:id', async (request) => {
    const id = int(request.params.id);
    const [d] = await sql`DELETE FROM stock_documents WHERE id = ${id} AND status <> 'posted' RETURNING doc_no`;
    if (!d) throw conflict('Təsdiqlənmiş sənəd silinə bilməz.');
    await audit(request, 'delete', 'stock_document', id, d.doc_no);
    return { success: true };
  });

}
