import { describe, expect, it } from 'vitest'
import { cardToVCard, cardsToCsv, parseAiBusinessCardJson, parseContactText, parseCsv, parseVCard } from './businessCards'
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

  it('does not classify Jeju landline numbers as mobile numbers', () => {
    const parsed = parseContactText(`추 우주주차
최민호
Tel 064.756.1633
Fax 064.756.1634
cmh@woojoocha.com
제주특별자치도 제주시 첨단로 245-13 (영평동)`)

    expect(parsed.name).toBe('최민호')
    expect(parsed.company).toBe('우주주차')
    expect(parsed.mobile).toBe('')
    expect(parsed.phone).toBe('064.756.1633')
    expect(parsed.fax).toBe('064.756.1634')
    expect(parsed.email).toBe('cmh@woojoocha.com')
    expect(parsed.address).toContain('제주특별자치도')
  })

  it('splits OCR lines that merge company, name, telephone, and fax fields', () => {
    const parsed = parseContactText(`추 우주주차 최민호
T 064.756.1633 F 064.756.1634
cmh@woojoocha.com
제주특별자치도 제주시 첨단로 245-13 (영평동)`)

    expect(parsed.name).toBe('최민호')
    expect(parsed.company).toBe('우주주차')
    expect(parsed.mobile).toBe('')
    expect(parsed.phone).toBe('064.756.1633')
    expect(parsed.fax).toBe('064.756.1634')
    expect(parsed.email).toBe('cmh@woojoocha.com')
    expect(parsed.address).toContain('제주특별자치도')
  })

  it('parses Korean labeled lines and ignores AI wrapper prose', () => {
    const parsed = parseContactText(`명함에서 읽은 정보:
이름 최민호
회사 우주주차
부서 운영팀
직책 대표
전화 064.756.1633
팩스 064.756.1634
이메일 cmh@woojoocha.com
주소 제주특별자치도 제주시 첨단로 245-13`)

    expect(parsed.name).toBe('최민호')
    expect(parsed.company).toBe('우주주차')
    expect(parsed.department).toBe('운영팀')
    expect(parsed.position).toBe('대표')
    expect(parsed.address).toBe('제주특별자치도 제주시 첨단로 245-13')
  })

  it('splits inline Korean labels when memo text is flattened into one line', () => {
    const parsed = parseContactText('명함에서 읽은 정보: 이름 최민호 회사 우주주차 전화 064.756.1633 팩스 064.756.1634 이메일 cmh@woojoocha.com 주소 제주특별자치도 제주시 첨단로 245-13')

    expect(parsed.name).toBe('최민호')
    expect(parsed.company).toBe('우주주차')
    expect(parsed.phone).toBe('064.756.1633')
    expect(parsed.fax).toBe('064.756.1634')
    expect(parsed.email).toBe('cmh@woojoocha.com')
    expect(parsed.address).toBe('제주특별자치도 제주시 첨단로 245-13')
  })

  it('recognizes Korean mobile international format and parenthesized office numbers', () => {
    const parsed = parseContactText(`이름 김하나
회사 Example Labs
Mobile +82 10-1234-5678
Tel (02) 1234-5678
hana@example.com`)

    expect(parsed.mobile).toBe('+82 10-1234-5678')
    expect(parsed.phone).toBe('(02) 1234-5678')
  })

  it('parses AI business card JSON with Korean labels and nested contact fields', () => {
    const parsed = parseAiBusinessCardJson(`\`\`\`json
{
  "이름": "최민호",
  "회사명": "우주주차",
  "직책": "대표",
  "연락처": {
    "대표 전화": "064.756.1633",
    "팩스": "064.756.1634",
    "이메일": "cmh@woojoocha.com"
  },
  "주소": "제주특별자치도 제주시 첨단로 245-13",
  "SNS": { "naver": "blog.naver.com/woojoocha" },
  "태그": ["주차", "제주"]
}
\`\`\``)

    expect(parsed?.name).toBe('최민호')
    expect(parsed?.company).toBe('우주주차')
    expect(parsed?.position).toBe('대표')
    expect(parsed?.phone).toBe('064.756.1633')
    expect(parsed?.fax).toBe('064.756.1634')
    expect(parsed?.email).toBe('cmh@woojoocha.com')
    expect(parsed?.sns?.naver).toContain('blog.naver.com')
    expect(parsed?.tags).toEqual(['주차', '제주'])
  })

  it('falls back to contact text parsing when AI returns non-JSON text', () => {
    const parsed = parseAiBusinessCardJson(`명함에서 읽은 정보:
이름 최민호
회사 우주주차
전화 064.756.1633
팩스 064.756.1634
이메일 cmh@woojoocha.com
주소 제주특별자치도 제주시 첨단로 245-13`)

    expect(parsed?.name).toBe('최민호')
    expect(parsed?.company).toBe('우주주차')
    expect(parsed?.phone).toBe('064.756.1633')
    expect(parsed?.fax).toBe('064.756.1634')
    expect(parsed?.email).toBe('cmh@woojoocha.com')
  })

  it('unwraps AI JSON objects that nest the card under result or data', () => {
    const parsed = parseAiBusinessCardJson(`{
  "result": {
    "name": "최민호",
    "company": "우주주차",
    "phone": "064.756.1633",
    "email": "cmh@woojoocha.com"
  }
}`)

    expect(parsed?.name).toBe('최민호')
    expect(parsed?.company).toBe('우주주차')
    expect(parsed?.phone).toBe('064.756.1633')
    expect(parsed?.email).toBe('cmh@woojoocha.com')
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
