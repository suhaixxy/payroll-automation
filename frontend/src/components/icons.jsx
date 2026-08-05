function base(props) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

export function IconGrid(props) {
  return <svg {...base(props)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>;
}

export function IconUsers(props) {
  return <svg {...base(props)}>
    <circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <circle cx="17.2" cy="8.6" r="2.5" /><path d="M15.5 14.8c2.5.3 4.5 2.2 4.5 5.2" />
  </svg>;
}

export function IconClock(props) {
  return <svg {...base(props)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
}

export function IconCalculator(props) {
  return <svg {...base(props)}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M8 7.5h8M8 12h1.2M11.4 12h1.2M14.8 12h1.2M8 15.5h1.2M11.4 15.5h1.2M14.8 15.5v3.2M8 19h1.2" />
  </svg>;
}

export function IconClipboardCheck(props) {
  return <svg {...base(props)}>
    <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
    <path d="M9 4.5V3.8a1.3 1.3 0 0 1 1.3-1.3h3.4A1.3 1.3 0 0 1 15 3.8v.7" />
    <path d="M9 13l2 2 4-4.5" />
  </svg>;
}

export function IconCreditCard(props) {
  return <svg {...base(props)}><rect x="3" y="5.5" width="18" height="13" rx="2.2" /><path d="M3 10h18" /><path d="M7 14.5h4" /></svg>;
}

export function IconLogout(props) {
  return <svg {...base(props)}>
    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><path d="M14 8l4 4-4 4" /><path d="M18 12H9" />
  </svg>;
}

export function IconMenu(props) {
  return <svg {...base(props)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
}

export function IconChevronDown(props) {
  return <svg {...base(props)}><path d="M6 9l6 6 6-6" /></svg>;
}

export function IconMail(props) {
  return <svg {...base(props)}><rect x="3" y="5" width="18" height="14" rx="2.2" /><path d="M4 6.5l8 6.2 8-6.2" /></svg>;
}

export function IconLock(props) {
  return <svg {...base(props)}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /></svg>;
}

export function IconEye(props) {
  return <svg {...base(props)}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></svg>;
}

export function IconEyeOff(props) {
  return <svg {...base(props)}>
    <path d="M3.5 3.5l17 17" />
    <path d="M10.6 5.7A10.8 10.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.6 15.6 0 0 1-3.3 4.1M6.4 6.9C4 8.6 2.5 12 2.5 12S6 18.5 12 18.5a9.8 9.8 0 0 0 3.4-.6" />
    <path d="M9.9 9.9a2.8 2.8 0 0 0 4 4" />
  </svg>;
}

export function IconCalendar(props) {
  return <svg {...base(props)}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>;
}

export function IconActivity(props) {
  return <svg {...base(props)}><path d="M3 12h4l2.2-6.5L13 18l2.2-6H21" /></svg>;
}
