// 라인 아이콘 (Material Symbols Rounded 감각, 24 그리드, 1.8 선). 외부 의존 없음.

const P: Record<string, string> = {
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-3.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  radar: 'M12 12 18.5 5.5M20.5 12A8.5 8.5 0 1 1 12 3.5M16.5 12A4.5 4.5 0 1 1 12 7.5',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.8.8 3 2.6 3 5.2',
  doc: 'M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V4a.5.5 0 0 1 .5-.5ZM14 3.5V8h4M9.5 12.5h5M9.5 16h5',
  trend: 'M3.5 17 9 11.5l4 4 7.5-8M15 7.5h5.5V13',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-1.6.9 1.6-2 3.4-1.8-.4a7 7 0 0 1-1.8 1L14.2 21h-4.4l-.5-1.9a7 7 0 0 1-1.8-1l-1.8.4-2-3.4.9-1.6a7 7 0 0 1 0-2.1l-.9-1.6 2-3.4 1.8.4a7 7 0 0 1 1.8-1l.5-1.9h4.4l.5 1.9a7 7 0 0 1 1.8 1l1.8-.4 2 3.4-.9 1.6a7 7 0 0 1 0 2.1Z',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  copy: 'M9 9h10v11H9zM15 9V4H4v11h5',
  image: 'M4 5h16v14H4zM4 15.5l4.5-4.5 4 4 2.5-2.5L20 17M15.5 9.5a1 1 0 1 0 0-.01',
  sparkle: 'M12 3.5c.6 4.3 2.2 6 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.5 5.9-2.2 6.5-6.5ZM18.5 15.5c.3 1.8.9 2.4 2.5 2.7-1.6.3-2.2.9-2.5 2.6-.3-1.7-.9-2.3-2.5-2.6 1.6-.3 2.2-.9 2.5-2.7Z',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  alert: 'M12 4 21 19.5H3zM12 10v4.5M12 17.3v.01',
  folder: 'M3.5 6.5a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z',
  refresh: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  phone: 'M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 5 5.1a1.5 1.5 0 0 1 1.5-1.6Z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  down: 'm7 10 5 5 5-5',
  up: 'm7 14 5-5 5 5',
  close: 'M6 6l12 12M18 6 6 18',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l.8 12.5a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L17 7',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20.5 20.5l-5-5',
  quill: 'M20 4C11 4 6 9.5 5 19l-1 1M5 19c4-1 7.5-3 9.5-6.5M9.5 14.5h4',
  camera: 'M4 7.5h3.5l1.5-2h6l1.5 2H20V19H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
}

export default function Icon({ name, size = 20, fill = false }: { name: keyof typeof P | string; size?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? P.doc} />
    </svg>
  )
}

/** 워드마크 로고 — 겹친 두 개의 획 (글·승리) */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M5 9l5.5 15L16 11l5.5 13L27 9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="6" r="2" fill="#d0b582" />
    </svg>
  )
}
