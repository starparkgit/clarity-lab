import type { TopicSnapshot } from '../types'

export function buildExternalDebatePrompt(topic: TopicSnapshot, cards: string): string {
  const claim = topic.claim ?? topic.title
  return `당신은 토론 상대입니다. 아래 논제에 대해 나와 반대 입장을 취하세요.
한 턴은 5문장 이내로, 정의 확인 → 반박 → 날카로운 질문 1개 순서로 말하세요.
빈 구호 없이 구체적 사례나 딜레마를 요구하세요. 내가 양보하면 그 지점을 기록하고 다음 쟁점으로 이동하세요.

논제: ${claim}

내가 준비한 카드:
${cards || '(아직 없음)'}

첫 발언부터 반대 입장으로 시작하세요.`
}
