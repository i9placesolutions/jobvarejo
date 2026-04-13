/**
 * Composable responsivo alinhado aos breakpoints Tailwind (md=768, lg=1024).
 * SSR-safe: retorna "desktop" no servidor.
 */

const BP_MD = 768
const BP_LG = 1024

export const useResponsive = () => {
  const screenWidth = ref(BP_LG)
  const screenHeight = ref(900)

  const isMobile = computed(() => screenWidth.value < BP_MD)
  const isTablet = computed(() => screenWidth.value >= BP_MD && screenWidth.value < BP_LG)
  const isDesktop = computed(() => screenWidth.value >= BP_LG)
  const isTouchDevice = ref(false)
  const isLandscape = computed(() => screenWidth.value > screenHeight.value)

  if (import.meta.client) {
    const mqMobile = window.matchMedia(`(max-width: ${BP_MD - 1}px)`)
    const mqTablet = window.matchMedia(`(min-width: ${BP_MD}px) and (max-width: ${BP_LG - 1}px)`)
    const mqTouch = window.matchMedia('(pointer: coarse)')

    const update = () => {
      screenWidth.value = window.innerWidth
      screenHeight.value = window.innerHeight
    }

    isTouchDevice.value = mqTouch.matches

    // Initial read
    update()

    // Debounced resize listener
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(update, 150)
    }

    // MediaQuery listeners for instant breakpoint changes
    const onMqChange = () => update()
    // FIX #41: Referência nomeada para permitir remoção no cleanup
    const onTouchChange = (e: MediaQueryListEvent) => { isTouchDevice.value = e.matches }
    mqMobile.addEventListener('change', onMqChange)
    mqTablet.addEventListener('change', onMqChange)
    mqTouch.addEventListener('change', onTouchChange)

    window.addEventListener('resize', onResize, { passive: true })

    onScopeDispose(() => {
      window.removeEventListener('resize', onResize)
      mqMobile.removeEventListener('change', onMqChange)
      mqTablet.removeEventListener('change', onMqChange)
      mqTouch.removeEventListener('change', onTouchChange)
      if (resizeTimer) clearTimeout(resizeTimer)
    })
  }

  return {
    screenWidth: readonly(screenWidth),
    screenHeight: readonly(screenHeight),
    isMobile: readonly(isMobile),
    isTablet: readonly(isTablet),
    isDesktop: readonly(isDesktop),
    isTouchDevice: readonly(isTouchDevice),
    isLandscape: readonly(isLandscape)
  }
}
