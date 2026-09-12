/** O construtor determina o tipo; Fabric 7 não permite atribuir `type`. */
export const createIsolatedDynamicTextbox = (fabric: any, serialized: Record<string, any>) => {
  const { type: _type, ...options } = serialized
  return new fabric.Textbox(String(serialized.text || ''), options)
}
