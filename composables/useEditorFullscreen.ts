import { onMounted, onUnmounted, ref } from 'vue'

export const useEditorFullscreen = () => {
    const isFullscreen = ref(false)

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .then(() => {
                    isFullscreen.value = true
                })
                .catch(err => {
                    console.error('Erro ao entrar em tela cheia:', err)
                })
            return
        }

        document.exitFullscreen()
            .then(() => {
                isFullscreen.value = false
            })
            .catch(err => {
                console.error('Erro ao sair de tela cheia:', err)
            })
    }

    const handleFullscreenChange = () => {
        isFullscreen.value = !!document.fullscreenElement
    }

    onMounted(() => {
        document.addEventListener('fullscreenchange', handleFullscreenChange)
    })

    onUnmounted(() => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange)
    })

    return {
        isFullscreen,
        toggleFullscreen
    }
}
