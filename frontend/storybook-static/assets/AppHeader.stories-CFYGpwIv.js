import{p as r,t as N,e as W,a as j,b as J,s as Q,d as s,a3 as X,g as Y,h as Z,ae as f,aO as $,k as y,ao as x}from"./iframe-CupTzWOG.js";import"./legacy-DK2xKQzJ.js";import{s as l}from"./attributes-DzfAh2fJ.js";import{s as ee}from"./class-DvJjGPJo.js";import"./preload-helper-Dp1pzeXC.js";import"./select-DVWWhn_u.js";const te=""+new URL("gov_uk-BNEy2LFB.webp",import.meta.url).href;var ae=J('<header class="app-header"><div class="app-header-main"><div class="app-header-top"><div class="app-header-brand"><div class="govuk-logo"><img alt="GOV.UK" class="govuk-logo__crest"/> <span class="govuk-logo__text"></span></div> <div><h1>Caseworker task manager</h1> <p>Capture, prioritise, and complete tasks.</p></div></div> <button type="button" aria-haspopup="dialog"><span class="btn-help-bars" aria-hidden="true"><span class="btn-help-bar btn-help-bar--top"></span> <span class="btn-help-bar btn-help-bar--bottom"></span></span></button></div></div></header>');function E(t,e){let a=r(e,"menuOpen",8,!1),h=r(e,"onToggleMenu",8),d=r(e,"ariaHidden",8,!1);var i=ae(),I=s(i),P=s(I),b=s(P),q=s(b),G=s(q),n=Q(b,2);let v;N(()=>{l(i,"aria-hidden",d()?!0:void 0),l(G,"src",te),v=ee(n,1,"btn-help",null,v,{"btn-help--open":a()}),l(n,"aria-expanded",a()),l(n,"aria-label",a()?"Close menu":"Open menu"),l(n,"title",a()?"Close menu":"Open menu")}),W("click",n,function(...K){var k;(k=h())==null||k.apply(this,K)}),j(t,i)}E.__docgen={data:[{name:"menuOpen",visibility:"public",keywords:[],kind:"let",type:{kind:"type",type:"boolean",text:"boolean"},static:!1,readonly:!1,defaultValue:"false"},{name:"onToggleMenu",visibility:"public",keywords:[{name:"required",description:""}],kind:"let",type:{kind:"function",text:"() => void"},static:!1,readonly:!1},{name:"ariaHidden",visibility:"public",description:"When true (e.g. mobile expanded search), header is visually hidden; keep SR in sync.",keywords:[],kind:"let",type:{kind:"type",type:"boolean",text:"boolean"},static:!1,readonly:!1,defaultValue:"false"}],name:"AppHeader.svelte"};function u(t,e){Z(e,!0);let a=r(e,"initialTheme",3,"light"),h=r(e,"initialFontSize",3,"md"),d=x("light"),i=x("md");X(()=>{f(d,a()),f(i,h()),$(y(d),y(i))}),E(t,{menuOpen:!1,onToggleMenu:()=>{}}),Y()}u.__docgen={data:[{name:"initialTheme",visibility:"public",description:"Driven by Storybook globals via `render` in the meta.",keywords:[],kind:"let",type:{kind:"union",type:[{kind:"const",type:"string",value:"light",text:'"light"'},{kind:"const",type:"string",value:"dark",text:'"dark"'}],text:'"light" | "dark"'},static:!1,readonly:!1,defaultValue:'"light"'},{name:"initialFontSize",visibility:"public",keywords:[],kind:"let",type:{kind:"union",type:[{kind:"const",type:"string",value:"xs",text:'"xs"'},{kind:"const",type:"string",value:"sm",text:'"sm"'},{kind:"const",type:"string",value:"md",text:'"md"'},{kind:"const",type:"string",value:"lg",text:'"lg"'},{kind:"const",type:"string",value:"xl",text:'"xl"'},{kind:"const",type:"string",value:"xxl",text:'"xxl"'}],text:'"xs" | "sm" | "md" | "lg" | "xl" | "xxl"'},static:!1,readonly:!1,defaultValue:'"md"'}],name:"AppHeaderInteractive.svelte"};const de={title:"Layout/AppHeader",component:u,args:{initialTheme:"light",initialFontSize:"md"},render:(t,e)=>({Component:u,props:{initialTheme:e.globals.theme??t.initialTheme,initialFontSize:e.globals.fontSize??t.initialFontSize}}),parameters:{docs:{description:{component:"Header with working theme + text size controls. Uses the same `syncRootAppearance` as the app,\nso the Storybook canvas reflects light/dark CSS variables and root font scaling.\n\nUse the **Theme** and **Text size** toolbars for global canvas appearance; story-level `globals`\nbelow are shortcuts for common presets."}}}},o={args:{initialTheme:"light",initialFontSize:"md"}},p={args:{initialTheme:"light",initialFontSize:"md"},globals:{theme:"light",fontSize:"md"}},m={args:{initialTheme:"dark",initialFontSize:"md"},globals:{theme:"dark",fontSize:"md"}},c={args:{initialTheme:"light",initialFontSize:"lg"},globals:{theme:"light",fontSize:"lg"}},g={args:{initialTheme:"dark",initialFontSize:"xl"},globals:{theme:"dark",fontSize:"xl"}};var S,z,T,_,F;o.parameters={...o.parameters,docs:{...(S=o.parameters)==null?void 0:S.docs,source:{originalSource:`{
  args: {
    initialTheme: 'light',
    initialFontSize: 'md'
  }
}`,...(T=(z=o.parameters)==null?void 0:z.docs)==null?void 0:T.source},description:{story:"Default: follow toolbar (light + normal).",...(F=(_=o.parameters)==null?void 0:_.docs)==null?void 0:F.description}}};var w,L,H;p.parameters={...p.parameters,docs:{...(w=p.parameters)==null?void 0:w.docs,source:{originalSource:`{
  args: {
    initialTheme: 'light',
    initialFontSize: 'md'
  },
  globals: {
    theme: 'light',
    fontSize: 'md'
  }
}`,...(H=(L=p.parameters)==null?void 0:L.docs)==null?void 0:H.source}}};var O,A,C;m.parameters={...m.parameters,docs:{...(O=m.parameters)==null?void 0:O.docs,source:{originalSource:`{
  args: {
    initialTheme: 'dark',
    initialFontSize: 'md'
  },
  globals: {
    theme: 'dark',
    fontSize: 'md'
  }
}`,...(C=(A=m.parameters)==null?void 0:A.docs)==null?void 0:C.source}}};var D,V,M;c.parameters={...c.parameters,docs:{...(D=c.parameters)==null?void 0:D.docs,source:{originalSource:`{
  args: {
    initialTheme: 'light',
    initialFontSize: 'lg'
  },
  globals: {
    theme: 'light',
    fontSize: 'lg'
  }
}`,...(M=(V=c.parameters)==null?void 0:V.docs)==null?void 0:M.source}}};var R,U,B;g.parameters={...g.parameters,docs:{...(R=g.parameters)==null?void 0:R.docs,source:{originalSource:`{
  args: {
    initialTheme: 'dark',
    initialFontSize: 'xl'
  },
  globals: {
    theme: 'dark',
    fontSize: 'xl'
  }
}`,...(B=(U=g.parameters)==null?void 0:U.docs)==null?void 0:B.source}}};const pe=["Playground","Light","Dark","LargeText","DarkLargeText"];export{m as Dark,g as DarkLargeText,c as LargeText,p as Light,o as Playground,pe as __namedExportsOrder,de as default};
