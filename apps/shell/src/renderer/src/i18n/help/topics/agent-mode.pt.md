# Modo agente

O agente usa como projeto uma pasta que escolher e executa nela o Claude Code ou o Codex deste PC. A IA lê sozinha o material da pasta, cria ficheiros novos, usa habilidades e scripts, e edita os documentos abertos no GenOffice. Use-o para trabalhos que se apoiam em muito material.

## Antes de começar

- Uma assinatura do Claude ou uma assinatura do ChatGPT conectada em **Configurações ▸ IA**. O tópico «Conexão por assinatura» explica como.
- Uma pasta com o seu material. Não é possível escolher uma unidade inteira, toda a sua pasta pessoal nem pastas com dados de início de sessão ou de aplicações.

## Iniciar uma sessão

1. No ecrã Início, clique no cartão **Agente**. A janela do agente abre-se à parte.
2. Clique em **Escolher uma pasta…** para selecionar a pasta do projeto. As pastas usadas recentemente aparecem em **Pastas recentes**.
3. Em **Programa**, escolha o Claude Code ou o Codex. Um programa que não esteja conectado não pode ser escolhido.
4. Em **Quando perguntar a você**, escolha como o agente pede permissão (tabela abaixo).
5. Na primeira vez, leia **Antes de começar** e clique em **Entendi**.
6. Clique em **Iniciar**, escreva o que quer que seja feito e clique em **Enviar**.

Uma janela é uma sessão. Fechar a janela ou clicar em **Parar** termina a sessão, e o programa que o GenOffice iniciou para ela também é encerrado. Uma sessão termina também após 30 minutos sem nada enviado.

## Como o agente pergunta

| Opção                                                | Faz sem perguntar                                                     | Pergunta primeiro                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Perguntar antes de cada comando** (predefinida)    | Ler e gravar ficheiros na pasta do projeto, editar documentos abertos | Executar um comando ou script, ler fora da pasta do projeto          |
| **Perguntar antes de gravar e de executar comandos** | Ler ficheiros na pasta do projeto, editar documentos abertos          | Gravar um ficheiro, executar um comando ou script, ler fora da pasta |
| **Confiar neste projeto**                            | Quase tudo                                                            | Ler fora da pasta do projeto                                         |

Quando o agente pergunta, a janela mostra o que ele quer fazer (o comando completo, o caminho do ficheiro). Clique em **Permitir** ou **Recusar**.

Seja qual for a opção, o agente nunca:

- Substitui o ficheiro de um documento aberto num separador do GenOffice. Os documentos abertos são editados através da aplicação, por isso a alteração aparece logo no editor e o desfazer do editor anula-a.
- Grava fora da pasta do projeto.
- Toca nos dados de início de sessão do Claude ou do Codex, nem na pasta de dados do GenOffice.

## Claude Code e Codex

- O **Codex** executa os comandos no seu próprio espaço isolado, incluindo os que permitir. Só pode gravar na pasta do projeto, a internet fica bloqueada e não consegue ler os seus ficheiros pessoais fora do projeto. Quando uma sessão começa, o GenOffice verifica primeiro se este isolamento funciona neste PC, e não inicia se não funcionar.
- O **Claude Code** não consegue isolar comandos no Windows. Um comando que permitir pode chegar a todo o PC e à internet. É por isso que, em **Confiar neste projeto**, é o próprio revisor do Claude Code que verifica cada ação no seu lugar.

Um documento que alguém lhe enviou pode trazer instruções escondidas que mandam a IA fazer outra coisa. Numa pasta com material que não conhece, use uma das opções que perguntam.

## Notas do projeto e habilidades

- Se a pasta tiver um `CLAUDE.md` ou um `AGENTS.md`, o conteúdo é entregue ao agente como instruções. Escreva lá o que deve valer sempre: o tom, os termos, o formato dos documentos a criar.
- O Claude Code recebe uma cópia das habilidades destes locais: `.claude/skills` na pasta do projeto, `.ieumoffice/skills` e `.claude/skills` na sua pasta pessoal, e as habilidades dos plugins do Claude instalados. O número de habilidades disponíveis aparece por baixo da linha que indica que a sessão começou.
- O Codex lê sozinho a sua própria pasta de habilidades.
- Os programas que os scripts de uma habilidade usam (Python, etc.) têm de estar instalados neste PC.

## Ficheiros novos e documentos abertos

- Os ficheiros novos que o agente cria são guardados na pasta do projeto. Clique em **Abrir** nessa linha do registo de progresso para abrir o ficheiro num separador do GenOffice.
- Para que um documento aberto seja editado, abra-o primeiro no GenOffice e indique o nome dele no seu pedido.
- Um documento que abrir durante uma sessão pode ser editado a partir da sua mensagem seguinte.

## Privacidade e utilização

- O que ocultou da IA só fica oculto quando a aplicação lê para o agente um documento aberto no GenOffice. Os ficheiros que o agente lê sozinho da pasta são enviados tal como estão.
- O agente trabalha em muitos passos, por isso gasta mais do limite da sua assinatura do que o painel de IA. Quando o limite se esgota, o pedido falha; o agente nunca passa para outra IA nem para uma conexão paga.

## Se algo correr mal

| O que a janela diz                                     | O que fazer                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| **Não conectado**                                      | Inicie sessão nesse programa em **Configurações ▸ IA**.           |
| **Esta pasta não pode ser usada**                      | Escolha uma pasta que contenha apenas o seu material de trabalho. |
| **O Codex não consegue abrir neste PC a área isolada** | Atualize o Windows ou escolha o Claude Code.                      |
| **O limite da sua assinatura acabou**                  | Envie novamente depois de o limite ser reposto.                   |
| **O programa é antigo demais para o modo agente**      | Atualize esse programa e depois clique em **Nova sessão**.        |
