#!/usr/bin/env python3
"""Render one or more editable retail flyer pages with the bundled Fabric.js."""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright


def fail(message: str) -> None:
    raise ValueError(message)


def _visit_objects(nodes):
    for node in nodes if isinstance(nodes, list) else []:
        if isinstance(node, dict):
            yield node
            yield from _visit_objects(node.get("objects", []))


def _promote_logo_slots(canvas):
    """Keep account-owned logo slots visible above source-template artwork."""
    def is_logo_slot(obj):
        field = re.sub(r"[^a-z0-9]+", "", str(obj.get("businessProfileField", "")).lower())
        name = re.sub(r"[^a-z0-9]+", "", str(obj.get("name", "")).lower())
        return obj.get("quickLogoSlot") is True or field == "logo" or re.match(r"^(?:header|footer|account|business)(?:dynamic)?logo", name) is not None

    if not isinstance(canvas, dict):
        return
    objects = canvas.get("objects")
    if not isinstance(objects, list):
        return

    logo_slots = []
    other_objects = []
    for obj in objects:
        if not isinstance(obj, dict):
            other_objects.append(obj)
            continue
        if is_logo_slot(obj):
            logo_slots.append(obj)
        else:
            _promote_logo_slots(obj)
            other_objects.append(obj)
    if logo_slots:
        canvas["objects"] = other_objects + logo_slots


def _product_groups(products, division, max_slots):
    if division == "department":
        groups = {}
        for product in products:
            department = str(product.get("department") or "").strip()
            if not department:
                fail("Cada produto precisa de departamento para esta divisão.")
            groups.setdefault(department, []).append(product)
    else:
        groups = {"": products}

    result = []
    for label, group in groups.items():
        if division == "single" and len(group) > max_slots:
            fail(f"O modelo comporta {max_slots} produtos por página; escolha divisão em páginas.")
        if division in ("pages", "department"):
            for index in range(0, len(group), max_slots):
                result.append((label, group[index:index + max_slots]))
        else:
            result.append((label, group))
    return result


def _zone_slots(zones, capacity):
    if len(zones) > 1:
        return [{"zoneIndex": index, "left": 0, "top": 0, "width": 0, "height": 0}
                for index in range(min(len(zones), capacity))]

    zone = zones[0]
    width = float(zone.get("width", 0)) * float(zone.get("scaleX", 1) or 1)
    height = float(zone.get("height", 0)) * float(zone.get("scaleY", 1) or 1)
    origin_x, origin_y = zone.get("originX", "left"), zone.get("originY", "top")
    left = float(zone.get("left", 0)) - (width / 2 if origin_x == "center" else width if origin_x == "right" else 0)
    top = float(zone.get("top", 0)) - (height / 2 if origin_y == "center" else height if origin_y == "bottom" else 0)
    aspect = width / max(1, height)
    columns = max(1, min(capacity, int(math.ceil((capacity * aspect) ** 0.5))))
    rows = (capacity + columns - 1) // columns
    cell_width, cell_height = width / columns, height / rows
    gap = min(max(4, min(width, height) * 0.015), min(cell_width, cell_height) * 0.12)
    return [{
        "zoneIndex": 0,
        "left": left + (index % columns) * cell_width + gap / 2,
        "top": top + (index // columns) * cell_height + gap / 2,
        "width": cell_width - gap,
        "height": cell_height - gap,
    } for index in range(capacity)]


def render(payload, output_dir: Path, fabric_path: Path):
    canvas = payload.get("canvas")
    if not isinstance(canvas, dict) or not isinstance(canvas.get("objects"), list):
        fail("O modelo não contém um canvas Fabric salvo.")
    _promote_logo_slots(canvas)
    products = payload.get("products")
    if not isinstance(products, list) or not products:
        fail("Inclua produtos confirmados no pedido.")
    if any(not isinstance(item, dict) or not item.get("id") for item in products):
        fail("Produto inválido para renderização.")
    division = payload.get("division")
    if division not in ("single", "pages", "department"):
        fail("Escolha uma divisão de produtos antes de renderizar.")

    page_size = (int(canvas.get("width", 0)), int(canvas.get("height", 0)))
    if min(page_size) < 320 or max(page_size) > 8192:
        fail("Dimensões da página fora do limite permitido.")
    story = page_size == (1080, 1920) or str(payload.get("formatId", "")).lower() in ("story", "stories")
    if story and len(products) > 9 and division not in ("pages", "department"):
        fail("Story com mais de nove produtos precisa ser dividido em páginas.")

    zones = [obj for obj in canvas["objects"] if obj.get("isProductZone") is True or obj.get("isGridZone") is True]
    if not zones:
        fail("O modelo não possui área de produtos editável.")
    page_capacity = 9 if story else 16
    max_slots = min(len(zones), page_capacity) if len(zones) > 1 else page_capacity
    groups = _product_groups(products, division, max_slots)
    browser_payload = {
      "canvas": canvas,
      "groups": [{"department": label, "products": group} for label, group in groups],
      "capacity": max_slots,
      "width": page_size[0],
      "height": page_size[1],
    }
    html = """<!doctype html><html><head><meta charset=\"utf-8\"></head><body>
      <canvas id=\"canvas\"></canvas><script>window.__RENDER_INPUT__ = %s;</script>
      </body></html>""" % json.dumps(browser_payload, ensure_ascii=False).replace("</", "<\\/")

    output = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": page_size[0], "height": page_size[1]}, device_scale_factor=1)
        page.route("**/*", lambda route: route.abort() if route.request.url.startswith(("http://", "https://")) else route.continue_())
        page.set_content(html, wait_until="load")
        page.add_script_tag(path=str(fabric_path))
        result = page.evaluate("""async () => {
          const input = window.__RENDER_INPUT__;
          const fabric = window.fabric;
          if (!fabric?.StaticCanvas) throw new Error('Bundle Fabric indisponível.');
          const renderOne = async (entry, pageIndex) => {
            const source = JSON.parse(JSON.stringify(input.canvas));
            const c = new fabric.StaticCanvas(document.createElement('canvas'), {
              width: input.width, height: input.height, renderOnAddRemove: false,
              backgroundColor: source.background || '#ffffff', enableRetinaScaling: false
            });
            await c.loadFromJSON(source);
            const all = c.getObjects();
            const isLogoSlot = o => o.quickLogoSlot === true || String(o.businessProfileField || '').toLowerCase().replace(/[^a-z0-9]+/g, '') === 'logo' || /^(?:header|footer|account|business)(?:dynamic)?logo/.test(String(o.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ''));
            const logoSlots = all.filter(isLogoSlot);
            for (const logo of logoSlots) {
              // The account preview already fitted and trimmed this logo. Keep that geometry.
              if (logo.quickLogoSource) continue;
              const element = logo.getElement?.();
              const naturalWidth = Number(element?.naturalWidth || element?.width || 0);
              const naturalHeight = Number(element?.naturalHeight || element?.height || 0);
              if (!naturalWidth || !naturalHeight || logo.visible === false) continue;
              const maxWidth = Math.max(1, Number(logo.quickLogoMaxWidth) || Number(logo.width) * Math.abs(Number(logo.scaleX) || 1));
              const maxHeight = Math.max(1, Number(logo.quickLogoMaxHeight) || Number(logo.height) * Math.abs(Number(logo.scaleY) || 1));
              const fitScale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
              const center = logo.getCenterPoint();
              const centerX = Number.isFinite(Number(logo.quickLogoCenterX)) ? Number(logo.quickLogoCenterX) : center.x;
              const centerY = Number.isFinite(Number(logo.quickLogoCenterY)) ? Number(logo.quickLogoCenterY) : center.y;
              logo.set({width: naturalWidth, height: naturalHeight, scaleX: fitScale, scaleY: fitScale,
                cropX: 0, cropY: 0, originX: 'left', originY: 'top',
                left: centerX - naturalWidth * fitScale / 2, top: centerY - naturalHeight * fitScale / 2});
              logo.setCoords();
            }
            const zones = all.filter(o => o.isProductZone === true || o.isGridZone === true);
            const cards = all.filter(o => o.isProductCard === true || o.name === 'productCard');
            cards.forEach(o => c.remove(o));
            const validity = all.find(o => o.name === 'header-validity');
            if (validity) {
              if (!String(validity.text || '').trim()) validity.visible = false;
              else {
                const maxWidth = Number(validity.width) * Math.abs(Number(validity.scaleX) || 1);
                const maxHeight = Number(validity.height) * Math.abs(Number(validity.scaleY) || 1);
                let fontSize = Number(validity.fontSize) || 24;
                validity.set({splitByGrapheme: false});
                for (let attempt = 0; attempt < 24; attempt++) {
                  validity.set({fontSize});
                  validity.initDimensions?.();
                  const lineCount = Array.isArray(validity._textLines) ? validity._textLines.length : 1;
                  const measuredHeight = Number(validity.height) * Math.abs(Number(validity.scaleY) || 1);
                  if (lineCount <= 1 && measuredHeight <= maxHeight + 1) break;
                  fontSize *= .88;
                }
                validity.setCoords();
              }
            }
            const sortedZones = zones.sort((a, b) => a.top - b.top || a.left - b.left);
            const zoneSlots = sortedZones.length > 1
              ? sortedZones.slice(0, input.capacity).map((zone, zoneIndex) => {
                  const bounds = zone.getBoundingRect();
                  return {zoneIndex, left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height};
                })
              : (() => {
                  const bounds = sortedZones[0].getBoundingRect();
                  const departmentHeaderHeight = entry.department ? Math.min(44, bounds.height * .06) : 0;
                  const contentBounds = {left: bounds.left, top: bounds.top + departmentHeaderHeight,
                    width: bounds.width, height: bounds.height - departmentHeaderHeight};
                  const aspect = contentBounds.width / Math.max(1, contentBounds.height);
                  const columns = Math.max(1, Math.min(input.capacity, Math.ceil(Math.sqrt(input.capacity * aspect))));
                  const rows = Math.ceil(input.capacity / columns);
                  const cellWidth = contentBounds.width / columns, cellHeight = contentBounds.height / rows;
                  const gap = Math.min(Math.max(4, Math.min(contentBounds.width, contentBounds.height) * .015), Math.min(cellWidth, cellHeight) * .12);
                  const slots = Array.from({length: input.capacity}, (_, index) => ({
                    zoneIndex: 0,
                    left: contentBounds.left + (index % columns) * cellWidth + gap / 2,
                    top: contentBounds.top + Math.floor(index / columns) * cellHeight + gap / 2,
                    width: cellWidth - gap,
                    height: cellHeight - gap
                  }));
                  return slots;
                })();
            const zoneState = sortedZones.map(zone => ({visible: zone.visible, excludeFromExport: zone.excludeFromExport}));
            sortedZones.forEach(zone => { zone.visible = false; zone.excludeFromExport = true; });
            for (let i = 0; i < entry.products.length; i++) {
              const product = entry.products[i], slot = zoneSlots[i], zone = sortedZones[slot?.zoneIndex];
              if (!zone) throw new Error('Não há espaço no modelo para todos os produtos.');
              const left = slot.width ? slot.left : zone.left || 0, top = slot.height ? slot.top : zone.top || 0;
              const width = slot.width || zone.width * (zone.scaleX || 1), height = slot.height || zone.height * (zone.scaleY || 1);
              const styles = zone._zoneGlobalStyles || {};
              const cardColor = styles.cardColor || '#ffffff';
              const cardBorderColor = styles.cardBorderColor || '#dedede';
              const cardBorderRadius = Number(styles.cardBorderRadius || 8);
              const priceColor = styles.splashFill || styles.splashColor || '#d82027';
              const priceTextColor = styles.splashTextColor || styles.priceTextColor || '#ffffff';
              const pad = Math.max(8, Math.min(width, height) * .035);
              c.add(new fabric.Rect({left, top, originX: 'left', originY: 'top', width, height, fill: cardColor, stroke: cardBorderColor, strokeWidth: Number(styles.cardBorderWidth ?? 2),
                rx: Math.min(cardBorderRadius, width * .1), ry: Math.min(cardBorderRadius, height * .1), selectable: true, evented: true,
                isProductCard: true, productItemId: product.id, productZoneId: zone._customId || zone.id || zone.name, name: `product-card-${product.id}`}));
              if (product.imageDataUrl) {
                const image = await fabric.FabricImage.fromURL(product.imageDataUrl, {crossOrigin: 'anonymous'});
                const maxWidth = width - pad * 2, maxHeight = height * .48;
                const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
                image.set({left: left + (width - image.width * scale) / 2, top: top + pad, originX: 'left', originY: 'top', scaleX: scale, scaleY: scale,
                  selectable: true, evented: true, productItemId: product.id, name: `product-image-${product.id}`});
                c.add(image);
              }
              const nameTop = top + height * .54;
              c.add(new fabric.Textbox([product.name, product.brand, product.variant, product.weight].filter(Boolean).join(' · '), {
                left: left + pad, top: nameTop, originX: 'left', originY: 'top', width: width - pad * 2, height: product.condition || product.validity ? height * .14 : height * .19,
                fontFamily: styles.prodNameFont || 'Arial', fontSize: Math.max(14, Math.min(Number(styles.prodNameSize || 30), height * .07)), fontWeight: styles.prodNameWeight || 'bold',
                textAlign: styles.prodNameAlign || 'center', fill: styles.prodNameColor || '#222222', splitByGrapheme: true, selectable: true, evented: true,
                productItemId: product.id, name: `product-name-${product.id}`}));
              const commercialNote = [product.condition, product.validity ? `Válido: ${product.validity}` : ''].filter(Boolean).join(' · ');
              if (commercialNote) c.add(new fabric.Textbox(commercialNote, {left: left + pad, top: top + height * .68, originX: 'left', originY: 'top',
                width: width - pad * 2, height: height * .08, fontFamily: 'Arial', fontSize: Math.max(11, Math.min(18, height * .04)),
                textAlign: 'center', fill: styles.limitColor || '#333333', splitByGrapheme: true, selectable: true, evented: true,
                productItemId: product.id, name: `product-condition-${product.id}`}));
              c.add(new fabric.Rect({left: left + pad, top: top + height * .77, originX: 'left', originY: 'top', width: width - pad * 2, height: height * .17,
                fill: priceColor, rx: 10, ry: 10, selectable: true, evented: true, productItemId: product.id,
                name: `product-price-background-${product.id}`}));
              c.add(new fabric.Textbox(product.price, {left: left + pad * 1.4, top: top + height * .78, originX: 'left', originY: 'top',
                width: width - pad * 2.8, height: height * .15, fontFamily: styles.priceFont || 'Arial', fontSize: Math.max(20, Math.min(Number(styles.priceFontSize || 44), height * .11)),
                fontWeight: 'bold', textAlign: 'center', fill: priceTextColor, selectable: true, evented: true,
                productItemId: product.id, name: `product-price-${product.id}`}));
            }
            if (entry.department && sortedZones.length === 1) {
              const bounds = sortedZones[0].getBoundingRect();
              const labelHeight = Math.min(44, bounds.height * .06);
              const styles = sortedZones[0]._zoneGlobalStyles || {};
              c.add(new fabric.Textbox(entry.department, {left: bounds.left + 10, top: bounds.top + 3, originX: 'left', originY: 'top',
                width: bounds.width - 20, height: Math.max(24, labelHeight - 6), fontFamily: styles.prodNameFont || 'Arial',
                fontSize: Math.min(24, labelHeight * .58), fontWeight: 'bold', textAlign: 'left',
                fill: styles.prodNameColor || '#222222', selectable: true, evented: true, name: `department-${pageIndex + 1}`}));
            }
            c.renderAll();
            const png = c.toDataURL({format: 'png', multiplier: 1, enableRetinaScaling: false});
            sortedZones.forEach((zone, index) => {
              zone.visible = zoneState[index].visible;
              zone.excludeFromExport = zoneState[index].excludeFromExport;
            });
            const preservedKeys = new Set();
            const collect = node => { if (Array.isArray(node)) node.forEach(collect); else if (node && typeof node === 'object') { Object.keys(node).forEach(key => { if (!['group', 'canvas', 'objects', 'layoutManager', 'clipPath'].includes(key)) preservedKeys.add(key); }); Object.values(node).forEach(collect); } };
            collect(input.canvas);
            ['isProductZone','isGridZone','isProductCard','productItemId','productZoneId','name','businessProfileField','quickLogoSlot','quickLogoBackdrop','excludeFromExport','isFrame','clipContent','parentFrameId','_customId','_zoneGlobalStyles','_productGridConfig','rows','columns','gridRows','gridColumns','productsPerRow'].forEach(key => preservedKeys.add(key));
            // toJSON() is Fabric's no-argument JSON.stringify alias; use toObject()
            // when serializing the editable custom metadata required by the editor.
            const data = JSON.parse(JSON.stringify(c.toObject([...preservedKeys])));
            await c.dispose();
            return JSON.stringify({png, canvas: data, productIds: entry.products.map(p => p.id), department: entry.department});
          };
          const pages = [];
          for (let i = 0; i < input.groups.length; i++) pages.push(await renderOne(input.groups[i], i));
          return pages;
        }""")
        if isinstance(result, list):
            result = [json.loads(item) if isinstance(item, str) else item for item in result]
        elif isinstance(result, str):
            result = json.loads(result)
        browser.close()

    for index, page in enumerate(result, 1):
        match = re.fullmatch(r"data:image/png;base64,([A-Za-z0-9+/=]+)", page["png"])
        if not match:
            fail("O renderizador não retornou PNG válido.")
        png = base64.b64decode(match.group(1), validate=True)
        name = f"page-{index}.png"
        canvas_name = f"page-{index}.json"
        (output_dir / name).write_bytes(png)
        (output_dir / canvas_name).write_text(json.dumps(page["canvas"], ensure_ascii=False), encoding="utf-8")
        output.append({"name": name, "canvas": canvas_name, "productIds": page["productIds"], "department": page["department"]})
    return {"pages": output}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    input_path = Path(args.input).resolve()
    output_dir = Path(args.output_dir).resolve()
    if not input_path.is_file() or not output_dir.is_dir():
        fail("Caminho de entrada/saída inválido.")
    worker_dir = Path(__file__).resolve().parent
    fabric_path = Path(os.environ.get("WHATSAPP_CREATION_FABRIC", worker_dir / "fabric.min.js")).resolve()
    if not fabric_path.is_file():
        candidate = worker_dir.parents[1] / "node_modules/fabric/dist/index.min.js"
        if candidate.is_file():
            fabric_path = candidate
        else:
            fail("Bundle Fabric não encontrado no worker.")
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    print(json.dumps(render(payload, output_dir, fabric_path), ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error)[:500], file=sys.stderr)
        sys.exit(2)
