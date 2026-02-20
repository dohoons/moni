// @ts-expect-error virtual module
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onOfflineReady() {
    console.log('앱이 오프라인에서 작동할 준비가 되었습니다.')
  },
  onRegisteredSW(_swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) {
    console.log('Service Worker가 등록되었습니다.', registration)

    // 앱 시작 시점에만 1회 업데이트 확인
    void registration?.update()
  },
  onRegisterError(error: any) {
    console.error('Service Worker 등록 실패:', error)
  }
})

export { updateSW }
