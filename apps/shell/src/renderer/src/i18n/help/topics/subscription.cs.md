# Připojení předplatného

GenOffice používá AI přes předplatné, které už máte: předplatné Claude (Anthropic) nebo předplatné Codex (OpenAI). Codex je program společnosti OpenAI a přihlašujete se do něj svým tarifem ChatGPT. Nepotřebujete klíč API a GenOffice nemá žádný vlastní účet, který byste si museli zakládat.

## Jak to funguje

- AI není součástí GenOffice. V tomto počítači je nainstalován program dané společnosti — **Claude Code** pro předplatné Claude, **Codex** pro předplatné ChatGPT — a GenOffice si o odpověď říká tomuto programu.
- Program je přihlášen vaším vlastním účtem, takže se každý požadavek počítá do vašeho vlastního tarifu.
- GenOffice nikdy nezobrazuje vlastní přihlašovací formulář a vaše přihlašovací údaje nikdy nečte ani neukládá. Přihlašujete se přímo v programu a na webové stránce dané společnosti.

## Než začnete

Potřebujete jedno z následujícího. Můžete mít i obojí.

- Předplatné Claude a program Claude Code nainstalovaný a přihlášený v tomto počítači.
- Předplatné ChatGPT a program Codex nainstalovaný a přihlášený v tomto počítači.

Pokud program ještě není nainstalovaný nebo přihlášený, postarají se o to tlačítka popsaná v další části.

## Připojení

1. Otevřete **Nastavení** z řádku vlevo dole na domovské stránce a zvolte **AI**. V části **Připojení předplatného** je jedna karta pro Claude a jedna pro Codex.
2. Přečtěte si, co karta říká, a stiskněte její tlačítko. Jednotlivé stavy vysvětluje tabulka níže.
3. Vraťte se do okna GenOffice. Karta provede kontrolu znovu sama a tlačítko **Zkontrolovat znovu** ji spustí hned.

Stejné karty se zobrazují ve druhém kroku uvítacích obrazovek při prvním spuštění a v panelu AI, když není připojena žádná AI. Můžete je přeskočit a připojit se později.

| Co karta říká                          | Co to znamená                                                                                                       | Co udělat                                                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Probíhá kontrola…**                  | GenOffice se programu ptá, v jakém je stavu.                                                                        | Chvíli počkejte.                                                                                                                                                                                                                                                    |
| **Není nainstalováno**                 | Program nebyl v tomto počítači nalezen.                                                                             | Stiskněte **Nainstalovat**. Oficiální instalační příkaz dané společnosti se spustí v novém okně terminálu, takže vidíte, co dělá. GenOffice sám nic nestahuje. Chcete-li instalovat ručně, tlačítko **Oficiální návod k instalaci** otevře pokyny dané společnosti. |
| **Nepřihlášeno**                       | Program je nainstalovaný, ale není v něm nikdo přihlášen.                                                           | Stiskněte **Přihlásit se**. V novém okně se spustí přihlášení samotného programu a v prohlížeči se otevře přihlašovací stránka dané společnosti. Tam ho dokončete.                                                                                                  |
| **Připojeno**                          | Bylo potvrzeno přihlášení přes předplatné. Název tarifu se zobrazí, pokud ho program hlásí.                         | Nic. AI je připravena k použití.                                                                                                                                                                                                                                    |
| **Přihlášeno, ale ne přes předplatné** | Program je přihlášen klíčem API nebo účtem s platbou podle spotřeby, případně se typ přihlášení nepodařilo zjistit. | Viz „Přihlášení s platbou podle spotřeby“ níže.                                                                                                                                                                                                                     |
| **Připojení se nepodařilo ověřit**     | Selhala samotná kontrola. Důvod je uveden na kartě.                                                                 | Stiskněte **Zkontrolovat znovu**. Pokud karta hlásí, že je program příliš starý, aktualizujte ho a zkontrolujte připojení znovu.                                                                                                                                    |

Připojení se kontroluje při spuštění aplikace, při otevření Nastavení a při návratu do okna poté, co jste spustili instalaci nebo přihlášení.

## Přihlášení s platbou podle spotřeby

Karta se stavem **Přihlášeno, ale ne přes předplatné** obsahuje varování: „Toto není předplatné: platíte podle skutečné spotřeby.“

- GenOffice toto přihlášení nepoužije, dokud nestisknete **Přesto použít**. Od té chvíle se každý požadavek účtuje tomuto účtu.
- Ani potom se nikdy nevybere automaticky. Zvolte ho sami v nabídce **Používaná AI**, kde je označeno jako **Placené**.
- Váš souhlas se pamatuje jen pro tento program. Zruší se, když se program odhlásí nebo se jeho přihlášení změní.
- Chcete-li místo toho používat předplatné, přihlaste program účtem s předplatným a stiskněte **Zkontrolovat znovu**.

## Která AI se používá

Volba **Používaná AI** v Nastavení ▸ AI je zpočátku nastavena na **Automaticky**. Automatický režim rozhoduje v tomto pořadí:

1. Claude, pokud jeho karta hlásí Připojeno.
2. Jinak Codex, pokud jeho karta hlásí Připojeno.
3. Jinak není připojena žádná AI a panel AI místo chyby zobrazí karty pro připojení.

Automatický režim nikdy nevybere nic, co stojí peníze navíc: ani klíč API, ani přihlášení s platbou podle spotřeby. Ty se používají jen tehdy, když je zvolíte sami.

Jednu AI si můžete zvolit i sami, na stejném místě nebo v seznamu modelů ve spodní části panelu AI. Pokud vámi zvolená AI přestane fungovat, GenOffice potichu nepřejde na jinou. Oznámí, co se stalo, a ukáže, jak se znovu připojit.

Všude, kde lze zvolit Codex, je u něj uveden jeden řádek: „Používání předplatného Codex uvnitř aplikace není způsob, který OpenAI oficiálně doporučuje.“ Při rozhodování na to pamatujte.

## Když se požadavek zastaví

Požadavek se zastaví, když je vyčerpán limit tarifu, když vypršelo přihlášení nebo když program už v počítači není. GenOffice sám na jinou AI nepřepne.

- Důvod je uveden v místě, kde se odpověď zastavila. U vyčerpaného limitu je uveden i čas, kdy se obnoví, pokud ho program hlásí.
- Je-li připojeno vaše druhé předplatné, objeví se tlačítko **Pokračovat s …**, například **Pokračovat s Codex**. Jeho stisknutím se z něj stane používaná AI — změnu ukáže seznam modelů — a požadavek se spustí znovu.
- Je-li jediným dalším připojením přihlášení s platbou podle spotřeby, které jste povolili, je u stejného tlačítka poznámka o nákladech.
- Nikdy se nezobrazí tlačítko, které by vás převedlo na klíč API.

## Řádek využití

Jakmile využijete 80 % limitu nebo více, zobrazí panel AI řádek jako „Využito 85 % · obnoví se v 15:00“. Claude hlásí 5hodinový a 7denní limit a Codex se zobrazuje stejně, pokud je hlásí. Pod 80 %, nebo když program nic nehlásí, se žádný řádek nezobrazí.

## Co se odesílá a kam

Když lze předplatné použít poprvé, zobrazí GenOffice jednorázové upozornění. Chcete-li si ho přečíst znovu, přejděte do Nastavení ▸ AI ▸ **Upozornění při prvním připojení** a stiskněte **Zobrazit znovu**. Říká tři věci:

- Obsah dokumentu a konverzace se odesílají společnosti Anthropic nebo OpenAI pod vaším vlastním účtem.
- Zda se tento obsah použije k trénování AI, určuje nastavení vašeho účtu u dané společnosti, nikoli GenOffice.
- GenOffice vypíná ukládání historie konverzací v Codexu, Codex však může v tomto počítači dál uchovávat vlastní diagnostické protokoly.

Co jste skryli příkazem **Skrýt výběr před AI**, se neodesílá, ať už používáte kteroukoli AI.

## Dobré vědět

- **Rychlost.** Odpověď přes předplatné začne o několik sekund později než odpověď přes klíč API, protože se nejdřív musí spustit program dané společnosti.
- **Bezplatný tarif ChatGPT.** Zobrazuje se jako Připojeno, ale má malé limity, takže se požadavky zastaví dřív. Řádek využití se u něj nezobrazuje.
- **Generování obrázků.** V této verzi předplatné obrázky negeneruje, a to v žádném tarifu. K tomu je potřeba klíč poskytovatele obrázků; viz [Modely AI a nastavení](help://ai-models).
- **Proxy.** Claude Code a Codex nepřebírají nastavení proxy z GenOffice. Používají proxy nastavenou pro tento počítač, například proměnnou prostředí `HTTPS_PROXY`, stejně jako když je spustíte v terminálu. Pokud se nepřipojí v terminálu, nepřipojí se ani odsud.
- **Příkazy a jiné programy.** Požadavek, který přijde z příkazu `ieumoffice` nebo od připojeného programového agenta, vaše předplatné nepoužije, dokud to nepovolíte. Viz [Připojení programového agenta](help://mcp).
