/** Architecture boundaries. A violation fails `pnpm lint`. */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'lib-is-runtime-agnostic',
      comment: 'src/lib holds pure logic: no Astro and no UI, so it runs in tools and tests too',
      severity: 'error',
      from: { path: '^src/lib/' },
      to: {
        path: '(^src/(pages|components|layouts|data)/)|^astro|node_modules/astro',
      },
    },
    {
      name: 'schemas-are-leaf',
      severity: 'error',
      from: { path: '^src/schemas/' },
      to: { path: '^src/(?!schemas/)' },
    },
    {
      name: 'tools-do-not-import-ui',
      severity: 'error',
      from: { path: '^tools/' },
      to: { path: '^src/(pages|components|layouts)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    exclude: { path: '(dist|coverage|\\.astro)/' },
  },
};
