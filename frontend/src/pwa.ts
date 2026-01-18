// @ts-expect-error virtual module
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('새 버전이 있습니다. 업데이트하시겠습니까?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('앱이 오프라인에서 작동할 준비가 되었습니다.')
  },
  onRegistered(registration: any) {
    console.log('Service Worker가 등록되었습니다.', registration)

    // 주기적으로 업데이트 확인 (1시간마다)
    if (registration) {
      setInterval(() => {
        registration.update()
      }, 60 * 60 * 1000)
    }
  },
  onRegisterError(error: any) {
    console.error('Service Worker 등록 실패:', error)
  }
})

export { updateSW }
