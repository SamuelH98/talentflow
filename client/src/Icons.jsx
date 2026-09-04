import React from 'react';

const I = {
  grid: <path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" />,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19v-1.2A4.5 4.5 0 0 1 8 13.3h2a4.5 4.5 0 0 1 4.5 4.5V19M15.5 4.7a3.2 3.2 0 0 1 0 6.2M17 13.5a4.5 4.5 0 0 1 3.5 4.3V19" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18" /></>,
  trophy: <><path d="M8 4h8v4a4 4 0 0 1-8 0zM8 6H5.5A1.5 1.5 0 0 0 4 7.5C4 10 6 11 8 11M16 6h2.5A1.5 1.5 0 0 1 20 7.5C20 10 18 11 16 11M12 12v2.5M9 18h6M10 20.5h4M12 14.5c1.5 0 3-.8 3.4-2.2" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 18l-6-6 6-6" />,
  building: <><rect x="4" y="5" width="16" height="15" rx="1.5" /><path d="M9 5V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V5M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15M12 20v-4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.5" /></>,
  pin: <><path d="M12 21s-6.5-5.5-6.5-10A6.5 6.5 0 0 1 12 4.5 6.5 6.5 0 0 1 18.5 11c0 4.5-6.5 10-6.5 10z" /><circle cx="12" cy="11" r="2.2" /></>,
  dollar: <path d="M12 3v18M16 6.5c0-1.5-2-2.5-4-2.5S8 5.4 8 7s1.6 2.3 4 2.8 4 1.4 4 3-1.6 2.7-4 2.7-4-1-4-2.5" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20c.8-3.5 4-5 7.5-5s6.7 1.5 7.5 5" /></>,
  external: <><path d="M14 4h6v6M20 4L10 14" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
  logout: <><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3M16 17l5-5-5-5M21 12H9" /></>,
  inbox: <><path d="M4 13h5l1.5 2.5h3L15 13h5" /><path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /></>,
  spark: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z" />,
  calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></>,
  rocket: <path d="M11.5 20.5c.5-1 .8-2 .8-3M14 3s3.5.5 4.5 4 1 7-1 9l-4 3-1-4-3 1-1 1.5-2.5-1L10 10l4-2.5L14 3zM18.5 18.5l.8 2M5.5 5.5l-1 1M6 9l-2 .5M12 4v-1.5" />,
  upload: <><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  shield: <path d="M12 3l7 2.5v5c0 4.5-3 7.7-7 9.5-4-1.8-7-5-7-9.5v-5zM8.5 12l2.5 2.5 4.5-5" />,
  sun: <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  trash: <><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6 7l1 13h10l1-13M10 11v5M14 11v5" /></>,
};

export function Icon({ name, size = 18, className = '', strokeWidth = 1.8 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {I[name]}
    </svg>
  );
}