import { createOpenAPI } from 'fumadocs-openapi/server';

// The We1ssBoard OpenAPI spec is committed at public/openapi.json (synced from
// the upstream repo's frontend/public/openapi.json).
export const openapi = createOpenAPI({
  input: ['./public/openapi.json'],
});
