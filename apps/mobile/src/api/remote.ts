import { fetch } from 'expo/fetch'
import { createRemoteClient, type ConnectionSettings, type RemoteClient } from '@devhub/shared'
import { createChunkDecoder } from './utf8-chunks'

/**
 * The shared HTTP + SSE client (ADR 0022) on React Native: `expo/fetch` streams response bodies,
 * which the event stream needs (React Native's own fetch buffers the whole body).
 */
export function createMobileClient(
  settings: ConnectionSettings,
  onUnauthorized: () => void
): RemoteClient {
  return createRemoteClient({
    baseUrl: settings.baseUrl,
    token: () => settings.token,
    fetch: async (url, init) => {
      const response = await fetch(url, init)
      return {
        status: response.status,
        json: () => response.json(),
        body: response.body
      }
    },
    createDecoder: () => {
      const decoder = new TextDecoder()
      return createChunkDecoder((bytes) => decoder.decode(bytes))
    },
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onUnauthorized
  })
}
