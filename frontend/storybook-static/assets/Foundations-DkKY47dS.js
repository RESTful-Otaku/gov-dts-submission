import{u as o,j as e,M as r}from"./blocks-CHvL8W2e.js";import"./preload-helper-Dp1pzeXC.js";import"./_commonjsHelpers-CqkleIqs.js";import"./iframe-CupTzWOG.js";function n(t){const s={code:"code",h1:"h1",h2:"h2",li:"li",p:"p",strong:"strong",ul:"ul",...o(),...t.components};return e.jsxs(e.Fragment,{children:[e.jsx(r,{title:"Foundations/App shell"}),`
`,e.jsx(s.h1,{id:"app-shell-in-storybook",children:"App shell in Storybook"}),`
`,e.jsxs(s.p,{children:["Stories load the same global styles as production (",e.jsx(s.code,{children:"src/styles/index.css"}),")."]}),`
`,e.jsx(s.h2,{id:"theme-and-text-size",children:"Theme and text size"}),`
`,e.jsxs(s.p,{children:["Use the ",e.jsx(s.strong,{children:"Theme"})," and ",e.jsx(s.strong,{children:"Text size"})," controls in the Storybook toolbar (top). They set:"]}),`
`,e.jsxs(s.ul,{children:[`
`,e.jsxs(s.li,{children:[e.jsx(s.code,{children:"document.documentElement.dataset.theme"})," — drives ",e.jsx(s.code,{children:"[data-theme='dark']"})," CSS variables (same as the live app)."]}),`
`,e.jsxs(s.li,{children:[e.jsx(s.code,{children:"document.documentElement.style.fontSize"})," — six-step scale: ",e.jsx(s.code,{children:"14px"}),", ",e.jsx(s.code,{children:"15px"}),", ",e.jsx(s.code,{children:"16px"}),", ",e.jsx(s.code,{children:"18px"}),", ",e.jsx(s.code,{children:"20px"}),", ",e.jsx(s.code,{children:"22px"}),"."]}),`
`]}),`
`,e.jsxs(s.p,{children:["Storybook’s default ",e.jsx(s.strong,{children:"Backgrounds"})," addon is disabled so it does not fight these tokens."]}),`
`,e.jsx(s.h2,{id:"component-behaviour",children:"Component behaviour"}),`
`,e.jsxs(s.ul,{children:[`
`,e.jsxs(s.li,{children:[e.jsx(s.strong,{children:"Layout / AppHeader"})," uses an interactive wrapper so the header’s theme and text-size buttons update the canvas, like the real app."]}),`
`,e.jsx(s.li,{children:"Most other stories inherit appearance from the toolbar only (no extra props). Switch theme or text size to review contrast, spacing, and typography across task views, filters, and modals."}),`
`]}),`
`,e.jsx(s.h2,{id:"what-storybook-does-not-run",children:"What Storybook does not run"}),`
`,e.jsxs(s.p,{children:["Storybook does not execute API calls, routing, or Capacitor unless a story mocks them. Use ",e.jsx(s.strong,{children:"Vitest"})," and ",e.jsx(s.strong,{children:"Playwright"})," for end-to-end behaviour; use Storybook for visual states and a11y review with the ",e.jsx(s.strong,{children:"Accessibility"})," addon."]})]})}function a(t={}){const{wrapper:s}={...o(),...t.components};return s?e.jsx(s,{...t,children:e.jsx(n,{...t})}):n(t)}export{a as default};
