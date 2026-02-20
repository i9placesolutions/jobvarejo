/**
 * Label (Splash) Template
 *
 * A reusable Fabric.js group definition used as the price label inside product cards.
 * Stored in the project JSON (at the canvas root) and can be applied to a Product Zone.
 */

export type LabelTemplateKind = 'priceGroup-v1';

export interface LabelTemplate {
  id: string;
  name: string;
  kind: LabelTemplateKind;
  // Fabric group JSON (type: 'group', with `objects`)
  group: any;
  // Built-in templates are seeded automatically (still editable, but should not be deletable).
  isBuiltIn?: boolean;
  // Optional preview for the UI (data URL)
  previewDataUrl?: string;
  createdAt: string;
  updatedAt: string;
}
