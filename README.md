# AMMA Creative

Site da **AMMA Creative** — artigos personalizados para bebés, mamãs e papás.
Vila Nova de Anha, Viana do Castelo.

- **Plano e decisões:** [PLANO.md](PLANO.md)
- **Backoffice:** [app.pagescms.org](https://app.pagescms.org) (a cliente entra por
  link enviado por email; não precisa de conta no GitHub)
- **Construir:** `node scripts/gerar.mjs` → `_site/`
- **Publicar:** automático a cada gravação, pela Action `publicar.yml`

`_fonte/` guarda a matéria-prima — o logótipo original e as 56 fotografias das
redes sociais. Não é servida no site; o que vai para o ar é o que sai de
`assets/` depois de tratado.
