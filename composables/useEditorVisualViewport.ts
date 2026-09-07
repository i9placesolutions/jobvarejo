/** Keep editor panels inside the visible area when the mobile keyboard opens. */
export const useEditorVisualViewport = () => {
  const height = ref(0)
  const bottomInset = ref(0)
  const update = () => {
    const viewport = window.visualViewport
    height.value = viewport?.height || window.innerHeight
    bottomInset.value = Math.max(0, window.innerHeight - height.value - (viewport?.offsetTop || 0))
  }
  onMounted(() => {
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('scroll', update)
  })
  return { height, bottomInset }
}
