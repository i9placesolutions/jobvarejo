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


FONT_FACES = {
    "barlow": ("Barlow", [
        ("Barlow-Regular.ttf", 400),
        ("Barlow-SemiBold.ttf", 600),
        ("Barlow-Bold.ttf", 700),
        ("Barlow-ExtraBold.ttf", 800),
        ("Barlow-Black.ttf", 900),
    ]),
    "barlowcondensed": ("Barlow Condensed", [
        ("BarlowCondensed-Regular.ttf", 400),
        ("BarlowCondensed-SemiBold.ttf", 600),
        ("BarlowCondensed-Bold.ttf", 700),
        ("BarlowCondensed-ExtraBold.ttf", 800),
    ]),
    "inter": ("Inter", [("Inter-Variable.ttf", "100 900")]),
    "anton": ("Anton", [("Anton-Regular.ttf", 400)]),
    "audiowide": ("Audiowide", [("Audiowide-Regular.ttf", 400)]),
    "bebasneue": ("Bebas Neue", [("BebasNeue-Regular.ttf", 400)]),
    "caveat": ("Caveat", [("Caveat[wght].ttf", "100 900")]),
    "consumidorreferencia": ("Consumidor Referencia", [("ConsumidorReferencia-Regular.ttf", 400)]),
    "knewave": ("Knewave", [("Knewave-Regular.ttf", 400)]),
    "montserrat": ("Montserrat", [("Montserrat[wght].ttf", "100 900")]),
    "oswald": ("Oswald", [("Oswald[wght].ttf", "200 900")]),
    "patuaone": ("Patua One", [("PatuaOne-Regular.ttf", 400)]),
    "robotoslab": ("Roboto Slab", [("RobotoSlab[wght].ttf", "100 900")]),
    "russoone": ("Russo One", [("RussoOne-Regular.ttf", 400)]),
}
SYSTEM_FONT_FAMILIES = {
    "arial", "courier", "couriernew", "georgia", "monospace", "sansserif",
    "serif", "systemui", "times", "timesnewroman", "verdana",
}


def fail(message: str) -> None:
    raise ValueError(message)


def _font_directory_candidates(worker_file: Path = Path(__file__)):
    repository_root = worker_file.resolve().parents[2]
    return (
        repository_root / "public/art-studio/fonts",
        repository_root / ".output/public/art-studio/fonts",
    )


def _font_file(filename: str, worker_file: Path = Path(__file__)) -> Path:
    for directory in _font_directory_candidates(worker_file):
        candidate = directory / filename
        if candidate.is_file():
            return candidate
    fail(f"Arquivo de fonte essencial não encontrado: {filename}.")


def _font_family_key(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").strip().strip("'\"").lower())


def _requested_font_families(canvas):
    requested = {"barlow", "inter"}

    def visit(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ("fontFamily", "prodNameFont") and isinstance(child, str) and child.strip():
                    family_key = _font_family_key(child.split(",", 1)[0])
                    if family_key not in SYSTEM_FONT_FAMILIES:
                        requested.add(family_key)
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    # The catalog embeds many unused label templates. Only the objects that
    # will actually render may require a bundled font.
    visit(canvas.get("objects", []))
    templates = canvas.get("__labelTemplates", [])
    selected_ids = {"tpl_default"}
    for obj in _visit_objects(canvas.get("objects", [])):
        if obj.get("isProductZone") or obj.get("isGridZone"):
            styles = obj.get("_zoneGlobalStyles") or {}
            selected_ids.add(str(styles.get("splashTemplateId") or obj.get("_zoneTemplateSnapshotId") or "tpl_default"))
    for template in templates if isinstance(templates, list) else []:
        if str(template.get("id")) in selected_ids:
            visit(template.get("group"))
    # Generic browser font families do not have asset files in the catalog.
    requested.difference_update({"arial", "helvetica", "sansserif", "serif", "georgia", "timesnewroman", "monospace"})
    return requested


def _font_stylesheet(canvas, worker_file: Path = Path(__file__)):
    requested = _requested_font_families(canvas)
    css = []
    descriptors = []
    for key in sorted(requested):
        family = FONT_FACES.get(key)
        if family is None:
            fail(f"A fonte solicitada pelo modelo não está disponível localmente: {key or '(vazia)'}.")
        family_name, faces = family
        for filename, weight in faces:
            path = _font_file(filename, worker_file)
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            css.append(
                "@font-face{" +
                f"font-family:{json.dumps(family_name)};font-style:normal;" +
                f"font-weight:{weight};font-display:block;src:url(data:font/ttf;base64,{encoded}) format('truetype')" +
                "}"
            )
            descriptors.append({"family": family_name, "weight": weight})
    return "\n".join(css), descriptors


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
      "formatId": payload.get("formatId"),
      "width": page_size[0],
      "height": page_size[1],
    }
    font_css, font_descriptors = _font_stylesheet(canvas)
    html = """<!doctype html><html><head><meta charset=\"utf-8\"><style>%s</style></head><body>
      <canvas id=\"canvas\"></canvas><script>window.__RENDER_INPUT__ = %s;</script>
      </body></html>""" % (font_css, json.dumps(browser_payload, ensure_ascii=False).replace("</", "<\\/"))

    output = []
    with sync_playwright() as playwright:
        browser_path = os.environ.get("WHATSAPP_CREATION_CHROMIUM_EXECUTABLE")
        browser = playwright.chromium.launch(headless=True, executable_path=browser_path,
                                             args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": page_size[0], "height": page_size[1]}, device_scale_factor=1)
        page.route("**/*", lambda route: route.abort() if route.request.url.startswith(("http://", "https://")) else route.continue_())
        page.set_content(html, wait_until="load")
        page.evaluate("""async descriptors => {
          const essential = ['Barlow', 'Inter'];
          const loadedFaces = await Promise.all(descriptors.map(face => document.fonts.load(`${face.weight === '100 900' || face.weight === '200 900' ? '700' : face.weight} 32px \"${face.family}\"`, 'Font check 123')));
          await document.fonts.ready;
          const ctx = document.createElement('canvas').getContext('2d');
          const measured = {};
          for (const family of essential) {
            if (!descriptors.some((face, index) => face.family === family && loadedFaces[index].length > 0)) {
              throw new Error(`Fonte essencial não foi carregada no Chromium: ${family}.`);
            }
            const loaded = document.fonts.check(`700 32px \"${family}\"`, 'Font check 123');
            ctx.font = `700 32px \"${family}\"`;
            const width = ctx.measureText('Font check 123').width;
            if (!loaded || !Number.isFinite(width) || width <= 0) throw new Error(`Fonte essencial indisponível no Chromium: ${family}.`);
            measured[family] = width;
          }
          return measured;
        }""", font_descriptors)
        page.add_script_tag(path=str(fabric_path))
        native_layout_path = Path(__file__).with_name("native-layout.js")
        if not native_layout_path.is_file():
            fail("Regras nativas do Editor Rápido indisponíveis para renderização.")
        page.add_script_tag(path=str(native_layout_path))
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
            // Fabric can omit custom flags when loading sparse or older saved
            // objects. The persisted zone recipe remains the source of truth.
            all.forEach((object, index) => {
              const saved = source.objects[index] || {};
              for (const key of ['name', 'isProductZone', 'isGridZone', 'isFrame', '_customId',
                '_zoneGlobalStyles', '_zoneStateSnapshot', '_zonePadding',
                '_zoneTemplateSnapshot', '_zoneTemplateSnapshotId',
                'structureByProductCount', 'structureByProductCountByPreviewFormat',
                'structureVariantsByProductCountByPreviewFormat',
                'structureVariantByProductCountByPreviewFormat',
                'quickValidityLayout', 'dynamicFieldBaseFontSize', 'parentFrameId']) {
                if (saved[key] !== undefined) object[key] = saved[key];
              }
            });
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
            if (!zones.length) throw new Error(`Fabric não carregou a zona de produtos (${all.length}/${source.objects.length} objetos).`);
            const cards = all.filter(o => o.isProductCard === true || o.name === 'productCard');
            cards.forEach(o => c.remove(o));
            const instagram = all.find(o => o.name === 'header-instagram' && typeof o.text === 'string');
            if (instagram && instagram.visible !== false) {
              const panel = all.find(o => o.name === 'header-instagram-panel');
              const panelBounds = panel?.getBoundingRect();
              const maxRight = Math.min(input.width - 20, panelBounds ? panelBounds.left + panelBounds.width - 12 : input.width - 20);
              const available = Math.max(40, maxRight - instagram.getBoundingRect().left);
              const measure = new fabric.Text(instagram.text, {
                fontFamily: instagram.fontFamily, fontWeight: instagram.fontWeight,
                fontSize: instagram.fontSize, charSpacing: instagram.charSpacing
              });
              const ratio = Math.min(1, available / Math.max(1, measure.width));
              instagram.set({width: available, fontSize: Math.max(10, Number(instagram.fontSize || 20) * ratio)});
              instagram.initDimensions?.();
              instagram.setCoords();
            }
            const validity = all.find(o => o.name === 'header-validity');
            if (validity) {
              if (!String(validity.text || '').trim()) validity.visible = false;
              else if (validity.quickValidityLayout === 'inline-footer') {
                JobVarejoNative.layoutInlineFooterValidity(all);
              } else {
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
                  const zone = sortedZones[0];
                  const bounds = zone.getBoundingRect();
                  const departmentHeaderHeight = entry.department ? Math.min(44, bounds.height * .06) : 0;
                  const contentBounds = {left: bounds.left, top: bounds.top + departmentHeaderHeight,
                    width: bounds.width, height: bounds.height - departmentHeaderHeight};
                  const count = entry.products.length;
                  const format = String(input.formatId || '').toLowerCase() === 'stories' ? 'story'
                    : String(input.formatId || '').toLowerCase() === 'square' ? 'post'
                    : String(input.formatId || '').toLowerCase() === 'tv' ? 'banner'
                    : String(input.formatId || '').toLowerCase() === 'print' ? 'a4' : 'feed';
                  const recipe = JobVarejoNative.resolveProductZoneStructure(zone, count, format) || {};
                  const padding = Number(recipe.padding ?? zone._zonePadding ?? zone.padding ?? 20);
                  const gapX = Number(recipe.gapHorizontal ?? zone.gapHorizontal ?? 15);
                  const gapY = Number(recipe.gapVertical ?? zone.gapVertical ?? 15);
                  const grid = JobVarejoNative.calculateGridLayout({
                    x: contentBounds.left, y: contentBounds.top,
                    width: contentBounds.width, height: contentBounds.height,
                    padding, gapHorizontal: gapX, gapVertical: gapY,
                    columns: recipe.columns ?? zone.columns ?? 0,
                    rows: recipe.rows ?? zone.rows ?? 0,
                    layoutDirection: recipe.layoutDirection ?? zone.layoutDirection ?? 'horizontal',
                    cardAspectRatio: recipe.cardAspectRatio ?? zone.cardAspectRatio ?? 'fill',
                    lastRowBehavior: recipe.lastRowBehavior ?? zone.lastRowBehavior ?? 'fill',
                    verticalAlign: recipe.verticalAlign ?? zone.verticalAlign ?? 'stretch'
                  }, count, format);
                  const columns = grid.cols;
                  const cellWidth = grid.itemWidth;
                  const cellHeight = grid.itemHeight;
                  if (cellWidth < 40 || cellHeight < 40) throw new Error('A estrutura salva não comporta estes produtos.');
                  const slots = Array.from({length: count}, (_, index) => ({
                    zoneIndex: 0,
                    left: contentBounds.left + padding + (index % columns) * (cellWidth + gapX),
                    top: contentBounds.top + padding + Math.floor(index / columns) * (cellHeight + gapY),
                    width: cellWidth,
                    height: cellHeight
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
              const palette = {...(styles.templateProductPalette || {}), ...(styles.productPalette || {})};
              const format = String(input.formatId || '').toLowerCase() === 'stories' ? 'story'
                : String(input.formatId || '').toLowerCase() === 'square' ? 'post'
                : String(input.formatId || '').toLowerCase() === 'tv' ? 'banner'
                : String(input.formatId || '').toLowerCase() === 'print' ? 'a4' : 'feed';
              const recipe = zone.structureByProductCountByPreviewFormat?.[format]?.[String(entry.products.length)]
                || zone.structureByProductCount?.[String(entry.products.length)] || {};
              const highlighted = Number(recipe.highlightCount || 0) > 0 &&
                (recipe.highlightIndexes || []).includes(i + 1);
              const cardColor = styles.isProdBgTransparent ? 'transparent'
                : styles.cardColorMode === 'manual' ? (styles.cardColor || '#ffffff')
                : highlighted ? (palette.highlightCardColor || styles.highlightCardColor || '#ffffff')
                : (palette.cardColor || styles.cardColor || '#ffffff');
              const nameColor = highlighted ? (palette.highlightProdNameColor || styles.prodNameColor || '#111111')
                : (palette.prodNameColor || styles.prodNameColor || '#111111');
              const bg = new fabric.Rect({left: 0, top: 0, originX: 'center', originY: 'center', width, height,
                fill: cardColor, stroke: styles.cardBorderColor || '#000000', strokeWidth: Number(styles.cardBorderWidth ?? 0),
                rx: Number(styles.cardBorderRadius ?? 8), ry: Number(styles.cardBorderRadius ?? 8),
                selectable: false, evented: false, name: 'offerBackground'});
              const children = [bg];
              if (product.imageDataUrl) {
                const image = await fabric.FabricImage.fromURL(product.imageDataUrl, {crossOrigin: 'anonymous'});
                const scale = Math.min(width * .85 / image.width, height * .5 / image.height);
                image.set({left: 0, top: 0, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale,
                  selectable: true, evented: true, name: 'smart_image'});
                children.push(image);
              }
              const titleText = [product.name, product.brand, product.variant, product.weight].filter(Boolean).join(' ');
              const title = new fabric.Textbox(styles.prodNameTransform === 'upper' ? titleText.toLocaleUpperCase('pt-BR') : titleText, {
                left: 0, top: -height * .45 + Number(styles.prodNameOffsetY || 0), originX: 'center', originY: 'top',
                width: width - 20, fontFamily: styles.prodNameFont || 'Arial',
                fontSize: Math.max(10, Math.min(width, height) * .09 * Number(styles.prodNameScale || 1)),
                fontWeight: styles.prodNameWeight || 900, lineHeight: Number(styles.prodNameLineHeight || 1),
                textAlign: styles.prodNameAlign || 'center', fill: nameColor,
                selectable: true, evented: true, name: 'smart_title'});
              children.push(title);
              if (product.condition) children.push(new fabric.Textbox(product.condition, {
                left: 0, top: -height * .45 + title.getScaledHeight() + Math.max(4, height * .015),
                originX: 'center', originY: 'top', width: width * .9,
                fontFamily: styles.prodNameFont || 'Arial', fontSize: Math.max(10, Math.min(width, height) * .045),
                fontWeight: 900, textAlign: 'center', fill: styles.limitColor || '#ef4444',
                selectable: true, evented: true, name: 'smart_limit'}));
              const labelId = String(styles.splashTemplateId || zone._zoneTemplateSnapshotId || '').trim();
              const templates = input.canvas.__labelTemplates || [];
              const template = labelId ? templates.find(item => String(item.id) === labelId) : templates.find(item => item.id === 'tpl_default');
              const savedLabel = template?.group || zone._zoneTemplateSnapshot || zone._zoneStateSnapshot?.labelTemplate?.snapshot;
              if (!savedLabel || !Array.isArray(savedLabel.objects)) throw new Error('O modelo não tem etiqueta nativa editável para preencher.');
              const labelJson = JSON.parse(JSON.stringify(savedLabel));
              const price = String(product.price || '').trim().replace(/^R\$\s*/i, '').replace(/^(\d+)\.(\d{2})$/, '$1,$2');
              const walkLabel = nodes => {
                for (const node of nodes || []) {
                  const name = String(node.name || '');
                  if (name === 'price_value_text' || name === 'smart_price') node.text = price;
                  if (name === 'price_integer_text' || name === 'priceInteger') node.text = price.split(',')[0];
                  if (name === 'price_decimal_text' || name === 'priceDecimal') node.text = ',' + (price.split(',')[1] || '00');
                  if (name === 'price_unit_text' || name === 'priceUnit') { node.text = product.unit || ''; node.visible = !!product.unit; }
                  walkLabel(node.objects);
                }
              };
              walkLabel(labelJson.objects);
              const [label] = await fabric.util.enlivenObjects([labelJson]);
              const restoreNames = (live, saved) => {
                if (saved.name) live.set('name', saved.name);
                (live.getObjects?.() || []).forEach((child, index) => restoreNames(child, saved.objects?.[index] || {}));
              };
              restoreNames(label, labelJson);
              const labelScale = Math.min(width * .64 / Math.max(1, label.width), height * .18 / Math.max(1, label.height));
              label.set({left: 0, top: height / 2 - label.height * labelScale / 2 - height * .05,
                originX: 'center', originY: 'center', scaleX: labelScale, scaleY: labelScale,
                selectable: true, evented: true, name: 'priceGroup'});
              children.push(label);
              const card = new fabric.Group(children, {
                left: left + width / 2, top: top + height / 2, originX: 'center', originY: 'center',
                name: 'product-card', isSmartObject: true, isProductCard: true,
                parentZoneId: zone._customId || zone.id || zone.name,
                productZoneId: zone._customId || zone.id || zone.name,
                productItemId: product.id, _zoneOrder: i, _cardWidth: width, _cardHeight: height,
                _productData: {...product, imageDataUrl: undefined},
                __cardLabelTemplateId: labelId || 'tpl_default',
                subTargetCheck: true, interactive: true, selectable: true, evented: true,
                objectCaching: false});
              c.add(card);
              JobVarejoNative.fitResponsiveProductTypography(card, width, height, Number(styles.prodNameScale ?? 1), false);
              zone.contentStatus = 'filled';
              if (zone._zoneStateSnapshot?.zone) zone._zoneStateSnapshot.zone.contentStatus = 'filled';
            }
            JobVarejoNative.harmonizeProductCardTypography(c.getObjects().filter(o => o.isProductCard === true));
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
            ['isProductZone','isGridZone','isProductCard','isSmartObject','productItemId','productZoneId','parentZoneId','_zoneOrder','_cardWidth','_cardHeight','_productData','__cardLabelTemplateId','name','businessProfileField','quickLogoSlot','quickLogoBackdrop','excludeFromExport','isFrame','clipContent','parentFrameId','_customId','_zoneGlobalStyles','_productGridConfig','rows','columns','gridRows','gridColumns','productsPerRow','contentStatus'].forEach(key => preservedKeys.add(key));
            // toJSON() is Fabric's no-argument JSON.stringify alias; use toObject()
            // when serializing the editable custom metadata required by the editor.
            const data = JSON.parse(JSON.stringify(c.toObject([...preservedKeys])));
            data.__labelTemplates = input.canvas.__labelTemplates || [];
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
