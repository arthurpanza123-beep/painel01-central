# XCloud real flow

Este documento registra o fluxo real observado no bot antigo e a fundacao criada no painel novo para a aba **Gerar Teste**. O objetivo atual e preparar contratos, mocks e persistencia segura; chamadas reais continuam desabilitadas ate autorizacao explicita.

## Arquivos auditados no bot antigo

- `/opt/centralplay-plus/apps/bot-telegram/src/xcloud.js`
- `/opt/centralplay-plus/apps/bot-telegram/src/services/xcloud.js`
- `/opt/centralplay-plus/apps/bot-telegram/src/services/ninety.js`
- `/opt/centralplay-plus/apps/bot-telegram/src/config.js`
- `/opt/centralplay-plus/apps/bot-telegram/.env.example`

## Variaveis necessarias

Valores reais foram lidos localmente apenas para confirmar presenca. Nao copie credenciais para codigo ou docs.

| Variavel | Uso | Estado observado |
| --- | --- | --- |
| `XCLOUD_PANEL_URL` | URL de login/dashboard XCloud | configurada, host mascarado |
| `XCLOUD_DEVICES_URL` | URL direta da lista de dispositivos | configurada, host mascarado |
| `XCLOUD_CUSTOM_PLAYLIST_URL` | URL com `{DEVICE_KEY}` para playlist customizada | configurada, host mascarado |
| `XCLOUD_EMAIL` | login do painel | configurado, mascarado |
| `XCLOUD_PASSWORD` | senha do painel | configurado |
| `XCLOUD_PROFILE_DIR` | perfil persistente do Playwright | configurado |
| `HEADLESS`, `SLOW_MO_MS`, `XCLOUD_PAGE_TIMEOUT_MS` | comportamento do navegador | configurados |
| `XCLOUD_DEVICE_KEY_SELECTOR` | override opcional do campo device key | vazio |
| `XCLOUD_PLAYLIST_URL_SELECTOR` | override opcional do campo playlist | vazio |
| `XCLOUD_SAVE_SELECTOR` | override opcional de salvar playlist | vazio |
| `XCLOUD_ADD_DEVICE_SELECTOR` | override opcional do botao novo dispositivo | vazio |
| `XCLOUD_DEVICES_MENU_SELECTOR` | override opcional do menu dispositivos | vazio |
| `XCLOUD_OWN_PLAYLIST_SELECTOR` | override opcional de playlist propria | vazio |
| `NINETY_API_URL` | endpoint primario de teste | configurado, host mascarado |
| `BRASILTV_API_URL` | endpoint fallback/Yellow/BrasilTV | configurado, host mascarado |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | persistencia do bot antigo | configurados, mascarados |

## Fluxo antigo XCloud

1. Abrir `XCLOUD_PANEL_URL` com Playwright persistente.
2. Detectar se ja esta no painel ou se precisa de login.
3. Preencher email/senha por seletores robustos (`email`, `username`, placeholders e labels).
4. Clicar em `Entrar`, `Login`, `Sign in` ou `Acessar`.
5. Se necessario, abrir o painel antigo.
6. Abrir a tela de `Dispositivos`.
7. Clicar em adicionar novo dispositivo.
8. Preencher a device key.
9. Selecionar ativacao imediata quando o painel exigir.
10. Marcar `playlist propria` / `own playlist`.
11. Salvar e confirmar que o dispositivo apareceu na tabela.
12. Gerar ou receber teste de painel externo.
13. Extrair M3U do retorno.
14. Abrir `XCLOUD_CUSTOM_PLAYLIST_URL` substituindo `{DEVICE_KEY}`.
15. Encontrar campo de playlist por heuristica de `playlist`, `m3u`, `url`, `custom`, `own`.
16. Colar M3U.
17. Clicar em salvar.
18. Voltar ao dashboard de dispositivos e procurar status `Success` ou evidencias de URL salva.
19. Em falha, gerar screenshot/debug.

## Seletores e heuristicas atuais

O bot antigo prefere role/text/label/CSS ao inves de um seletor unico. Os overrides por `.env` existem, mas no ambiente atual estavam vazios:

- `XCLOUD_DEVICE_KEY_SELECTOR`
- `XCLOUD_PLAYLIST_URL_SELECTOR`
- `XCLOUD_SAVE_SELECTOR`
- `XCLOUD_ADD_DEVICE_SELECTOR`
- `XCLOUD_DEVICES_MENU_SELECTOR`
- `XCLOUD_OWN_PLAYLIST_SELECTOR`

Em `src/xcloud.js`, o preenchimento de playlist usa varredura de `input`, `textarea` e `contenteditable`, pontuando textos proximos com palavras como `playlist`, `m3u`, `url`, `custom` e `own`. Campos de `host`, `device`, `password`, `search` etc. recebem penalidade.

## Pontos frageis

- Mudanca visual do painel XCloud quebra seletores e labels.
- Login pode falhar por captcha, 2FA, sessao expirada ou overlays.
- A tabela de dispositivos pode demorar para atualizar, gerando falso negativo.
- O status da playlist pode aparecer sem badge `Success`.
- O fluxo de playlist antigo depende de M3U, mas a operacao quer padronizar Xtream.
- Device key e M3U sao dados sensiveis; logs precisam mascarar.
- Screenshots de erro ajudam debug, mas nao devem ser commitados.
- O painel externo pode devolver texto, JSON, campos com nomes variados ou links alternativos.

## Adaptacao para Xtream

No painel novo, a UI deve tratar Xtream como formato principal:

- `xtream_host`
- `xtream_username`
- `xtream_password`

M3U/HLS ficam em metadata tecnica:

- `optional_m3u_url`
- `optional_hls_url`

Quando o XCloud ainda exigir M3U, o adapter interno pode montar:

```text
{xtream_host}/get.php?username={xtream_username}&password={xtream_password}&type=m3u_plus&output=mpegts
```

Esse M3U derivado nao deve virar campo principal da UI. Ele serve apenas para compatibilidade tecnica do XCloud.

## Fundacao criada no painel novo

Arquivos:

- `lib/services/test-generation/types.ts`
- `lib/services/test-generation/generate-test.ts`
- `lib/services/test-generation/providers/yellow.ts`
- `lib/services/test-generation/providers/ninety.ts`
- `lib/services/test-generation/providers/manual.ts`
- `lib/services/test-generation/xcloud/activate-xcloud.ts`
- `lib/services/test-generation/xcloud/steps.ts`
- `lib/services/test-generation/message-template.ts`

Contrato principal:

- Apps: `xcloud`, `blessed`, `playsim`, `smartstb`, `manual`
- Providers: `yellowbox`, `ninety`, `manual`
- Connection: `xtream_host`, `xtream_username`, `xtream_password`, `provider_code`, `optional_m3u_url`, `optional_hls_url`

## Regra de slots

Teste nao ocupa tela. A rota mock nova nao cria `accounts` nem `account_slots`.

Tela/slot so deve entrar no fluxo de **Ativacoes**, quando o cliente pagou e virou cliente ativo.

## Fallbacks recomendados

- Manter mock local sempre disponivel.
- Salvar `tests.legacy_metadata` com flags de conexao, sem depender de `accounts`.
- So habilitar chamada real por feature flag explicita.
- Fazer provider real Yellow/Ninety retornar contrato unico `ProviderMockResult`/equivalente real.
- No XCloud real, separar `add device` de `save playlist` para retry individual.
- Para Xtream, sempre conseguir derivar M3U tecnico quando o painel XCloud nao aceitar host/user/pass direto.
- Salvar screenshots de erro fora do git e mascarar URLs em logs.
