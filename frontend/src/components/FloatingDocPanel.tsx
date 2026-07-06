/**
 * FloatingDocPanel — reusable draggable, resizable, zoomable document viewer.
 * Used by CoverPage (GC G702/G703) and File2Page (Sub-contractor PDFs).
 */
import { useState, useRef, useCallback } from 'react';
import { Loader2, ZoomIn, ZoomOut, X, Minimize2, Maximize2, Move } from 'lucide-react';

export interface FloatingDocPanelProps {
  packageId: string;
  page: number;
  totalPages?: number;
  fileType?: string;        // default 'GC_PAY_APP'
  label?: string;           // header label, default 'Document'
  onClose: () => void;
}

export default function FloatingDocPanel({
  packageId, page, totalPages = 8,
  fileType = 'GC_PAY_APP', label = 'Document', onClose,
}: FloatingDocPanelProps) {
  const [pos, setPos] = useState({ x: Math.max(20, window.innerWidth - 660), y: 50 });
  const [size, setSize] = useState({ w: 620, h: Math.min(window.innerHeight - 120, 780) });
  const [zoom, setZoom] = useState(1.0);
  const [minimized, setMinimized] = useState(false);
  const [localPage, setLocalPage] = useState(page);
  const [imgLoaded, setImgLoaded] = useState(false);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const resizeRef = useRef<{ active: boolean; dir: string; mx: number; my: number; x: number; y: number; w: number; h: number }>({ active: false, dir: '', mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 });

  if (page !== localPage && !dragging.current) {
    setLocalPage(page);
    setImgLoaded(false);
  }

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: dragStart.current.px + ev.clientX - dragStart.current.mx, y: dragStart.current.py + ev.clientY - dragStart.current.my });
    };
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos]);

  const onResizeStart = useCallback((e: React.MouseEvent, dir: string) => {
    e.preventDefault(); e.stopPropagation();
    resizeRef.current = { active: true, dir, mx: e.clientX, my: e.clientY, x: pos.x, y: pos.y, w: size.w, h: size.h };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current.active) return;
      const { dir: d, mx, my, x, y, w, h } = resizeRef.current;
      const dx = ev.clientX - mx, dy = ev.clientY - my;
      let nx = x, ny = y, nw = w, nh = h;
      if (d.includes('e')) nw = Math.max(360, w + dx);
      if (d.includes('s')) nh = Math.max(280, h + dy);
      if (d.includes('w')) { nw = Math.max(360, w - dx); nx = x + w - nw; }
      if (d.includes('n')) { nh = Math.max(280, h - dy); ny = y + h - nh; }
      setSize({ w: nw, h: nh });
      setPos({ x: nx, y: ny });
    };
    const onUp = () => { resizeRef.current.active = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos, size]);

  const imgUrl = `/api/packages/${packageId}/page-image?page=${localPage}&fileType=${fileType}`;
  const rh = (dir: string, style: React.CSSProperties, cursor: string) => (
    <div key={dir} className="absolute z-10 select-none" style={{ ...style, cursor }}
      onMouseDown={e => onResizeStart(e, dir)} />
  );

  return (
    <div className="fixed z-50 rounded-xl border border-[var(--color-border)] bg-white shadow-2xl overflow-hidden flex flex-col"
      style={{ left: pos.x, top: pos.y, width: size.w, height: minimized ? 44 : size.h, transition: 'height 0.15s', minWidth: 360, minHeight: 44 }}>

      {/* 8-direction resize handles */}
      {!minimized && <>
        {rh('n',  { top: 0, left: 8, right: 8, height: 6 }, 'ns-resize')}
        {rh('s',  { bottom: 0, left: 8, right: 8, height: 6 }, 'ns-resize')}
        {rh('w',  { left: 0, top: 8, bottom: 8, width: 6 }, 'ew-resize')}
        {rh('e',  { right: 0, top: 8, bottom: 8, width: 6 }, 'ew-resize')}
        {rh('nw', { top: 0, left: 0, width: 14, height: 14 }, 'nwse-resize')}
        {rh('ne', { top: 0, right: 0, width: 14, height: 14 }, 'nesw-resize')}
        {rh('sw', { bottom: 0, left: 0, width: 14, height: 14 }, 'nesw-resize')}
        {rh('se', { bottom: 0, right: 0, width: 14, height: 14 }, 'nwse-resize')}
      </>}

      {/* Header / drag handle */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white cursor-grab active:cursor-grabbing shrink-0 select-none"
        onMouseDown={onDragStart}>
        <Move className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-xs font-semibold flex-1">{label} — Page {localPage} / {totalPages}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.4, parseFloat((z - 0.1).toFixed(1))))} className="rounded p-0.5 hover:bg-gray-600"><ZoomOut className="h-3.5 w-3.5" /></button>
          <span className="text-[10px] tabular-nums w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4, parseFloat((z + 0.1).toFixed(1))))} className="rounded p-0.5 hover:bg-gray-600"><ZoomIn className="h-3.5 w-3.5" /></button>
          <div className="w-px h-4 bg-gray-600 mx-1" />
          <button onClick={() => { setLocalPage(p => Math.max(1, p - 1)); setImgLoaded(false); }} className="rounded px-1.5 py-0.5 text-[10px] hover:bg-gray-600 disabled:opacity-30" disabled={localPage <= 1}>◀</button>
          <button onClick={() => { setLocalPage(p => Math.min(totalPages, p + 1)); setImgLoaded(false); }} className="rounded px-1.5 py-0.5 text-[10px] hover:bg-gray-600 disabled:opacity-30" disabled={localPage >= totalPages}>▶</button>
          <div className="w-px h-4 bg-gray-600 mx-1" />
          <button onClick={() => setMinimized(m => !m)} className="rounded p-0.5 hover:bg-gray-600">{minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}</button>
          <button onClick={onClose} className="rounded p-0.5 hover:bg-red-600"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Image */}
      {!minimized && (
        <div className="flex-1 overflow-auto bg-gray-200 relative">
          {!imgLoaded && <div className="absolute inset-0 flex items-center justify-center bg-gray-100"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}
          <img key={imgUrl} src={imgUrl} alt={`page ${localPage}`}
            className={`transition-opacity duration-150 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%` }}
            onLoad={() => setImgLoaded(true)} onError={() => setImgLoaded(true)} />
        </div>
      )}
    </div>
  );
}
