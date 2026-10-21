# Habilidades

Uma habilidade é um conjunto de instruções de trabalho para a IA. Anote de uma vez algo que você faz sempre — os passos para organizar anotações de reunião, o tom de um relatório, os pontos a conferir toda vez — e você poderá chamá-la no painel de IA, ou a IA vai usá-la por conta própria quando ela servir. Uma habilidade é uma pasta com um arquivo `SKILL.md` num formato aberto, então uma habilidade criada no GenOffice também funciona do jeito que está no Claude Code ou no Codex.

## Ativar e desativar habilidades

**Configurações ▸ Habilidades** lista as habilidades deste PC, agrupadas pela origem. Use a caixa de busca no topo para encontrar uma por título, nome ou descrição.

| Origem                             | O que contém                                                     | No início   |
| ---------------------------------- | ---------------------------------------------------------------- | ----------- |
| **Integradas**                     | As 5 habilidades que vêm com o GenOffice                         | Ativadas    |
| **Minhas habilidades**             | Habilidades que você adicionou ou criou (`~/.ieumoffice/skills`) | Ativadas    |
| **Pasta de habilidades do Claude** | As habilidades em `~/.claude/skills`                             | Desativadas |
| **Plugins do Claude**              | As habilidades dos plugins do Claude instalados                  | Desativadas |
| **Pasta de habilidades do Codex**  | As habilidades em `~/.agents/skills`                             | Desativadas |

- O interruptor ativa ou desativa uma habilidade. A mesma configuração vale para o painel de IA de todos os editores, para o Ask AI do Início e para a janela do agente.
- Para uma habilidade ativada, escolha **A IA decide** ou **Só quando chamada**. No início fica em A IA decide. Com Só quando chamada, a habilidade só é usada quando você mesmo a chama.
- Habilidades de origens diferentes podem ter o mesmo nome. O rótulo de origem em cada linha as diferencia.
- O menu de mais opções tem **Ver conteúdo**, **Editar** (só minhas habilidades), **Exportar (zip)** (só minhas habilidades) e **Abrir pasta**.
- **Mover para a lixeira** manda uma das minhas habilidades para a lixeira do sistema, de onde você pode restaurá-la.
- Uma habilidade integrada é ocultada em vez de removida: escolha **Ocultar**. **Mostrar de novo**, no fim da lista, traz a habilidade de volta como era no início.
- Para alterar uma habilidade integrada ou de outro programa, escolha **Copiar para minhas habilidades**. A cópia aparece em minhas habilidades e a original é desativada.
- Ao exportar uma habilidade com modelo, o documento de modelo também vai no zip. Verifique se o documento não contém informações pessoais antes de exportar.

## Adicionar uma habilidade

1. Em **Configurações ▸ Habilidades**, clique em **Adicionar**.
2. Escolha **De uma pasta**, **De um arquivo zip** ou **De um link do GitHub**. Para o GitHub, digite o endereço de um repositório público ou `owner/repo` e clique em **Buscar**.
3. Confira na pré-visualização as habilidades encontradas. Ela mostra o número e o tamanho dos arquivos, se há scripts, os endereços da web citados no texto e o arquivo de licença.
4. Marque só as habilidades que quer instalar e clique em **Instalar**. As habilidades instaladas já começam ativadas.

Abaixo da pré-visualização sempre aparece: «Instale habilidades somente de fontes confiáveis. Uma habilidade dá instruções à IA e, na janela do agente, pode executar scripts.» Leia uma habilidade de origem desconhecida antes de instalá-la.

- Se minhas habilidades já tiver uma com o mesmo nome, escolha **Substituir** ou **Pular** nessa linha.
- Ao baixar do GitHub, o GenOffice se conecta somente a `github.com`, `api.github.com` e `codeload.github.com`, e não envia nenhum dado de login. Se o pacote for grande demais ou não passar nas verificações de segurança, nada é instalado.
- **Nova habilidade** abre um editor vazio onde você mesmo escreve o título, a descrição e as instruções.

## Verificar atualizações

- Para uma habilidade instalada do GitHub, **Verificar atualizações** no menu de mais opções procura conteúdo novo. O GitHub só é contatado quando você clica.
- Se nada mudou, aparece «Atualizada». Se algo mudou, revise os arquivos alterados e a pré-visualização e clique em **Atualizar**.
- Se você editou a habilidade depois de instalá-la, aparece também «Suas edições serão perdidas».
- A atualização mantém o estado ativado ou desativado da habilidade e a escolha entre A IA decide e Só quando chamada.

## Chamar uma habilidade no painel de IA

1. Digite `/` ou `$` no início da caixa de entrada da IA ou logo depois de um espaço. A lista de habilidades ativadas aparece.
2. Continue digitando para filtrar a lista. Por exemplo, `/ata` encontra Atas de reunião.
3. Escolha uma com as setas e pressione Enter ou Tab. A habilidade vira um chip acima da caixa de entrada.
4. Escreva o que quer e envie. O GenOffice acrescenta o conteúdo da habilidade ao pedido.

- No painel de IA do Excel, `$` só abre a lista bem no início da caixa de entrada, para não atrapalhar endereços de célula como `$A$1`.
- Você pode adicionar vários chips e remover um com ×. Esc só fecha a lista; não interrompe uma execução da IA.
- **Gerenciar habilidades…**, no fim da lista, abre **Configurações ▸ Habilidades**.
- Os chips ficam na mensagem enviada e no chat salvo. Quando você reabre um chat e envia de novo, o conteúdo atual da habilidade é lido outra vez. Uma habilidade removida ou desativada nesse meio-tempo aparece como «Indisponível» no seu chip.
- Se o texto das habilidades a enviar junto for longo demais, aparece «As habilidades são grandes demais para enviar junto» e nada é enviado.

## Habilidades que a IA usa por conta própria

- Para as habilidades ativadas e configuradas como A IA decide, os títulos e as descrições são passados à IA como uma lista. Quando uma combina com o pedido, a IA pega o conteúdo dela e a usa.
- Quando a IA usa uma habilidade, o chat diz «Habilidade 〈título〉 usada».
- A IA decide pela descrição se vai usar uma habilidade. Uma descrição que diga quando a habilidade deve ser usada ajuda a IA a escolher bem.

## Criar uma habilidade pedindo

1. No painel de IA, diga algo como «Salve o que acabamos de fazer como habilidade» ou «Crie uma habilidade que escreva relatórios no estilo da nossa equipe».
2. A IA separa os passos e as regras que vale a pena repetir e mostra um cartão **Nova habilidade**. Valores usados só desta vez, como nomes e datas, ficam fora das instruções.
3. Confira e edite o título, a descrição e as instruções no cartão. Abra **Avançado** para mudar o nome em inglês.
4. Clique em **Salvar**. A nova habilidade é adicionada a minhas habilidades, já ativada, e aparece na hora na lista de `/`.

- Nenhum arquivo é gravado até você clicar em **Salvar**. Se clicar em **Cancelar**, o chat a guarda só como «Proposta de habilidade não salva».
- Você também pode pedir para alterar uma habilidade existente, por exemplo «Altere a habilidade de atas para o nosso jeito de fazer». O cartão passa a se chamar **Alterar habilidade**. Uma das minhas habilidades é sobrescrita com **Substituir**; uma habilidade integrada ou de outro programa é salva como cópia em minhas habilidades e a original é desativada.

## Adicionar um documento como modelo

Quando você cria uma habilidade no painel de IA de um editor, o documento atual pode ir junto como modelo. Marque **Salvar também este documento como modelo** no cartão, e o botão vira dois.

- **Criar um modelo em branco**: uma cópia do documento abre numa nova aba, «Pré-visualização do modelo - 〈título〉», e a IA dessa aba apaga os valores preenchidos, como nomes, datas e informações pessoais. Revise a aba, altere mais à mão se precisar e clique em **Salvar esta aba como modelo**; a aba como está naquele momento vira o modelo.
- **Salvar o documento como está**: salva o documento atual como modelo, sem alterações. Se o documento tiver partes que você ocultou da IA, esse botão fica bloqueado, para que o conteúdo oculto não acabe no modelo do jeito que está.
- O modelo é guardado como uma cópia do documento dentro da pasta da habilidade. O documento original não muda.

## Usar uma habilidade com modelo

- Uma habilidade com modelo mostra **Tem modelo** na lista.
- Chame-a como chip e envie: uma cópia do modelo abre como um novo documento sem título, e a IA dessa aba continua o seu pedido. O painel original mantém «O trabalho com o modelo continua numa nova aba» e **Ir para a aba**.
- Quando a IA escolhe sozinha uma habilidade com modelo, nenhuma aba abre na hora. Em vez disso, o chat mostra um botão **Abrir um novo documento com este modelo**.
- Você escolhe onde fica o novo documento na primeira vez que o salva. O arquivo de modelo em si continua como estava.

## Habilidades com scripts

- No painel de IA normal e no Ask AI do Início, os scripts de uma habilidade nunca são executados. Só o texto da habilidade chega à IA.
- Uma habilidade com scripts mostra **Tem scripts · funciona por completo na janela do agente**, e ao adicioná-la como chip aparece «Os scripts desta habilidade não são executados no painel de IA normal». O envio não é bloqueado.
- Para usar os scripts também, chame a habilidade na janela do agente. Veja [Modo agente](help://agent-mode).

## Habilidades integradas

| Habilidade                                  | O que faz                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Atas de reunião**                         | Transforma anotações de reunião em uma ata que mostra as decisões e as tarefas                   |
| **Avisos, boletins e perguntas frequentes** | Escreve avisos, boletins, relatórios de andamento, perguntas frequentes e outros textos internos |
| **Tirar o tom de IA**                       | Encontra em textos em inglês as expressões que parecem escritas por IA e as deixa naturais       |
| **Revisar o texto**                         | Revê um texto em inglês já escrito para deixá-lo mais claro e conciso                            |
| **Encontrar habilidades**                   | Encontra na janela do agente as habilidades de que você precisa e sugere instalá-las             |

Tirar o tom de IA e Revisar o texto foram feitas para textos em inglês. Encontrar habilidades só funciona na janela do agente.

## Na janela do agente

- A janela do agente segue as mesmas configurações de ativação de **Configurações ▸ Habilidades**, e você chama habilidades na caixa de entrada dela do mesmo jeito, com `/` ou `$`.
- As habilidades em `.claude/skills` e `.agents/skills` da pasta do projeto são usadas naquela sessão sem precisar ser ativadas.
- A lista de habilidades é fixada quando a sessão começa. Se você ativar ou desativar habilidades durante uma sessão, aparece «As habilidades alteradas valem a partir da próxima sessão».
- Quando o agente cria uma habilidade, o mesmo cartão aparece na janela. Para o modelo, escolha entre os documentos abertos em abas e os arquivos da pasta do projeto.
- Quando o agente encontra uma habilidade que vale a pena instalar, aparece uma proposta de instalação. Abra-a com **Abrir pré-visualização** e clique você mesmo em **Instalar**; caso contrário, nada é instalado. Uma habilidade instalada fica disponível a partir da próxima sessão.
