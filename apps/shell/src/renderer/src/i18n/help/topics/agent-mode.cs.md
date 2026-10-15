# Režim agenta

Agent vezme jednu složku, kterou zvolíte, jako projekt a spustí v ní Claude Code nebo Codex z tohoto počítače. AI samo čte podklady ve složce, vytváří nové soubory, používá dovednosti a skripty a upravuje dokumenty otevřené v GenOffice. Hodí se na práci, která čerpá z velkého množství podkladů.

## Než začnete

- Předplatné Claude nebo ChatGPT připojené v **Nastavení ▸ AI**. Jak na to, vysvětluje téma „Připojení předplatného“.
- Složka s vašimi podklady. Nelze zvolit celý disk, celou domovskou složku ani složky s přihlašovacími nebo aplikačními daty.

## Zahájení relace

1. Na stránce Domů klikněte na kartu **Agent**. Okno agenta se otevře samostatně.
2. Klikněte na **Vybrat složku…** a zvolte složku projektu. Nedávno použité složky najdete v seznamu **Nedávné složky**.
3. V poli **Program** zvolte Claude Code nebo Codex. Program, který není připojen, zvolit nelze.
4. V poli **Kdy se vás ptát** zvolte, jak bude agent žádat o svolení (viz tabulka níže).
5. Poprvé si přečtěte část **Než začnete** a klikněte na **Rozumím**.
6. Klikněte na **Spustit**, napište, co se má udělat, a klikněte na **Odeslat**.

Jedno okno je jedna relace. Zavřením okna nebo kliknutím na **Zastavit** relace skončí a s ní skončí i program, který pro ni GenOffice spustil. Relace skončí také po 30 minutách, během nichž nic neodešlete.

## Jak se agent ptá

| Volba                                      | Udělá rovnou                                                          | Nejdřív se zeptá                                                |
| ------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Ptát se před každým příkazem** (výchozí) | Čtení a zápis souborů ve složce projektu, úpravy otevřených dokumentů | Spuštění příkazu nebo skriptu, čtení mimo složku projektu       |
| **Ptát se před zápisem a příkazy**         | Čtení souborů ve složce projektu, úpravy otevřených dokumentů         | Zápis souboru, spuštění příkazu nebo skriptu, čtení mimo složku |
| **Důvěřovat tomuto projektu**              | Téměř všechno                                                         | Čtení mimo složku projektu                                      |

Když se agent ptá, okno ukáže, co chce udělat (celý příkaz, cestu k souboru). Klikněte na **Povolit** nebo **Odmítnout**.

Ať zvolíte cokoli, agent nikdy:

- Nepřepíše soubor dokumentu otevřeného na kartě GenOffice. Otevřené dokumenty se upravují přes aplikaci, takže se změna hned ukáže v editoru a vrátit ji jde běžným Zpět v editoru.
- Nezapisuje mimo složku projektu.
- Nesahá na přihlašovací údaje Claude ani Codex ani na datovou složku GenOffice.

## Claude Code a Codex

- **Codex** spouští příkazy ve vlastním izolovaném prostoru, včetně těch, které povolíte. Zapisovat může jen do složky projektu, internet má zablokovaný a vaše osobní soubory mimo projekt číst nemůže. Při zahájení relace GenOffice nejprve ověří, že tato izolace na tomto počítači funguje, a pokud ne, relaci nespustí.
- **Claude Code** ve Windows příkazy izolovat neumí. Příkaz, který povolíte, má přístup k celému počítači i k internetu. Proto u volby **Důvěřovat tomuto projektu** kontroluje každou akci místo vás vlastní kontrolor Claude Code.

Dokument, který vám někdo poslal, může obsahovat skryté pokyny, které AI navedou k něčemu jinému. Ve složce s podklady, které neznáte, používejte některou z voleb, u nichž se agent ptá.

## Poznámky k projektu a dovednosti

- Pokud je ve složce `CLAUDE.md` nebo `AGENTS.md`, jeho obsah dostane agent jako pokyny. Zapište do něj, co má platit pokaždé: tón, termíny, formát dokumentů, které se mají vytvořit.
- Claude Code dostane kopii dovedností z těchto míst: `.claude/skills` ve složce projektu, `.ieumoffice/skills` a `.claude/skills` v domovské složce a dovednosti nainstalovaných pluginů Claude. Počet dostupných dovedností se zobrazí pod řádkem, který oznamuje zahájení relace.
- Codex si svou složku dovedností čte sám.
- Programy, které skripty dovedností používají (Python a další), musí být na tomto počítači nainstalované.

## Nové soubory a otevřené dokumenty

- Nové soubory, které agent vytvoří, se ukládají do složky projektu. Kliknutím na **Otevřít** v příslušném řádku záznamu průběhu soubor otevřete na kartě GenOffice.
- Chcete-li, aby agent upravil otevřený dokument, nejprve ho otevřete v GenOffice a v požadavku ho uveďte jménem.
- Dokument, který otevřete během relace, lze upravovat od vaší další zprávy.

## Soukromí a spotřeba

- To, co jste před AI skryli, zůstane skryté jen tehdy, když aplikace agentovi sama čte dokument otevřený v GenOffice. Soubory, které agent čte ze složky sám, se odesílají tak, jak jsou.
- Agent pracuje v mnoha krocích, a proto spotřebuje víc z limitu předplatného než panel AI. Když se limit vyčerpá, požadavek selže; agent nikdy nepřejde na jinou AI ani na zpoplatněné připojení.

## Když se něco pokazí

| Co okno hlásí                                                  | Co udělat                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| **Nepřipojeno**                                                | Přihlaste se do daného programu v **Nastavení ▸ AI**.        |
| **Tuto složku nelze použít**                                   | Zvolte složku, ve které jsou jen vaše pracovní podklady.     |
| **Codex na tomto počítači nemůže otevřít izolované prostředí** | Aktualizujte Windows, nebo zvolte Claude Code.               |
| **Limit předplatného je vyčerpán**                             | Odešlete znovu, až se limit obnoví.                          |
| **Program je pro režim agenta příliš starý**                   | Aktualizujte daný program a pak klikněte na **Nová relace**. |
