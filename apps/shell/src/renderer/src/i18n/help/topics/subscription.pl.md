# Połączenie z subskrypcją

GenOffice korzysta z AI w ramach subskrypcji, którą już masz: subskrypcji Claude (Anthropic) albo subskrypcji Codex (OpenAI). Codex to program firmy OpenAI, do którego logujesz się swoim planem ChatGPT. Nie potrzebujesz klucza API, a GenOffice nie ma własnego konta, które trzeba by zakładać.

## Jak to działa

- AI nie jest wbudowane w GenOffice. Na tym komputerze jest zainstalowany program danej firmy — **Claude Code** dla subskrypcji Claude, **Codex** dla subskrypcji ChatGPT — i GenOffice prosi ten program o odpowiedź.
- Program jest zalogowany na twoje własne konto, więc każde żądanie liczy się do twojego planu.
- GenOffice nigdy nie pokazuje własnego formularza logowania i nigdy nie odczytuje ani nie przechowuje danych logowania. Logujesz się w programie i na stronie internetowej samej firmy.

## Zanim zaczniesz

Potrzebujesz jednego z poniższych. Możesz mieć oba.

- Subskrypcja Claude oraz program Claude Code zainstalowany i zalogowany na tym komputerze.
- Subskrypcja ChatGPT oraz program Codex zainstalowany i zalogowany na tym komputerze.

Jeśli program nie jest jeszcze zainstalowany albo zalogowany, zajmą się tym przyciski opisane w następnej części.

## Łączenie

1. Otwórz **Ustawienia** z wiersza w lewym dolnym rogu strony głównej i wybierz **AI**. W części **Połączenie z subskrypcją** jest jedna karta dla Claude i jedna dla Codex.
2. Przeczytaj, co pokazuje karta, i naciśnij jej przycisk. Tabela poniżej wyjaśnia każdy stan.
3. Wróć do okna GenOffice. Karta sama sprawdzi stan ponownie, a **Sprawdź ponownie** robi to od razu.

Te same karty pojawiają się w drugim kroku ekranów powitalnych przy pierwszym uruchomieniu oraz w panelu AI, gdy żadne AI nie jest połączone. Możesz je pominąć i połączyć się później.

| Co pokazuje karta                            | Co to znaczy                                                                                                           | Co zrobić                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprawdzanie…**                             | GenOffice pyta program o jego stan.                                                                                    | Chwilę poczekaj.                                                                                                                                                                                                                                                           |
| **Nie zainstalowano**                        | Programu nie znaleziono na tym komputerze.                                                                             | Naciśnij **Zainstaluj**. Oficjalne polecenie instalacji tej firmy uruchomi się w nowym oknie terminala, więc widzisz, co robi. GenOffice niczego samo nie pobiera. Jeśli wolisz zainstalować program ręcznie, **Oficjalna instrukcja instalacji** otwiera wskazówki firmy. |
| **Nie zalogowano**                           | Program jest, ale nikt nie jest w nim zalogowany.                                                                      | Naciśnij **Zaloguj się**. W nowym oknie uruchomi się logowanie samego programu, które otworzy w przeglądarce stronę logowania firmy. Dokończ je tam.                                                                                                                       |
| **Połączono**                                | Potwierdzono logowanie w ramach subskrypcji. Nazwa planu jest widoczna, jeśli program ją podaje.                       | Nic. AI jest gotowe do pracy.                                                                                                                                                                                                                                              |
| **Zalogowano, ale nie w ramach subskrypcji** | Program jest zalogowany kluczem API albo na konto rozliczane za zużycie, albo nie udało się ustalić rodzaju logowania. | Zobacz „Logowania rozliczane za zużycie” poniżej.                                                                                                                                                                                                                          |
| **Nie udało się sprawdzić połączenia**       | Nie powiodło się samo sprawdzanie. Przyczyna jest podana na karcie.                                                    | Naciśnij **Sprawdź ponownie**. Jeśli karta informuje, że program jest zbyt stary, zaktualizuj go i sprawdź jeszcze raz.                                                                                                                                                    |

Połączenie jest sprawdzane przy uruchomieniu aplikacji, po otwarciu Ustawień oraz po powrocie do okna, gdy wcześniej rozpoczęto instalację lub logowanie.

## Logowania rozliczane za zużycie

Karta z napisem **Zalogowano, ale nie w ramach subskrypcji** zawiera ostrzeżenie: „To nie jest subskrypcja: płacisz za faktyczne zużycie.”

- GenOffice nie używa tego logowania, dopóki nie naciśniesz **Użyj mimo to**. Od tej chwili każde żądanie obciąża to konto.
- Nawet wtedy nie jest ono nigdy wybierane automatycznie. Wybierz je samodzielnie w polu **Używane AI**, gdzie jest oznaczone jako **Płatne**.
- Zgoda jest zapamiętywana tylko dla tego programu. Znika, gdy program zostanie wylogowany albo zmieni się jego logowanie.
- Aby zamiast tego korzystać z subskrypcji, zaloguj program na konto z subskrypcją i naciśnij **Sprawdź ponownie**.

## Zmiana konta i wylogowanie

Gdy program jest zalogowany, jego karta pokazuje obok nazwy planu konto, na które jest zalogowany, jeśli program je podaje. Ma też dwa przyciski.

- **Zaloguj się na inne konto** ponownie uruchamia logowanie samego programu. Dokończ je w oknie, które się otworzy, używając drugiego konta.
- **Wyloguj się** uruchamia wylogowanie samego programu. Potem na karcie widać **Nie zalogowano**.
- Obie czynności dotyczą tego programu na całym komputerze, a nie tylko GenOffice. Jeśli używasz Claude Code lub Codex także w terminalu, tam również nastąpi wylogowanie albo zmiana konta. Dlatego GenOffice najpierw prosi o potwierdzenie.
- Konto i te dwa przyciski są tylko tutaj, w Ustawienia ▸ AI. GenOffice pokazuje konto i nigdzie go nie zapisuje.

## Które AI jest używane

Pole **Używane AI** w Ustawienia ▸ AI jest początkowo ustawione na **Automatycznie**. Tryb automatyczny decyduje w tej kolejności:

1. Claude, gdy jego karta pokazuje Połączono.
2. W przeciwnym razie Codex, gdy jego karta pokazuje Połączono.
3. W przeciwnym razie żadne AI nie jest połączone, a panel AI zamiast błędu pokazuje karty połączenia.

Tryb automatyczny nigdy nie wybiera niczego, co kosztuje dodatkowo: ani klucza API, ani logowania rozliczanego za zużycie. Są one używane tylko wtedy, gdy wybierzesz je samodzielnie.

Możesz też samodzielnie wybrać jedno AI — w tym samym miejscu albo na liście modeli u dołu panelu AI. Jeśli wybrane AI przestanie działać, GenOffice nie przejdzie po cichu na inne. Poinformuje, co się stało, i pokaże, jak połączyć się ponownie.

Lista modeli pokazuje modele podawane przez sam program: każdy z nazwą i dokładnym identyfikatorem obok, a przy pozycji **Model domyślny** widać, któremu modelowi ona teraz odpowiada. Etykieta u dołu panelu AI i pole **Używane AI** również podają ten model. Odczytanie listy o nic nie pyta AI, więc nie wlicza się do twojego planu. Jeśli program jest zbyt stary, by podać swoje modele, zamiast tego pokazywana jest krótka wbudowana lista.

Wszędzie tam, gdzie można wybrać Codex, towarzyszy mu jedno zdanie: „Korzystanie z subskrypcji Codex wewnątrz aplikacji nie jest metodą oficjalnie zalecaną przez OpenAI.” Weź to pod uwagę przy wyborze.

## Gdy żądanie zostaje zatrzymane

Żądanie zatrzymuje się, gdy limit planu został wyczerpany, gdy logowanie wygasło albo gdy programu już nie ma. GenOffice samo nie przełącza się na inne AI.

- Przyczyna jest podana w miejscu, w którym odpowiedź się urwała. Przy wyczerpanym limicie widać też godzinę jego odnowienia, jeśli program ją podaje.
- Jeśli połączona jest twoja druga subskrypcja, pojawia się przycisk **Kontynuuj z …**, na przykład **Kontynuuj z Codex**. Po jego naciśnięciu to ona staje się używanym AI — lista modeli pokazuje zmianę — a żądanie jest wykonywane ponownie.
- Jeśli jedynym innym połączeniem jest dopuszczone przez ciebie logowanie rozliczane za zużycie, ten sam przycisk ma dopisek o kosztach.
- Nigdy nie ma przycisku, który przenosi na klucz API.

## Wiersz zużycia

Gdy wykorzystasz 80% limitu lub więcej, panel AI pokazuje wiersz taki jak „Wykorzystano 85% · odnowienie o 15:00”. Claude podaje limit 5-godzinny i limit 7-dniowy, a Codex jest pokazywany tak samo, jeśli je podaje. Poniżej 80% albo gdy program niczego nie podaje, wiersza nie ma.

## Co jest wysyłane i dokąd

Gdy subskrypcji można użyć po raz pierwszy, GenOffice jednorazowo pokazuje informację. Aby przeczytać ją ponownie, przejdź do Ustawienia ▸ AI ▸ **Informacja przy pierwszym połączeniu** i naciśnij **Pokaż ponownie**. Mówi ona trzy rzeczy:

- Treść dokumentu i rozmowa są wysyłane do Anthropic lub OpenAI z Twojego własnego konta.
- To, czy te treści służą do trenowania AI, zależy od ustawień Twojego konta w danej firmie, a nie od GenOffice.
- GenOffice wyłącza zapisywanie historii rozmów w Codex, ale Codex może nadal przechowywać własne dzienniki diagnostyczne na tym komputerze.

To, co ukryjesz poleceniem **Ukryj zaznaczenie przed AI**, nie jest wysyłane, niezależnie od tego, z którego AI korzystasz.

## Warto wiedzieć

- **Szybkość.** Odpowiedź przez subskrypcję zaczyna się kilka sekund później niż przez klucz API, bo najpierw musi się uruchomić program tej firmy.
- **Darmowy plan ChatGPT.** Jest pokazywany jako Połączono, ale ma małe limity, więc żądania zatrzymują się szybciej. Wiersz zużycia się dla niego nie pojawia.
- **Generowanie obrazów.** W tej wersji subskrypcja nie generuje obrazów, w żadnym planie. Do tego potrzebny jest klucz dostawcy obrazów; zobacz [Modele AI i ustawienia](help://ai-models).
- **Serwery proxy.** Claude Code i Codex nie przejmują ustawień proxy z GenOffice. Korzystają z proxy ustawionego dla tego komputera, na przykład ze zmiennej środowiskowej `HTTPS_PROXY`, tak samo jak po uruchomieniu w terminalu. Jeśli nie mogą się połączyć w terminalu, nie połączą się także stąd.
- **Polecenia i inne programy.** Żądanie, które przychodzi z polecenia `ieumoffice` albo od podłączonego agenta programistycznego, nie korzysta z subskrypcji, dopóki na to nie pozwolisz. Zobacz [Podłączenie z agentem programistycznym](help://mcp).
