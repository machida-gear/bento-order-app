import { ApiError, ApiErrorType } from './errors'
import { validateDateNotPast, validateQuantity } from './api-helpers'

describe('api-helpers', () => {
  describe('validateDateNotPast', () => {
    it('未来の日付はエラーを投げない', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateString = tomorrow.toISOString().split('T')[0]

      expect(() => validateDateNotPast(dateString)).not.toThrow()
    })

    it('今日の日付はエラーを投げない', () => {
      const today = new Date()
      const dateString = today.toISOString().split('T')[0]

      expect(() => validateDateNotPast(dateString)).not.toThrow()
    })

    it('過去の日付はエラーを投げる', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const dateString = yesterday.toISOString().split('T')[0]

      expect(() => validateDateNotPast(dateString)).toThrow(ApiError)
      expect(() => validateDateNotPast(dateString)).toThrow('過去の日付には注文できません')
    })

    it('過去の日付の場合、正しいエラータイプとステータスコードを持つ', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const dateString = yesterday.toISOString().split('T')[0]

      try {
        validateDateNotPast(dateString)
        fail('エラーが投げられるべきでした')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        if (error instanceof ApiError) {
          expect(error.type).toBe(ApiErrorType.VALIDATION_ERROR)
          expect(error.statusCode).toBe(400)
        }
      }
    })
  })

  describe('validateQuantity', () => {
    it('正の整数はエラーを投げない', () => {
      expect(() => validateQuantity(1)).not.toThrow()
      expect(() => validateQuantity(10)).not.toThrow()
      expect(() => validateQuantity(100)).not.toThrow()
    })

    it('0はエラーを投げる', () => {
      expect(() => validateQuantity(0)).toThrow(ApiError)
      expect(() => validateQuantity(0)).toThrow('数量は1以上の整数で入力してください')
    })

    it('負の数はエラーを投げる', () => {
      expect(() => validateQuantity(-1)).toThrow(ApiError)
      expect(() => validateQuantity(-10)).toThrow(ApiError)
    })

    it('小数はエラーを投げる', () => {
      expect(() => validateQuantity(1.5)).toThrow(ApiError)
      expect(() => validateQuantity(0.5)).toThrow(ApiError)
    })

    it('無効な値の場合、正しいエラータイプとステータスコードを持つ', () => {
      try {
        validateQuantity(0)
        fail('エラーが投げられるべきでした')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        if (error instanceof ApiError) {
          expect(error.type).toBe(ApiErrorType.VALIDATION_ERROR)
          expect(error.statusCode).toBe(400)
        }
      }
    })
  })
})
