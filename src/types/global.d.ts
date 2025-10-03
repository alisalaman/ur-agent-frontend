// Global type declarations for modules that don't have proper TypeScript definitions
declare module 'nunjucks' {
  const nunjucks: any;
  export = nunjucks;
}

declare module '@hapi/cookie' {
  const cookie: any;
  export = cookie;
}

declare module '@hapi/joi' {
  const joi: any;
  export = joi;
}
