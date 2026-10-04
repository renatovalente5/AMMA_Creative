# AMMA Creative

Site da **AMMA Creative** — artigos personalizados para bebés, mamãs e papás.
Vila Nova de Anha, Viana do Castelo.

- **Plano e decisões:** [PLANO.md](PLANO.md)
- **Backoffice:** o painel em [backoffice.ammacreative.pt](https://backoffice.ammacreative.pt)
  (repositório privado `amma-painel`; a cliente entra com um código que recebe
  por email, não precisa de conta no GitHub). Até 4 de Outubro de 2026 era o
  Pages CMS.
- **Regras dos dados:** `.github/regras.mjs` — as mesmas no painel (cópia byte a
  byte) e na guarda do CI (`.github/guardas.mjs`); a prova é
  `node .github/test-guardas.mjs`, em local.
- **Construir:** `node scripts/gerar.mjs` → `_site/`
- **Publicar:** automático a cada gravação, pela Action `publicar.yml`

`_fonte/` guarda a matéria-prima — o logótipo original e as 56 fotografias das
redes sociais. Não é servida no site; o que vai para o ar é o que sai de
`assets/` depois de tratado.
