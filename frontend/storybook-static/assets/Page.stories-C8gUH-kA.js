import{a as h,b as v,ae as s,h as w,ao as y,d as b}from"./iframe-BS14FNgM.js";import{H as f}from"./Header-CA-3n2IK.js";import"./preload-helper-Dp1pzeXC.js";import"./Button-CUFq3eyv.js";import"./attributes-DDbB5mMF.js";import"./class-DvJjGPJo.js";import"./select-1qCOMaYV.js";var B=v(`<article><!> <section class="storybook-page"><h2>Pages in Storybook</h2> <p>We recommend building UIs with a <a href="https://blog.hichroma.com/component-driven-development-ce1109d56c8e" target="_blank" rel="noopener noreferrer"><strong>component-driven</strong></a> process starting with atomic components and ending with pages.</p> <p>Render pages with mock data. This makes it easy to build and review page states without
      needing to navigate to them in your app. Here are some handy patterns for managing page data
      in Storybook:</p> <ul><li>Use a higher-level connected component. Storybook helps you compose such data from the
        "args" of child component stories</li> <li>Assemble data in the page component from your services. You can mock these services out
        using Storybook.</li></ul> <p>Get a guided tutorial on component-driven development at <a href="https://storybook.js.org/tutorials/" target="_blank" rel="noopener noreferrer">Storybook tutorials</a> . Read more in the <a href="https://storybook.js.org/docs" target="_blank" rel="noopener noreferrer">docs</a> .</p> <div class="tip-wrapper"><span class="tip">Tip</span> Adjust the width of the canvas with the <svg width="10" height="10" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd"><path d="M1.5 5.2h4.8c.3 0 .5.2.5.4v5.1c-.1.2-.3.3-.4.3H1.4a.5.5 0
            01-.5-.4V5.7c0-.3.2-.5.5-.5zm0-2.1h6.9c.3 0 .5.2.5.4v7a.5.5 0 01-1 0V4H1.5a.5.5 0
            010-1zm0-2.1h9c.3 0 .5.2.5.4v9.1a.5.5 0 01-1 0V2H1.5a.5.5 0 010-1zm4.3 5.2H2V10h3.8V6.2z" id="a" fill="#999"></path></g></svg> Viewports addon in the toolbar</div></section></article>`);function d(a){let e=y(void 0);var t=B(),r=b(t);f(r,{get user(){return w(e)},onLogin:()=>s(e,{name:"Jane Doe"},!0),onLogout:()=>s(e,void 0),onCreateAccount:()=>s(e,{name:"Jane Doe"},!0)}),h(a,t)}d.__docgen={data:[],name:"Page.svelte"};const{expect:i,userEvent:k,waitFor:_,within:L}=__STORYBOOK_MODULE_TEST__,O={title:"Example/Page",component:d,parameters:{layout:"fullscreen"}},o={play:async({canvasElement:a})=>{const e=L(a),t=e.getByRole("button",{name:/Log in/i});await i(t).toBeInTheDocument(),await k.click(t),await _(()=>i(t).not.toBeInTheDocument());const r=e.getByRole("button",{name:/Log out/i});await i(r).toBeInTheDocument()}},n={};var c,p,l;o.parameters={...o.parameters,docs:{...(c=o.parameters)==null?void 0:c.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const loginButton = canvas.getByRole('button', {
      name: /Log in/i
    });
    await expect(loginButton).toBeInTheDocument();
    await userEvent.click(loginButton);
    await waitFor(() => expect(loginButton).not.toBeInTheDocument());
    const logoutButton = canvas.getByRole('button', {
      name: /Log out/i
    });
    await expect(logoutButton).toBeInTheDocument();
  }
}`,...(l=(p=o.parameters)==null?void 0:p.docs)==null?void 0:l.source}}};var m,g,u;n.parameters={...n.parameters,docs:{...(m=n.parameters)==null?void 0:m.docs,source:{originalSource:"{}",...(u=(g=n.parameters)==null?void 0:g.docs)==null?void 0:u.source}}};const R=["LoggedIn","LoggedOut"];export{o as LoggedIn,n as LoggedOut,R as __namedExportsOrder,O as default};
