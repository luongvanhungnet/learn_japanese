import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { GameProgress } from './game'
import { crops, harvestCrop, maxBaseLevel, plantCrop, plotCount, upgradeBase, upgradeCost } from './garden'
import type { CropId } from './garden'
import { useLanguage } from './translations'
import './GameGarden.css'

export function GameGarden({ progress, onChange }: { progress: GameProgress; onChange: Dispatch<SetStateAction<GameProgress>> }) {
  const { language } = useLanguage()
  const text = (vi: string, en: string) => language === 'vi' ? vi : en
  const [now, setNow] = useState(Date.now)
  const [seed, setSeed] = useState<CropId>('strawberry')
  const [message, setMessage] = useState('')
  const level = progress.garden.baseLevel
  const count = plotCount(level)
  const cost = upgradeCost(level)
  const chosen = crops.find(c => c.id === seed)!
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return <section className="garden-panel" aria-label={text('Căn cứ và vườn cây', 'Base and orchard')}>
    <div className="garden-heading"><div><span className="game-eyebrow">{text('NGÔI NHÀ NHỎ CỦA BẠN', 'YOUR LITTLE HOMESTEAD')}</span><h2>{['', '🏕️', '🏠', '🏡', '🏯'][level]} {text('Căn cứ', 'Base')} · Lv. {level}</h2><p>{text('Học đúng kiếm vàng → mua hạt → thu hoạch → mở rộng căn cứ.', 'Learn to earn gold → buy seeds → harvest → expand your base.')}</p></div><div className="garden-upgrade"><strong>{count} {text('ô đất', 'plots')} · +{level - 1} {text('vàng/câu đúng', 'gold/correct answer')}</strong><small>+{(level - 1) * 2} {text('vàng/mỗi lần thu hoạch', 'gold per harvest')}</small>{level < maxBaseLevel ? <button disabled={progress.coins < cost!} onClick={() => { onChange(upgradeBase); setMessage(text('Đã nâng cấp căn cứ!', 'Base upgraded!')) }}>{text('Nâng cấp', 'Upgrade')} · {cost} ◉</button> : <b>{text('Đã đạt cấp tối đa', 'Maximum level reached')}</b>}{cost !== null && progress.coins < cost && <small>{text(`Cần thêm ${cost - progress.coins} vàng.`, `Earn ${cost - progress.coins} more gold.`)}</small>}</div></div>
    <p className="garden-note">{text(`Mỗi câu đúng nhận ${3 + level - 1} vàng khi kết thúc lượt. Cây tiếp tục lớn khi bạn học hoặc đóng web; cây chín không bị hỏng.`, `Each correct answer earns ${3 + level - 1} gold when a run ends. Crops grow while you study or close the app and never spoil.`)}</p>
    <div className="garden-seeds" role="group" aria-label={text('Chọn hạt giống', 'Choose seeds')}>{crops.map(crop => <button key={crop.id} disabled={level < crop.level} aria-pressed={seed === crop.id} onClick={() => setSeed(crop.id)}><span>{crop.icon} <b>{crop[language]}</b> · <span lang="ja">{crop.ja}</span></span><small>{crop.cost} ◉ → {crop.sale + (level - 1) * 2} ◉ · {crop.seconds / 60} {text('phút', 'min')}{level < crop.level && ` · 🔒 Lv. ${crop.level}`}</small></button>)}</div>
    <div className="garden-plots">{progress.garden.plots.map((plot, slot) => {
      const crop = crops.find(c => c.id === plot?.crop)
      const ready = plot && now >= plot.readyAt
      const remaining = plot ? Math.max(0, Math.ceil((plot.readyAt - now) / 1000)) : 0
      return <article key={slot} className={`garden-plot${slot >= count ? ' is-locked' : ready ? ' is-ready' : ''}`} aria-label={`${text('Ô đất', 'Plot')} ${slot + 1}`}><span className="garden-plot-art" aria-hidden="true">{slot >= count ? '🔒' : ready ? crop?.icon : plot ? '🌱' : '🟫'}</span><b>{text('Ô đất', 'Plot')} {slot + 1}</b>{slot >= count ? <small>{text(`Mở ở cấp ${slot}`, `Unlock at level ${slot}`)}</small> : plot && crop ? <><span>{crop[language]} · <span lang="ja">{crop.ja}</span></span><small>{ready ? text('Đã chín!', 'Ready!') : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`}</small><progress aria-label={text(`Cây ở ô ${slot + 1}`, `Crop in plot ${slot + 1}`)} max={crop.seconds} value={Math.min(crop.seconds, Math.max(0, crop.seconds - remaining))} /><button disabled={!ready} onClick={() => { onChange(p => harvestCrop(p, slot, Date.now())); setMessage(text('Đã thu hoạch và bán nông sản lấy vàng.', 'Harvest sold for gold.')) }}>{text('Thu hoạch', 'Harvest')} · +{crop.sale + (level - 1) * 2} ◉</button></> : <><small>{text('Đất trống, sẵn sàng gieo hạt', 'Ready for planting')}</small><button disabled={progress.coins < chosen.cost} onClick={() => { onChange(p => plantCrop(p, slot, seed, Date.now())); setMessage(text('Đã gieo hạt. Quay lại học trong lúc chờ nhé!', 'Seeds planted. Keep learning while they grow!')) }}>{text('Trồng', 'Plant')} {chosen.icon} · {chosen.cost} ◉</button></>}</article>
    })}</div>
    {progress.coins < chosen.cost && <p>{text('Chưa đủ vàng mua hạt. Chơi một lượt học để kiếm thêm vàng nhé.', 'Need seed money? Play a learning run to earn more gold.')}</p>}
    <p className="garden-message" role="status">{message}</p>
  </section>
}
