import { useState } from 'react'
import type { TopicBank, TopicItem } from '../types'
import { customTopic } from '../lib/topics'
import { drawTopic } from '../lib/lottery'
import { isOnline } from '../lib/network'

export function TopicDraw({
  bank,
  profileId,
  onChoose,
}: {
  bank: TopicBank
  profileId: string
  onChoose: (item: TopicItem) => void
}) {
  const [item, setItem] = useState<TopicItem | null>(null)
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function draw() {
    setBusy(true)
    setError(null)
    const next = await drawTopic(profileId, bank)
    if (!next) {
      setError(
        isOnline()
          ? '주제 은행이 비어 있습니다. 설정에서 주제를 가져와 보세요.'
          : '저장된 주제가 없습니다. 온라인에서 한 번 주제를 받아 주세요. 지금은 직접 입력할 수 있습니다.',
      )
    }
    setItem(next)
    setBusy(false)
  }

  const title = item?.title ?? item?.claim
  return (
    <div className="stack">
      <p className="topic-kicker">{bank === 'explanation' ? '설명 주제' : '논제'}</p>
      {title ? (
        <>
          <h2 className="topic-title">{title}</h2>
          {item?.prompt && <p>{item.prompt}</p>}
          {item?.backgroundBullets && (
            <ul>
              {item.backgroundBullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {item?.keywords && <p className="muted">검색어: {item.keywords.join(', ')}</p>}
        </>
      ) : (
        <p className="muted">추첨하거나 직접 입력해 시작하세요.</p>
      )}
      {error && <div className="notice">{error}</div>}
      <div className="row">
        <button className="btn primary" type="button" disabled={busy} onClick={() => void draw()}>
          {item ? '다시 추첨' : bank === 'explanation' ? '주제 추첨' : '논제 추첨'}
        </button>
        {item && (
          <button className="btn" type="button" onClick={() => onChoose(item)}>
            이 주제로 시작
          </button>
        )}
      </div>
      <input
        type="text"
        placeholder="직접 입력"
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
      />
      <button
        className="btn ghost"
        type="button"
        disabled={!custom.trim()}
        onClick={() => onChoose(customTopic(bank, custom))}
      >
        이 입력으로 시작
      </button>
    </div>
  )
}
