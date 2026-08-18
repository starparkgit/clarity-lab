import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Bank = 'explanation' | 'proposition'

type Topic = {
  id: string
  bank: Bank
  title?: string
  prompt?: string
  claim?: string
  background_bullets?: string[]
  keywords?: string[]
  tags: string[]
  source: string
  active: boolean
  fetched_at: string
}

const CURATED: Topic[] = [
  {
    id: 'curated-exp-001',
    bank: 'explanation',
    title: '트랜스포머가 바꾼 언어 모델',
    prompt: '주의 메커니즘이 긴 문맥을 다루는 이유를, 수식 없이 설명하세요.',
    tags: ['기술'],
    source: 'curated',
    active: true,
    fetched_at: new Date().toISOString(),
  },
  {
    id: 'curated-prop-001',
    bank: 'proposition',
    claim: '온디바이스 AI가 클라우드 AI보다 개인정보 보호에 더 유리하다',
    background_bullets: [
      '처리 위치가 기기 안이면 원본이 서버로 안 갈 수 있다',
      '성능과 업데이트는 클라우드가 유리할 수 있다',
      '앱 권한과 백업 경로로도 데이터가 샐 수 있다',
    ],
    keywords: ['온디바이스 AI', '프라이버시', '클라우드'],
    tags: ['기술', '개인정보'],
    source: 'curated',
    active: true,
    fetched_at: new Date().toISOString(),
  },
  {
    id: 'curated-prop-002',
    bank: 'proposition',
    claim: '에이전트형 AI에게 은행·메일 자율 권한을 주면 안 된다',
    background_bullets: [
      '권한 남용과 프롬프트 주입 사고가 난다',
      '생산성 이득이 크다',
      '한도와 승인 설계가 타협점이다',
    ],
    keywords: ['에이전트', '권한', '보안'],
    tags: ['기술', '보안'],
    source: 'curated',
    active: true,
    fetched_at: new Date().toISOString(),
  },
  {
    id: 'curated-prop-003',
    bank: 'proposition',
    claim: '생성 이미지·음성에는 출처 워터마크를 의무화해야 한다',
    background_bullets: [
      '합성 매체가 선거와 사기에 쓰일 수 있다',
      '워터마크는 잘리면 약해질 수 있다',
      '창작 도구 부담과 우회가 쟁점이다',
    ],
    keywords: ['워터마크', '딥페이크', '생성 미디어'],
    tags: ['기술', '사회'],
    source: 'curated',
    active: true,
    fetched_at: new Date().toISOString(),
  },
  {
    id: 'curated-prop-004',
    bank: 'proposition',
    claim: '데이터 센터 신규 허가는 재생에너지 계약과 묶어야 한다',
    background_bullets: [
      'AI 수요가 전력망을 압박한다',
      '입지와 물 사용도 쟁점이다',
      '계산을 해외로 밀어낼 수 있다',
    ],
    keywords: ['데이터센터', '전력', 'AI'],
    tags: ['기후', '기술'],
    source: 'curated',
    active: true,
    fetched_at: new Date().toISOString(),
  },
  {
    id: 'curated-prop-005',
    bank: 'proposition',
    claim: 'AI 학습에 저작물을 쓰려면 권리자에게 보상해야 한다',
    background_bullets: [
      '대량 학습이 창작 시장을 흔들 수 있다',
      '공정 이용 주장도 있다',
      '보상 창구 설계가 복잡하다',
    ],
    keywords: ['저작권', '학습 데이터', '보상'],
    tags: ['기술', '저작권'],
    source: 'curated',
    active: true,
    fetched_at: new Date().toISOString(),
  },
]

const FEEDS = [
  'https://www.theverge.com/rss/index.xml',
  'https://feeds.arstechnica.com/arstechnica/technology-lab',
]

async function headlinesFromRss(): Promise<Topic[]> {
  const items: Topic[] = []
  for (const url of FEEDS) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const xml = await res.text()
      const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g)]
        .map((m) => m[1]?.trim())
        .filter((t): t is string => Boolean(t) && t !== 'The Verge' && !t.includes('Ars Technica'))
        .slice(0, 12)
      for (const title of titles) {
        const id = `trend-${encodeURIComponent(title).slice(0, 48)}`
        items.push({
          id,
          bank: 'proposition',
          claim: `「${title}」이 보여 주듯, 이 기술 변화는 규제보다 혁신을 우선해야 한다`,
          background_bullets: [
            '헤드라인은 최신 동향의 출발점일 뿐, 사실 확인이 필요하다',
            '규제와 혁신의 속도가 충돌하는 전형적 구도다',
            '누가 이익을 보고 누가 위험을 지는지 나눠 보아야 한다',
          ],
          keywords: [title.slice(0, 24), '기술 동향', '규제'],
          tags: ['trend-refresh', '기술'],
          source: 'trend-refresh',
          active: true,
          fetched_at: new Date().toISOString(),
        })
      }
    } catch {
      // ignore feed errors; curated bank still ships
    }
  }
  return items
}

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }
  const auth = req.headers.get('Authorization')
  if (!auth) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SERVICE_ROLE_KEY') ?? '',
  )

  const trends = await headlinesFromRss()
  const rows = [...CURATED, ...trends].map((row) => ({
    ...row,
    fetched_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('topic_items').upsert(rows)
  await supabase.from('topic_refreshes').insert({
    bank: 'proposition',
    status: error ? 'error' : 'ok',
    item_count: rows.length,
    note: error?.message ?? `curated ${CURATED.length}, trends ${trends.length}`,
  })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  return new Response(JSON.stringify({ ok: true, count: rows.length }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
