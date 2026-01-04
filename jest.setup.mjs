// Jestのセットアップファイル
import '@testing-library/jest-dom'

// 環境変数のモック
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.AUTO_ORDER_SECRET = 'test-auto-order-secret'

// Next.jsのモック
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return ''
  },
  redirect: jest.fn(),
}))

// Next.js Serverのモック（Node環境で動作するように）
if (typeof global.Request === 'undefined') {
  global.Request = class MockRequest {
    constructor(input, init) {
      this.url = typeof input === 'string' ? input : input.url
      this.method = (init && init.method) || 'GET'
      this.headers = new Map()
      if (init && init.headers) {
        Object.entries(init.headers).forEach(([key, value]) => {
          this.headers.set(key, value)
        })
      }
    }
  }
}

if (typeof global.Response === 'undefined') {
  global.Response = class MockResponse {
    constructor(body, init) {
      this.body = body
      this.status = (init && init.status) || 200
      this.statusText = (init && init.statusText) || 'OK'
      this.headers = new Map()
      if (init && init.headers) {
        Object.entries(init.headers).forEach(([key, value]) => {
          this.headers.set(key, value)
        })
      }
    }

    json() {
      return Promise.resolve(JSON.parse(this.body))
    }

    text() {
      return Promise.resolve(this.body)
    }
  }
}
