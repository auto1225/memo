import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'

interface PaintCanvasProps {
  editor: Editor | null
  onClose: () => void
}

type Tool = 'pen' | 'eraser' | 'rect' | 'line'
const COLORS = ['#000000', '#D97757', '#5D4037', '#1976D2', '#388E3C', '#FBC02D', '#E91E63']

/**
 * Phase 6 — 간단한 그림판.
 * 캔버스에 그리고 toDataURL → 메모에 이미지로 삽입.
 */
export function PaintCanvas({ editor, onClose }: PaintCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(3)
  const [drawing, setDrawing] = useState(false)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const snapshot = useRef<ImageData | null>(null)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
  }, [])

  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = ref.current!.getBoundingClientRect()
    const sx = ref.current!.width / r.width
    const sy = ref.current!.height / r.height
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }
  }

  function start(e: React.MouseEvent<HTMLCanvasElement>) {
    const ctx = ref.current!.getContext('2d')!
    const p = getPos(e)
    startPos.current = p
    setDrawing(true)
    if (tool === 'pen' || tool === 'eraser') {
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
      ctx.lineWidth = tool === 'eraser' ? size * 4 : size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
    } else {
      // 모양 도구는 시작 시 스냅샷 저장
      snapshot.current = ctx.getImageData(0, 0, ref.current!.width, ref.current!.height)
    }
  }

  function move(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return
    const ctx = ref.current!.getContext('2d')!
    const p = getPos(e)
    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    } else if (snapshot.current && startPos.current) {
      ctx.putImageData(snapshot.current, 0, 0)
      ctx.strokeStyle = color
      ctx.lineWidth = size
      ctx.beginPath()
      if (tool === 'rect') {
        ctx.strokeRect(startPos.current.x, startPos.current.y, p.x - startPos.current.x, p.y - startPos.current.y)
      } else if (tool === 'line') {
        ctx.moveTo(startPos.current.x, startPos.current.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
    }
  }

  function end() {
    setDrawing(false)
    startPos.current = null
    snapshot.current = null
  }

  function clear() {
    const ctx = ref.current!.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ref.current!.width, ref.current!.height)
  }

  function insertToEditor() {
    if (!editor || !ref.current) return
    const url = ref.current.toDataURL('image/png')
    editor.chain().focus().setImage({ src: url }).run()
    onClose()
  }

  function downloadPng() {
    if (!ref.current) return
    const url = ref.current.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = 'jan-paint-' + Date.now() + '.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="jan-modal-overlay" onClick={onClose}>
      <div className="jan-modal jan-paint-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jan-modal-head">
          <h3>그림판</h3>
          <button className="jan-modal-close" onClick={onClose}>닫기</button>
        </div>
        <div className="jan-modal-body">
          <div className="jan-paint-tools">
            <button className={tool === 'pen' ? 'is-active' : ''} onClick={() => setTool('pen')}>펜</button>
            <button className={tool === 'eraser' ? 'is-active' : ''} onClick={() => setTool('eraser')}>지우개</button>
            <button className={tool === 'rect' ? 'is-active' : ''} onClick={() => setTool('rect')}>사각형</button>
            <button className={tool === 'line' ? 'is-active' : ''} onClick={() => setTool('line')}>직선</button>
            <span className="divider" />
            {COLORS.map((c) => (
              <button
                key={c}
                className={'jan-paint-color' + (c === color ? ' is-active' : '')}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
            <span className="divider" />
            <label style={{ fontSize: 12 }}>굵기:
              <input type="range" min={1} max={20} value={size} onChange={(e) => setSize(parseInt(e.target.value, 10))} />
              {size}
            </label>
            <span className="divider" />
            <button onClick={clear}>지우기</button>
            <button onClick={downloadPng}>PNG 저장</button>
            <button onClick={insertToEditor} className="primary">메모에 삽입</button>
          </div>
          <canvas
            ref={ref}
            width={800}
            height={500}
            className="jan-paint-canvas"
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
          />
        </div>
      </div>
    </div>
  )
}
