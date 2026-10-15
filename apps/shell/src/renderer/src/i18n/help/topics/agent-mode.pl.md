# Tryb agenta

Agent traktuje jeden wybrany przez ciebie folder jako projekt i uruchamia w nim Claude Code lub Codex z tego komputera. AI samo czyta materiały w folderze, tworzy nowe pliki, korzysta z umiejętności i skryptów oraz edytuje dokumenty otwarte w GenOffice. Przydaje się do pracy, która wymaga sięgania do wielu materiałów.

## Zanim zaczniesz

- Subskrypcja Claude lub ChatGPT połączona w **Ustawienia ▸ AI**. Jak to zrobić, wyjaśnia temat „Połączenie z subskrypcją”.
- Folder z twoimi materiałami. Nie można wybrać całego dysku, całego folderu domowego ani folderów z danymi logowania lub danymi aplikacji.

## Rozpoczynanie sesji

1. Na lewym pasku bocznym strony głównej kliknij **Agent**. Okno agenta otworzy się osobno.
2. Kliknij **Wybierz folder…**, aby wskazać folder projektu. Foldery używane ostatnio są wymienione w sekcji **Ostatnie foldery**.
3. W polu **Program** wybierz Claude Code lub Codex. Programu, który nie jest połączony, nie da się wybrać.
4. W polu **Kiedy pytać** wybierz, jak agent ma prosić o zgodę (tabela poniżej).
5. Za pierwszym razem przeczytaj sekcję **Zanim zaczniesz** i kliknij **Rozumiem**.
6. Kliknij **Rozpocznij**, napisz, co ma zostać zrobione, i kliknij **Wyślij**.

Jedno okno to jedna sesja. Zamknięcie okna lub kliknięcie **Zatrzymaj** kończy sesję, a razem z nią kończy się program, który GenOffice dla niej uruchomił. Sesja kończy się też po 30 minutach, w których nic nie zostało wysłane.

## Jak agent pyta

| Opcja                                         | Robi od razu                                                           | Najpierw pyta                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Pytaj przed każdym poleceniem** (domyślnie) | Odczyt i zapis plików w folderze projektu, edycja otwartych dokumentów | Uruchomienie polecenia lub skryptu, odczyt poza folderem projektu     |
| **Pytaj przed zapisem i poleceniami**         | Odczyt plików w folderze projektu, edycja otwartych dokumentów         | Zapis pliku, uruchomienie polecenia lub skryptu, odczyt poza folderem |
| **Ufaj temu projektowi**                      | Prawie wszystko                                                        | Odczyt poza folderem projektu                                         |

Gdy agent pyta, okno pokazuje, co chce zrobić (całe polecenie, ścieżkę pliku). Kliknij **Zezwól** lub **Odrzuć**.

Niezależnie od wybranej opcji agent nie będzie:

- Nadpisywać pliku dokumentu otwartego na karcie GenOffice. Otwarte dokumenty są edytowane przez aplikację, więc zmiana od razu pojawia się w edytorze, a cofanie w edytorze ją odwraca.
- Zapisywać niczego poza folderem projektu.
- Sięgać do danych logowania Claude ani Codex ani do folderu danych GenOffice.

## Claude Code i Codex

- **Codex** uruchamia polecenia we własnej izolowanej przestrzeni, także te, na które pozwolisz. Może zapisywać tylko w folderze projektu, internet jest zablokowany, a twoich prywatnych plików poza projektem nie może odczytać. Na początku sesji GenOffice najpierw sprawdza, czy ta izolacja działa na tym komputerze, i jeśli nie działa, sesja się nie rozpoczyna.
- **Claude Code** nie potrafi izolować poleceń w systemie Windows. Polecenie, na które pozwolisz, ma dostęp do całego komputera i internetu. Dlatego przy opcji **Ufaj temu projektowi** każdą czynność zamiast ciebie sprawdza własny weryfikator Claude Code.

Dokument, który ktoś ci przysłał, może zawierać ukryte instrukcje każące AI zrobić coś innego. W folderze z materiałami, których nie znasz, wybierz jedną z opcji, w których agent pyta.

## Notatki projektu i umiejętności

- Jeśli w folderze jest `CLAUDE.md` lub `AGENTS.md`, jego treść trafia do agenta jako instrukcje. Zapisz w nim to, co ma obowiązywać za każdym razem: ton, terminologię, format dokumentów do przygotowania.
- Claude Code dostaje kopię umiejętności z tych miejsc: `.claude/skills` w folderze projektu, `.ieumoffice/skills` i `.claude/skills` w folderze domowym oraz umiejętności zainstalowanych wtyczek Claude. Liczba dostępnych umiejętności pojawia się pod wierszem informującym o rozpoczęciu sesji.
- Codex sam odczytuje swój folder umiejętności.
- Programy, z których korzystają skrypty umiejętności (Python i inne), muszą być zainstalowane na tym komputerze.

## Nowe pliki i otwarte dokumenty

- Nowe pliki utworzone przez agenta są zapisywane w folderze projektu. Kliknij **Otwórz** w odpowiednim wierszu dziennika postępu, aby otworzyć plik na karcie GenOffice.
- Aby agent edytował otwarty dokument, najpierw otwórz go w GenOffice i podaj jego nazwę w prośbie.
- Dokument otwarty w trakcie sesji można edytować od następnej wiadomości.

## Prywatność i zużycie

- To, co ukryjesz przed AI, pozostaje ukryte tylko wtedy, gdy aplikacja sama odczytuje dla agenta dokument otwarty w GenOffice. Pliki, które agent czyta z folderu samodzielnie, są wysyłane bez zmian.
- Agent pracuje w wielu krokach, więc zużywa więcej limitu subskrypcji niż panel AI. Gdy limit się wyczerpie, prośba kończy się niepowodzeniem; agent nigdy nie przechodzi na inne AI ani na płatne połączenie.

## Gdy coś pójdzie nie tak

| Co pokazuje okno                                          | Co zrobić                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| **Brak połączenia**                                       | Zaloguj się do tego programu w **Ustawienia ▸ AI**.         |
| **Tego folderu nie można użyć**                           | Wybierz folder, w którym są tylko twoje materiały do pracy. |
| **Codex nie może otworzyć na tym komputerze piaskownicy** | Zaktualizuj system Windows albo wybierz Claude Code.        |
| **Limit subskrypcji został wyczerpany**                   | Wyślij ponownie po odnowieniu limitu.                       |
| **Program jest zbyt stary na tryb agenta**                | Zaktualizuj ten program, a potem kliknij **Nowa sesja**.    |
