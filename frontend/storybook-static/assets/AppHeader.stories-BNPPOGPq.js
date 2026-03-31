import{p as c,t as ne,e as b,a as re,j as X,k as Y,b as le,s as o,d as n,a3 as se,ae as f,aO as F,h as r,ao as q}from"./iframe-BS14FNgM.js";import"./legacy-zriNtcXh.js";import{s as d}from"./attributes-DDbB5mMF.js";import{s as y}from"./class-DvJjGPJo.js";import{i as oe}from"./lifecycle-BlS2fuCw.js";import"./preload-helper-Dp1pzeXC.js";import"./select-1qCOMaYV.js";const de=""+new URL("gov_uk-BNEy2LFB.webp",import.meta.url).href;var ce=le('<header class="app-header"><div class="app-header-main"><div class="app-header-brand"><div class="govuk-logo"><img alt="GOV.UK" class="govuk-logo__crest"/> <span class="govuk-logo__text"></span></div> <div><h1>Caseworker task manager</h1> <p>Capture, prioritise, and complete casework tasks.</p></div></div></div> <div class="app-header-theme" aria-label="Theme and text size"><div class="theme-switch"><span class="control-label">Theme</span> <button type="button"><span class="theme-toggle-track"><span class="theme-toggle-thumb"></span></span> <span class="theme-toggle-icons" aria-hidden="true"><span class="theme-icon theme-icon--day"></span> <span class="theme-icon theme-icon--night"></span></span></button></div> <div class="font-size-control"><span class="control-label">Text size</span> <div class="font-size-buttons" role="radiogroup" aria-label="Text size"><button type="button" title="Normal text size">Aa</button> <button type="button" title="Large text size">Aa</button> <button type="button" title="Extra large text size">Aa</button></div></div></div></header>');function Z(l,e){Y(e,!1);let s=c(e,"theme",8),a=c(e,"fontSize",8),i=c(e,"setTheme",8),t=c(e,"setFontSize",8);oe();var p=ce(),h=n(p),m=n(h),$=n(m),ee=n($),te=o(h,2),L=n(te),u=o(n(L),2),ae=o(L,2),ie=o(n(ae),2),v=n(ie);let A;var k=o(v,2);let D;var _=o(k,2);let H;ne(()=>{d(ee,"src",de),y(u,1,`theme-toggle-switch ${s()==="dark"?"is-dark":"is-light"}`),d(u,"aria-label",s()==="light"?"Switch to dark mode":"Switch to light mode"),d(u,"title",s()==="light"?"Switch to dark mode":"Switch to light mode"),A=y(v,1,"font-btn font-btn-normal",null,A,{selected:a()==="normal"}),d(v,"aria-pressed",a()==="normal"),D=y(k,1,"font-btn font-btn-large",null,D,{selected:a()==="large"}),d(k,"aria-pressed",a()==="large"),H=y(_,1,"font-btn font-btn-xlarge",null,H,{selected:a()==="xlarge"}),d(_,"aria-pressed",a()==="xlarge")}),b("click",u,()=>i()(s()==="light"?"dark":"light")),b("click",v,()=>t()("normal")),b("click",k,()=>t()("large")),b("click",_,()=>t()("xlarge")),re(l,p),X()}Z.__docgen={data:[{name:"theme",visibility:"public",keywords:[{name:"required",description:""}],kind:"let",type:{kind:"union",type:[{kind:"const",type:"string",value:"light",text:'"light"'},{kind:"const",type:"string",value:"dark",text:'"dark"'}],text:'"light" | "dark"'},static:!1,readonly:!1},{name:"fontSize",visibility:"public",keywords:[{name:"required",description:""}],kind:"let",type:{kind:"union",type:[{kind:"const",type:"string",value:"normal",text:'"normal"'},{kind:"const",type:"string",value:"large",text:'"large"'},{kind:"const",type:"string",value:"xlarge",text:'"xlarge"'}],text:'"normal" | "large" | "xlarge"'},static:!1,readonly:!1},{name:"setTheme",visibility:"public",keywords:[{name:"required",description:""}],kind:"let",type:{kind:"function",text:'(next: "light" | "dark") => void'},static:!1,readonly:!1},{name:"setFontSize",visibility:"public",keywords:[{name:"required",description:""}],kind:"let",type:{kind:"function",text:'(next: "normal" | "large" | "xlarge") => void'},static:!1,readonly:!1}],name:"AppHeader.svelte"};function w(l,e){Y(e,!0);let s=c(e,"initialTheme",3,"light"),a=c(e,"initialFontSize",3,"normal"),i=q("light"),t=q("normal");se(()=>{f(i,s()),f(t,a()),F(r(i),r(t))});function p(m){f(i,m,!0),F(r(i),r(t))}function h(m){f(t,m,!0),F(r(i),r(t))}Z(l,{get theme(){return r(i)},get fontSize(){return r(t)},setTheme:p,setFontSize:h}),X()}w.__docgen={data:[{name:"initialTheme",visibility:"public",description:"Driven by Storybook globals via `render` in the meta.",keywords:[],kind:"let",type:{kind:"union",type:[{kind:"const",type:"string",value:"light",text:'"light"'},{kind:"const",type:"string",value:"dark",text:'"dark"'}],text:'"light" | "dark"'},static:!1,readonly:!1,defaultValue:'"light"'},{name:"initialFontSize",visibility:"public",keywords:[],kind:"let",type:{kind:"union",type:[{kind:"const",type:"string",value:"normal",text:'"normal"'},{kind:"const",type:"string",value:"large",text:'"large"'},{kind:"const",type:"string",value:"xlarge",text:'"xlarge"'}],text:'"normal" | "large" | "xlarge"'},static:!1,readonly:!1,defaultValue:'"normal"'}],name:"AppHeaderInteractive.svelte"};const be={title:"Layout/AppHeader",component:w,args:{initialTheme:"light",initialFontSize:"normal"},render:(l,e)=>({Component:w,props:{initialTheme:e.globals.theme??l.initialTheme,initialFontSize:e.globals.fontSize??l.initialFontSize}}),parameters:{docs:{description:{component:"Header with working theme + text size controls. Uses the same `syncRootAppearance` as the app,\nso the Storybook canvas reflects light/dark CSS variables and root font scaling.\n\nUse the **Theme** and **Text size** toolbars for global canvas appearance; story-level `globals`\nbelow are shortcuts for common presets."}}}},g={args:{initialTheme:"light",initialFontSize:"normal"}},x={args:{initialTheme:"light",initialFontSize:"normal"},globals:{theme:"light",fontSize:"normal"}},S={args:{initialTheme:"dark",initialFontSize:"normal"},globals:{theme:"dark",fontSize:"normal"}},z={args:{initialTheme:"light",initialFontSize:"large"},globals:{theme:"light",fontSize:"large"}},T={args:{initialTheme:"dark",initialFontSize:"xlarge"},globals:{theme:"dark",fontSize:"xlarge"}};var C,U,E,O,R;g.parameters={...g.parameters,docs:{...(C=g.parameters)==null?void 0:C.docs,source:{originalSource:`{
  args: {
    initialTheme: 'light',
    initialFontSize: 'normal'
  }
}`,...(E=(U=g.parameters)==null?void 0:U.docs)==null?void 0:E.source},description:{story:"Default: follow toolbar (light + normal).",...(R=(O=g.parameters)==null?void 0:O.docs)==null?void 0:R.description}}};var V,B,I;x.parameters={...x.parameters,docs:{...(V=x.parameters)==null?void 0:V.docs,source:{originalSource:`{
  args: {
    initialTheme: 'light',
    initialFontSize: 'normal'
  },
  globals: {
    theme: 'light',
    fontSize: 'normal'
  }
}`,...(I=(B=x.parameters)==null?void 0:B.docs)==null?void 0:I.source}}};var N,P,j;S.parameters={...S.parameters,docs:{...(N=S.parameters)==null?void 0:N.docs,source:{originalSource:`{
  args: {
    initialTheme: 'dark',
    initialFontSize: 'normal'
  },
  globals: {
    theme: 'dark',
    fontSize: 'normal'
  }
}`,...(j=(P=S.parameters)==null?void 0:P.docs)==null?void 0:j.source}}};var G,K,J;z.parameters={...z.parameters,docs:{...(G=z.parameters)==null?void 0:G.docs,source:{originalSource:`{
  args: {
    initialTheme: 'light',
    initialFontSize: 'large'
  },
  globals: {
    theme: 'light',
    fontSize: 'large'
  }
}`,...(J=(K=z.parameters)==null?void 0:K.docs)==null?void 0:J.source}}};var M,Q,W;T.parameters={...T.parameters,docs:{...(M=T.parameters)==null?void 0:M.docs,source:{originalSource:`{
  args: {
    initialTheme: 'dark',
    initialFontSize: 'xlarge'
  },
  globals: {
    theme: 'dark',
    fontSize: 'xlarge'
  }
}`,...(W=(Q=T.parameters)==null?void 0:Q.docs)==null?void 0:W.source}}};const fe=["Playground","Light","Dark","LargeText","DarkLargeText"];export{S as Dark,T as DarkLargeText,z as LargeText,x as Light,g as Playground,fe as __namedExportsOrder,be as default};
