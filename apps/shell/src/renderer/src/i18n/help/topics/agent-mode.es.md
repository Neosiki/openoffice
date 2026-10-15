# Modo agente

El agente toma como proyecto una carpeta que usted elige y ejecuta en ella el Claude Code o el Codex de este PC. La IA lee por sí misma el material de la carpeta, crea archivos nuevos, usa habilidades y scripts, y modifica los documentos abiertos en GenOffice. Úselo para trabajos que se apoyan en mucho material.

## Antes de empezar

- Una suscripción de Claude o una suscripción de ChatGPT conectada en **Configuración ▸ IA**. El tema «Conexión por suscripción» explica cómo hacerlo.
- Una carpeta con su material. No se pueden elegir una unidad entera, toda su carpeta personal ni carpetas con datos de inicio de sesión o de aplicaciones.

## Iniciar una sesión

1. En Inicio, haga clic en la tarjeta **Agente**. La ventana del agente se abre aparte.
2. Haga clic en **Elegir una carpeta…** para seleccionar la carpeta del proyecto. Las carpetas que usó hace poco aparecen en **Carpetas recientes**.
3. En **Programa**, elija Claude Code o Codex. No se puede elegir un programa que no esté conectado.
4. En **Cuándo preguntarte**, elija cómo le pide permiso el agente (tabla de abajo).
5. La primera vez, lea **Antes de empezar** y haga clic en **Entendido**.
6. Haga clic en **Iniciar**, escriba lo que quiere que se haga y haga clic en **Enviar**.

Una ventana es una sesión. Al cerrar la ventana o hacer clic en **Detener**, la sesión termina, y el programa que GenOffice inició para ella también se cierra. Una sesión también termina tras 30 minutos sin enviar nada.

## Cómo pregunta el agente

| Opción                                                 | Lo hace sin preguntar                                                              | Pregunta antes                                                              |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Preguntar antes de cada comando** (predeterminada)   | Leer y escribir archivos en la carpeta del proyecto, modificar documentos abiertos | Ejecutar un comando o script, leer fuera de la carpeta del proyecto         |
| **Preguntar antes de escribir y de ejecutar comandos** | Leer archivos en la carpeta del proyecto, modificar documentos abiertos            | Escribir un archivo, ejecutar un comando o script, leer fuera de la carpeta |
| **Confiar en este proyecto**                           | Casi todo                                                                          | Leer fuera de la carpeta del proyecto                                       |

Cuando el agente pregunta, la ventana muestra lo que quiere hacer (el comando completo, la ruta del archivo). Haga clic en **Permitir** o **Rechazar**.

Elija lo que elija, el agente nunca:

- Sobrescribe el archivo de un documento abierto en una pestaña de GenOffice. Los documentos abiertos se modifican a través de la aplicación, así que el cambio se ve al instante en el editor y la función deshacer del editor lo revierte.
- Escribe fuera de la carpeta del proyecto.
- Toca los datos de inicio de sesión de Claude o de Codex, ni la carpeta de datos de GenOffice.

## Claude Code y Codex

- **Codex** ejecuta los comandos en su propio espacio aislado, incluidos los que usted permite. Solo puede escribir en la carpeta del proyecto, internet está bloqueado y no puede leer sus archivos personales fuera del proyecto. Al iniciar una sesión, GenOffice comprueba primero que este aislamiento funciona en este PC, y no se inicia si no funciona.
- **Claude Code** no puede aislar comandos en Windows. Un comando que usted permite puede llegar a todo el PC y a internet. Por eso, con **Confiar en este proyecto**, es el propio revisor de Claude Code el que comprueba cada acción en su lugar.

Un documento que alguien le envió puede llevar instrucciones ocultas que le piden a la IA hacer otra cosa. En una carpeta con material que no conoce, use una de las opciones que preguntan.

## Notas del proyecto y habilidades

- Si la carpeta tiene un `CLAUDE.md` o un `AGENTS.md`, su contenido se le da al agente como instrucciones. Anote ahí lo que debe cumplirse siempre: el tono, los términos, el formato de los documentos que hay que crear.
- Claude Code recibe una copia de las habilidades de estos lugares: `.claude/skills` en la carpeta del proyecto, `.ieumoffice/skills` y `.claude/skills` en su carpeta personal, y las habilidades de los plugins de Claude instalados. El número de habilidades disponibles aparece debajo de la línea que indica que la sesión se inició.
- Codex lee por sí mismo su propia carpeta de habilidades.
- Los programas que usan los scripts de una habilidad (Python, etc.) deben estar instalados en este PC.

## Archivos nuevos y documentos abiertos

- Los archivos nuevos que crea el agente se guardan en la carpeta del proyecto. Haga clic en **Abrir** en esa línea del registro de progreso para abrir el archivo en una pestaña de GenOffice.
- Para que se modifique un documento abierto, ábralo primero en GenOffice y nómbrelo en su petición.
- Un documento que abra durante una sesión se puede modificar a partir de su siguiente mensaje.

## Privacidad y consumo

- Lo que ocultó a la IA solo queda oculto cuando la aplicación lee para el agente un documento abierto en GenOffice. Los archivos que el agente lee por sí mismo de la carpeta se envían tal cual.
- El agente trabaja en muchos pasos, así que gasta más del límite de su suscripción que el panel de IA. Cuando se agota el límite, la solicitud falla; el agente nunca pasa a otra IA ni a una conexión de pago.

## Si algo sale mal

| Lo que dice la ventana                                   | Qué hacer                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| **No conectado**                                         | Inicie sesión en ese programa en **Configuración ▸ IA**.      |
| **No se puede usar esta carpeta**                        | Elija una carpeta que solo contenga su material de trabajo.   |
| **Codex no puede abrir en este PC el entorno aislado**   | Actualice Windows o elija Claude Code.                        |
| **Has agotado el límite de tu suscripción**              | Vuelva a enviar cuando se restablezca el límite.              |
| **El programa es demasiado antiguo para el modo agente** | Actualice ese programa y luego haga clic en **Nueva sesión**. |
