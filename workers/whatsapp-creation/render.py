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
        ("Barlow-Italic.ttf", 400, "italic"),
        ("Barlow-SemiBoldItalic.ttf", 600, "italic"),
        ("Barlow-BoldItalic.ttf", 700, "italic"),
        ("Barlow-ExtraBoldItalic.ttf", 800, "italic"),
        ("Barlow-BlackItalic.ttf", 900, "italic"),
    ]),
    "barlowcondensed": ("Barlow Condensed", [
        ("BarlowCondensed-Regular.ttf", 400),
        ("BarlowCondensed-SemiBold.ttf", 600),
        ("BarlowCondensed-Bold.ttf", 700),
        ("BarlowCondensed-ExtraBold.ttf", 800),
    ]),
    "firasans": ("Fira Sans", [
        ("FiraSans-Light.ttf", 300),
        ("FiraSans-LightItalic.ttf", 300, "italic"),
        ("FiraSans-Regular.ttf", 400),
        ("FiraSans-Italic.ttf", 400, "italic"),
        ("FiraSans-Medium.ttf", 500),
        ("FiraSans-MediumItalic.ttf", 500, "italic"),
        ("FiraSans-Bold.ttf", 700),
        ("FiraSans-BoldItalic.ttf", 700, "italic"),
        ("FiraSans-ExtraBold.ttf", 800),
        ("FiraSans-ExtraBoldItalic.ttf", 800, "italic"),
        ("FiraSans-Black.ttf", 900),
        ("FiraSans-BlackItalic.ttf", 900, "italic"),
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
    selected_ids = set()
    for obj in _visit_objects(canvas.get("objects", [])):
        if obj.get("isProductZone") or obj.get("isGridZone"):
            styles = obj.get("_zoneGlobalStyles") or {}
            selected_id = str(styles.get("splashTemplateId") or obj.get("_zoneTemplateSnapshotId") or "").strip()
            if selected_id:
                selected_ids.add(selected_id)
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
        for face in faces:
            filename, weight = face[:2]
            style = face[2] if len(face) > 2 else "normal"
            path = _font_file(filename, worker_file)
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            css.append(
                "@font-face{" +
                f"font-family:{json.dumps(family_name)};font-style:{style};" +
                f"font-weight:{weight};font-display:block;src:url(data:font/ttf;base64,{encoded}) format('truetype')" +
                "}"
            )
            descriptors.append({"family": family_name, "weight": weight, "style": style})
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


FONT_CHECK_JS = """async descriptors => {
          const essential = ['Barlow', 'Inter'];
          const loadedFaces = await Promise.all(descriptors.map(face => document.fonts.load(`${face.style || 'normal'} ${face.weight === '100 900' || face.weight === '200 900' ? '700' : face.weight} 32px \"${face.family}\"`, 'Font check 123')));
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
        }"""


def render(payload, output_dir: Path, fabric_path: Path):
    if payload.get("mode") == "saved_page":
        return render_saved_page(payload, output_dir, fabric_path)
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
      "cardLayout": payload.get("cardLayout"),
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
        page.evaluate(FONT_CHECK_JS, font_descriptors)
        page.add_script_tag(path=str(fabric_path))
        native_layout_path = Path(__file__).with_name("native-layout.js")
        if not native_layout_path.is_file():
            fail("Regras nativas do Editor Rápido indisponíveis para renderização.")
        page.add_script_tag(path=str(native_layout_path))
        result = page.evaluate("""async () => {
          const input = window.__RENDER_INPUT__;
          const fabric = window.fabric;
          // Chromium renders from a local document without a secure origin.
          // The shared Cards recipe assigns IDs to automatic image copies.
          if (!globalThis.crypto.randomUUID) globalThis.crypto.randomUUID = () => {
            const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
            bytes[6] = (bytes[6] & 15) | 64;
            bytes[8] = (bytes[8] & 63) | 128;
            const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
            return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
          };
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
            JobVarejoNative.layoutManualFlyerComposition(all, (props, index) => {
              const backdrop = new fabric.Rect({...props, _customId: crypto.randomUUID()});
              const frame = all.find(item => item.isFrame && item._customId === props.parentFrameId);
              if (frame?.clipContent) {
                const bounds = frame.getBoundingRect();
                backdrop.clipPath = new fabric.Rect({left: bounds.left, top: bounds.top,
                  width: bounds.width, height: bounds.height, absolutePositioned: true, strokeWidth: 0});
              }
              c.insertAt(index, backdrop);
              all.splice(index, 0, backdrop);
              return backdrop;
            });
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
                  return JobVarejoNative.calculateManualProductSlots(zone, count, format, contentBounds)
                    .map(slot => ({ ...slot, zoneIndex: 0 }));
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
              const highlighted = slot.highlighted === true;
              const cardColor = styles.isProdBgTransparent ? 'transparent'
                : styles.cardColorMode === 'manual' ? (styles.cardColor || '#ffffff')
                : highlighted ? (palette.highlightCardColor || styles.highlightCardColor || '#ffffff')
                : (palette.cardColor || styles.cardColor || '#ffffff');
              const nameColor = highlighted ? (palette.highlightProdNameColor || styles.prodNameColor || '#111111')
                : (palette.prodNameColor || styles.prodNameColor || '#111111');
              const titleText = [product.name, product.brand, product.variant, product.weight].filter(Boolean).join(' ');
              const labelId = String(styles.splashTemplateId || zone._zoneTemplateSnapshotId || '').trim();
              const templates = input.canvas.__labelTemplates || [];
              const template = labelId ? templates.find(item => String(item.id) === labelId) : null;
              const savedLabel = template?.group || zone._zoneTemplateSnapshot || zone._zoneStateSnapshot?.labelTemplate?.snapshot;
              if (labelId && !savedLabel) throw new Error('A etiqueta escolhida no modelo não está disponível.');
              const zoneId = zone._customId || zone.id || zone.name;
              const card = await JobVarejoNative.createManualProductCard(fabric, {
                ...product,
                name: styles.prodNameTransform === 'upper' ? titleText.toLocaleUpperCase('pt-BR') : titleText,
                limit: product.condition || '',
                // Igual ao editor manual (quantidade automática), mas sempre com ao
                // menos o par de imagens; cards altos recebem mais cópias até preencher.
                autoFillImages: true, imageFillMinimum: 2, zoneInstanceId: zoneId
              }, left + width / 2, top + height / 2, width, height, zoneId,
                savedLabel ? { ...(template || {}), id: labelId, group: savedLabel } : undefined,
                { ...styles, __refCellW: slot.refCellWidth, __refCellH: slot.refCellHeight,
                  cardLayout: input.cardLayout || styles.cardLayout,
                  productPalette: { ...palette, cardColor, prodNameColor: nameColor } });
              card.set({isProductCard: true, parentZoneId: zoneId, productZoneId: zoneId,
                productItemId: product.id, _zoneOrder: i});
              c.add(card);
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
            // Logos com contorno (sticker) são desenhados uma única vez pelo
            // applyFlyerLogoStickers no servidor; aqui ficariam com sombra duplicada.
            const stickerLogos = [];
            const collectStickerLogos = objects => objects.forEach(o => {
              if (String(o.type || '').toLowerCase() === 'image' && o.quickLogoSource && o.__stickerOutlineEnabled && o.visible !== false) stickerLogos.push(o);
              if (typeof o.getObjects === 'function') collectStickerLogos(o.getObjects());
            });
            collectStickerLogos(c.getObjects());
            const setStickerLogosVisible = visible => stickerLogos.forEach(o => {
              o.visible = visible;
              for (let parent = o.group; parent; parent = parent.group) parent.dirty = true;
            });
            setStickerLogosVisible(false);
            c.renderAll();
            const png = c.toDataURL({format: 'png', multiplier: 1, enableRetinaScaling: false});
            setStickerLogosVisible(true);
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


SAVED_PAGE_JS = """async () => {
  const input = window.__RENDER_INPUT__;
  const fabric = window.fabric;
  if (!fabric?.StaticCanvas) throw new Error('Bundle Fabric indisponível.');
  const source = input.canvas;
  const c = new fabric.StaticCanvas(document.createElement('canvas'), {
    width: input.width, height: input.height, renderOnAddRemove: false,
    backgroundColor: source.background || '#ffffff', enableRetinaScaling: false
  });
  await c.loadFromJSON(source);
  // Objetos antigos podem perder flags customizadas ao carregar; o JSON salvo é a referência.
  const flagKeys = ['name', 'layerName', 'isGridCell', 'gridGroupId', 'isProductZone', 'isGridZone', 'isFrame', '_customId', 'quickLogoSlot', 'businessProfileField',
    'excludeFromExport', 'zoneName', '_zoneGlobalStyles', '_zoneTemplateSnapshotId', '_zonePadding', '_zoneWidth', '_zoneHeight',
    'role', 'quickLogoSource', '__stickerOutlineEnabled', 'parentFrameId'];
  const restore = (objects, saved) => objects.forEach((object, index) => {
    const original = (saved || [])[index] || {};
    for (const key of flagKeys) if (original[key] !== undefined && object[key] === undefined) object[key] = original[key];
    if (typeof object.getObjects === 'function') restore(object.getObjects(), original.objects);
  });
  restore(c.getObjects(), source.objects);
  const all = [];
  const walk = list => list.forEach(object => { all.push(object); if (typeof object.getObjects === 'function') walk(object.getObjects()); });
  walk(c.getObjects());
  const kind = object => String(object?.type || '').toLowerCase();
  const dashedRect = object => kind(object) === 'rect' && Array.isArray(object.strokeDashArray) && object.strokeDashArray.length > 0;
  // Mesmo critério do editor (isLikelyProductZone + withProductZonesHiddenForOutput).
  const isZone = object => {
    if (kind(object) !== 'group') return false;
    if (object.isGridZone || object.isProductZone) return true;
    if (object.name === 'gridZone' || object.name === 'productZoneContainer') return true;
    if (typeof object._zonePadding === 'number' && typeof object._zoneWidth === 'number' && typeof object._zoneHeight === 'number') return true;
    const rect = (object.getObjects?.() || []).find(dashedRect);
    return Boolean(rect && (object._zoneGlobalStyles || object.zoneName || object._zoneTemplateSnapshotId || object.role));
  };
  const hidden = new Set();
  for (const parent of all) if (isZone(parent)) for (const child of parent.getObjects?.() || []) if (dashedRect(child)) hidden.add(child);
  for (const object of all) {
    const name = String(object.name || '');
    const isImage = kind(object) === 'image';
    if (!isImage && (object.quickLogoSlot === true || String(object.businessProfileField || '').trim().toLowerCase() === 'logo')) hidden.add(object);
    else if (['zoneRect', 'zone-border', 'product-zone-outline'].includes(name)) hidden.add(object);
    else if (object.excludeFromExport === true && !isZone(object)) hidden.add(object);
    else if (kind(object) === 'rect' && (object.isProductZone || object.isGridZone)) hidden.add(object);
    // Logos com contorno (sticker) são desenhadas depois pelo servidor, como no encarte gerado.
    if (isImage && object.quickLogoSource && object.__stickerOutlineEnabled && object.visible !== false) hidden.add(object);
  }
  hidden.forEach(object => {
    object.visible = false;
    for (let parent = object.group; parent; parent = parent.group) parent.dirty = true;
  });
  // Mesmos sinais de frame do editor (isFrameLikeObject).
  const isFrameLike = object => {
    if (object.isFrame) return true;
    const layerName = String(object.layerName || '').trim().toUpperCase();
    const name = String(object.name || '').trim();
    if (layerName === 'FRAMER' || layerName === 'FRAME' || /^FRAMER?\\s+\\d+\\s*$/i.test(layerName)) return true;
    if (/^FRAMER(?:\\s+\\d+)?$/i.test(name) || /^FRAME(?:\\s+\\d+)?\\s*$/i.test(name)) return true;
    return kind(object) === 'rect' && (object.isGridCell === true || String(object.gridGroupId || '').trim().length > 0);
  };
  const frames = c.getObjects().filter(object => isFrameLike(object) && object.visible !== false);
  const bounds = frame => {
    const width = Math.abs(Number(frame.width || 0) * Number(frame.scaleX || 1));
    const height = Math.abs(Number(frame.height || 0) * Number(frame.scaleY || 1));
    if (Math.abs(Number(frame.angle || 0)) % 360 > 0.001) {
      const rect = frame.getBoundingRect();
      return {left: rect.left, top: rect.top, width: rect.width, height: rect.height};
    }
    const center = frame.getCenterPoint();
    return {left: center.x - width / 2, top: center.y - height / 2, width, height};
  };
  const targets = (frames.length ? frames.map(bounds) : [{left: 0, top: 0, width: input.width, height: input.height}])
    .slice(0, Math.max(1, Math.min(20, Number(input.maxOutputs) || 10)));
  c.renderAll();
  const output = [];
  for (const target of targets) {
    const region = {left: Math.round(target.left), top: Math.round(target.top),
      width: Math.max(1, Math.round(target.width)), height: Math.max(1, Math.round(target.height))};
    if (region.width > 8192 || region.height > 8192) throw new Error('Página grande demais para gerar a imagem.');
    const png = c.toDataURL({format: 'png', multiplier: 1, enableRetinaScaling: false, ...region});
    output.push({png, region});
  }
  await c.dispose();
  return JSON.stringify(output);
}"""


def render_saved_page(payload, output_dir: Path, fabric_path: Path):
    """Exporta uma página salva do editor sem alterar o layout (um PNG por frame)."""
    canvas = payload.get("canvas")
    if not isinstance(canvas, dict) or not isinstance(canvas.get("objects"), list):
        fail("A página não contém um canvas Fabric salvo.")
    page_size = (int(payload.get("width") or canvas.get("width") or 0), int(payload.get("height") or canvas.get("height") or 0))
    if min(page_size) < 32 or max(page_size) > 8192:
        fail("Dimensões da página fora do limite permitido.")
    browser_payload = {"canvas": canvas, "width": page_size[0], "height": page_size[1], "maxOutputs": payload.get("maxOutputs")}
    font_css, font_descriptors = _font_stylesheet(canvas)
    html = """<!doctype html><html><head><meta charset=\"utf-8\"><style>%s</style></head><body>
      <canvas id=\"canvas\"></canvas><script>window.__RENDER_INPUT__ = %s;</script>
      </body></html>""" % (font_css, json.dumps(browser_payload, ensure_ascii=False).replace("</", "<\\/"))
    with sync_playwright() as playwright:
        browser_path = os.environ.get("WHATSAPP_CREATION_CHROMIUM_EXECUTABLE")
        browser = playwright.chromium.launch(headless=True, executable_path=browser_path,
                                             args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": min(page_size[0], 4096), "height": min(page_size[1], 4096)}, device_scale_factor=1)
        page.route("**/*", lambda route: route.abort() if route.request.url.startswith(("http://", "https://")) else route.continue_())
        page.set_content(html, wait_until="load")
        page.evaluate(FONT_CHECK_JS, font_descriptors)
        page.add_script_tag(path=str(fabric_path))
        result = page.evaluate(SAVED_PAGE_JS)
        browser.close()
    if isinstance(result, str):
        result = json.loads(result)
    if not isinstance(result, list) or not result:
        fail("O renderizador não retornou páginas.")
    output = []
    for index, item in enumerate(result, 1):
        match = re.fullmatch(r"data:image/png;base64,([A-Za-z0-9+/=]+)", item.get("png", ""))
        if not match:
            fail("O renderizador não retornou PNG válido.")
        name = f"page-{index}.png"
        (output_dir / name).write_bytes(base64.b64decode(match.group(1), validate=True))
        output.append({"name": name, "region": item.get("region")})
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
