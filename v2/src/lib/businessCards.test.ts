import { describe, expect, it } from 'vitest'
import { cardToVCard, cardsToCsv, parseContactText, parseCsv, parseVCard } from './businessCards'
import { snapshotFromCloudData } from './snapshot'
import type { BusinessCard } from '../store/businessCardsStore'

const baseCard: BusinessCard = {
  id: 'bc_1',
  name: '홍길동',
  nameEn: 'Gildong Hong',
  company: 'JustANotepad Labs',
  department: 'Product',
  position: '팀장',
  mobile: '010-1234-5678',
  phone: '02-123-4567',
  fax: '',
  email: 'hong@example.com',
  website: 'justanotepad.com',
  address: '서울시 강남구 테헤란로',
  group: '고객',
  tags: ['vip'],
  memo: '첫 미팅 완료',
  favorite: true,
  sns: { linkedin: 'gildong', instagram: '@gildong' },
  meetings: [],
  createdAt: 1,
  updatedAt: 2,
}

describe('business card utilities', () => {
  it('extracts contact fields from OCR-like text', () => {
    const parsed = parseContactText(`홍길동
JustANotepad Labs
Product 팀장
Mobile 010-1234-5678
Tel 02-123-4567
hong@example.com
https://linkedin.com/in/gildong
서울시 강남구 테헤란로`)

    expect(parsed.name).toBe('홍길동')
    expect(parsed.company).toBe('JustANotepad Labs')
    expect(parsed.mobile).toBe('010-1234-5678')
    expect(parsed.phone).toBe('02-123-4567')
    expect(parsed.email).toBe('hong@example.com')
    expect(parsed.sns?.linkedin).toContain('linkedin.com')
  })

  it('round-trips CSV with Korean headers and SNS fields', () => {
    const csv = cardsToCsv([baseCard])
    const parsed = parseCsv(csv)

    expect(parsed).toHaveLength(1)
    expect(parsed[0].name).toBe('홍길동')
    expect(parsed[0].company).toBe('JustANotepad Labs')
    expect(parsed[0].sns.linkedin).toBe('gildong')
  })

  it('round-trips vCard with social profile fields', () => {
    const vcard = cardToVCard(baseCard)
    const parsed = parseVCard(vcard)

    expect(parsed).toHaveLength(1)
    expect(parsed[0].name).toBe('홍길동')
    expect(parsed[0].nameEn).toBe('Gildong Hong')
    expect(parsed[0].sns.linkedin).toContain('linkedin')
  })
})

describe('business card snapshot migration', () => {
  it('migrates v1 card image fields and my card', () => {
    const snapshot = snapshotFromCloudData({
      tabs: [{ id: 'm1', name: '메모', html: '<p>hello</p>' }],
      activeId: 'm1',
      businessCards: [{
        id: 'old_1',
        name: '이미지 명함',
        frontImg: 'data:image/jpeg;base64,aaa',
        backImg: 'data:image/jpeg;base64,bbb',
        linkedin: 'https://linkedin.com/in/card',
        meetingHistory: [{ date: '2026-04-26', place: 'Seoul', memo: 'follow up' }],
      }],
      myCard: { name: '내 명함', email: 'me@example.com' },
      cardGroups: ['고객'],
    })

    expect(snapshot?.businessCards.cards.old_1.frontImage).toBe('data:image/jpeg;base64,aaa')
    expect(snapshot?.businessCards.cards.old_1.backImage).toBe('data:image/jpeg;base64,bbb')
    expect(snapshot?.businessCards.cards.old_1.sns.linkedin).toContain('linkedin')
    expect(snapshot?.businessCards.cards.old_1.meetings[0].note).toBe('follow up')
    expect(snapshot?.businessCards.myCardId).toBe('bc_my_card')
    expect(snapshot?.businessCards.cards.bc_my_card.email).toBe('me@example.com')
  })
})
