# D01 — Fundação: scaffold, Supabase, Google OAuth, sessão e deploy

> Status: já implementado, em 10/06. Registro retroativo.

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

Esqueleto do projeto e infra de auth: app Next.js 16 (App Router) com TypeScript; projeto Supabase
na região `sa-east-1`; provider Google OAuth habilitado com os redirect URIs de localhost e da
Vercel; clients `@supabase/ssr` com sessão via *proxy*, já que o Next 16 substituiu o middleware; e
deploy público na Vercel.

## Critérios de aceite

- [x] App roda local e na Vercel, com URL pública
- [x] Login Google funciona local e em produção, com os redirect URIs cadastrados nos dois
- [x] Sessão persiste e renova via proxy

## Bloqueada por

Nada; podia começar imediatamente.
