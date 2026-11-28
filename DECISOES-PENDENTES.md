# Decisões pendentes

Lista do que ainda precisa ser decidido ou construído, em ordem de prioridade.

---

## Prioridade 1 · Segurança e privacidade que possamos afirmar

Queremos mostrar no produto (login, site, rodapé do app) três selos:

| Selo | Texto | Situação hoje |
|---|---|---|
| Criptografia | AES-256 · TLS 1.3 | **Parcial.** Ver abaixo. |
| Conformidade com a LGPD | Auditoria contínua | **Não existe ainda.** |
| Os dados pertencem a você | Portabilidade total | **Não existe ainda.** |

Regra: nenhum selo vai para a tela antes de ser verdade no sistema. Selo falso em app de saúde é risco jurídico (LGPD art. 6º, transparência) e de confiança.

### 1.1 Criptografia (AES-256 · TLS 1.3)

O que já é verdade:

- **Em trânsito:** HTTPS na Vercel. Precisa confirmar e forçar TLS 1.3 (e no mínimo 1.2) no domínio de produção.
- **Em repouso, na aplicação:** o servidor cifra com AES-256-GCM (chave `CERT_KEY`) antes de gravar no Supabase:
  - registros do paciente (humor, diário, pauta, receitas);
  - prontuário (`notes`) e prioridade dos assuntos (`triage`);
  - documentos (título, texto e PDF) e pedidos de documento;
  - certificado digital e a senha dele;
  - preferências.

O que falta:

- Nome e e-mail das contas não têm essa cifra extra. Só contam com a proteção padrão do Supabase.
- **Não é ponta a ponta.** O servidor guarda a chave e consegue ler os dados.

**Decisão: adotar criptografia ponta a ponta?**

Ponta a ponta significa que só os aparelhos do paciente e da psicóloga têm as chaves. Nem o servidor, nem a Vercel, nem o Supabase conseguiriam ler os dados.

Impactos que precisam de resposta antes:

1. **Recuperação de senha:** se a chave vem da senha, perder a senha é perder os dados. Precisa de uma chave de recuperação (frase ou arquivo) guardada pelo usuário.
2. **Vários aparelhos:** cada aparelho novo precisa receber a chave de um aparelho já confiável.
3. **Assinatura do PDF:** hoje o servidor assina com o certificado ICP-Brasil. Com ponta a ponta, a assinatura teria que acontecer no navegador da psicóloga.
4. **Diário compartilhado:** hoje o servidor tira as entradas privadas antes de entregar ao painel. Com ponta a ponta, o paciente cifraria cada entrada compartilhada também para a chave da psicóloga.
5. **Resumos e análises:** já rodam no navegador (`src/insights.js`), então não mudam.

Alternativa intermediária: manter a cifra no servidor, mas com a chave num cofre (KMS) separado da aplicação, troca periódica da chave e registro de quem decifrou o quê. Não é ponta a ponta, mas reduz quem consegue ler.

### 1.2 Conformidade com a LGPD (auditoria contínua)

Hoje não existe registro de auditoria. Para o selo ser verdade:

- Log de acesso a dado de saúde: quem leu ou alterou o registro de qual paciente, e quando. O log fica só para leitura e não pode ser apagado pela aplicação.
- Tela para o paciente ver quem acessou os dados dele (LGPD art. 18, II).
- Registro do consentimento: versão do termo aceito e data. Hoje existe o aceite no cadastro, mas a versão não é guardada.
- Revogação do consentimento e exclusão da conta pelo app (art. 18, VI e IX).
- Nomear um encarregado (DPO) e publicar o contato.
- Relatório de impacto (RIPD), porque há dado sensível de saúde (art. 38).
- **Decisão:** prazo de guarda do prontuário. A Resolução CFP 01/2009 pede guarda mínima de 5 anos. Isso conflita com o pedido de exclusão; a resposta comum é anonimizar o que não pode ser apagado.

### 1.3 Os dados pertencem a você (portabilidade total)

Hoje não existe exportação. Para o selo ser verdade:

- **Paciente:** baixar todos os próprios registros em formato aberto (JSON e PDF legível): humor, sono, diário, pauta, documentos recebidos.
- **Psicóloga:** exportar pacientes, prontuários e documentos para trocar de sistema.
- **Decisão:** o que vai na exportação do paciente. O prontuário da psicóloga (`notes`) é documento dela, não do paciente. O CFP prevê acesso do paciente ao prontuário mediante solicitação. Definir se isso entra no app ou é por pedido.

---

## Prioridade 2 · Leitura de documentos sem IA

- **Nota fiscal (PDF):** ler o texto do PDF e conferir número, emissão, competência, CPF do tomador, prestador e valor antes de enviar ao paciente. Sem modelo, só extração de texto e regras.
- **Receita digital (PDF):** extrair médico, CRM/UF, medicamento, dose e posologia como sugestão de preenchimento. Validar a assinatura ICP-Brasil quando houver.
- **Foto de receita:** fica de fora. Ler foto exige OCR, que usa um modelo treinado (Tesseract roda local, mas é uma rede neural). **Decisão:** aceitar OCR local como "leitura aproximada", ou manter preenchimento manual.

## Prioridade 3 · Produto e marca

- **Identidade "Onda":** hoje só no modo `?demo`. Decidir se vira o visual de todas as contas.
- **CID-11:** um CID por paciente hoje. Decidir se aceita mais de um (comorbidades).
- **Risco de suicídio / autolesão:** campo manual com data da avaliação. Decidir se pede revisão periódica (por exemplo, a cada 30 dias) e se o alerta "risco alto sem reavaliação" entra no painel.

## Evoluções futuras

- **Testes automatizados:** por enquanto não escrevemos testes novos. Os que já existem continuam rodando. Quando o produto estabilizar, voltar a cobrir: linha do tempo (`timeline` em `src/panel/Profile.js`), narrativa do relatório (`narrative`), gráficos no PDF assinado (`server/lib/signpdf.mjs`) e o seletor de data (`DateField` em `src/ui.js`).
