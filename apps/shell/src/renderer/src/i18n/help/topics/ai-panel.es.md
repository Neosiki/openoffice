# El panel de IA

Todos los editores pueden invocar el panel de IA: seleccione algo, dé una instrucción y vea el resultado en streaming.

## Abrirlo y usarlo

- El panel necesita una IA conectada. Si no hay ninguna, muestra las tarjetas de conexión en lugar de un error; vea [Conexión por suscripción](help://subscription).
- Entradas: el **botón de IA** en la cinta de opciones de cada editor, **Pedir a la IA** en los menús contextuales, o Preguntar a la IA en la barra de marcado.
- Describa la tarea en lenguaje natural (reescribir esto / convertir esta columna en porcentajes / rehacer el diseño de esta página…) y pulse Intro.
- Las respuestas se renderizan **en streaming**; cuando la IA necesita herramientas (leer el documento, editarlo), las ejecuta y sigue hasta terminar.
- **Detener**: interrumpa la vuelta en curso en cualquier momento.
- **Cola**: mientras se genera una respuesta, Enter pone tu mensaje en cola en lugar de descartarlo — una franja sobre el campo de entrada los cuenta; ábrela para editar, quitar, reordenar, pausar o vaciar. El siguiente mensaje se envía solo al terminar el turno; Esc sigue deteniendo el turno.

## Qué IA responde

- La lista de modelos de la parte inferior del panel muestra la IA en uso y permite elegir otra: primero sus suscripciones y después los proveedores con clave que haya configurado.
- Cuando ha usado el 80 % o más del límite de una suscripción, aparece en el panel una línea como «85 % usado · se restablece a las 15:00».
- Si una solicitud se detiene —se agotó el límite, o la sesión ha caducado—, el panel dice por qué y no cambia a otra IA por su cuenta. Cuando su otra suscripción está conectada, un botón **Continuar con …** la ofrece.

## Qué sabe hacer

- **Docs**: reescribir/ampliar/traducir/resumir, insertar tablas e imágenes, ajustar el formato; cada vuelta guarda primero una instantánea.
- **Sheets**: fórmulas, relleno de datos, transformaciones masivas, formato.
- **Slides**: generación de una presentación completa, ajuste del diseño, reescritura de los textos.
- **PDF**: preguntas y resúmenes sobre el texto o las páginas seleccionadas.
- **Markdown / HTML**: reescribir, ampliar, traducir.
- **Inicio ▸ Ask AI** responde desde tus archivos destacados y los cita — el panel de base de conocimiento tiene su propia sección en el capítulo Inicio, y el panel de IA de Docs lleva la misma capacidad.

## Retroceso y seguridad

- El panel de Docs conserva una **lista de versiones**: una instantánea por vuelta, puede volver a cualquiera de ellas y ese propio retroceso se puede deshacer con Ctrl+Z. Las instantáneas sobreviven a reabrir el documento.
- Las ediciones de la IA pasan por la misma canalización de edición que las manuales (se pueden deshacer y requieren guardar): nada omite su confirmación de guardado.

## Ocultar una selección a la IA

- En Slides, HTML y Markdown una selección puede quitarse de la vista del modelo: clic derecho ▸ **Ocultar la selección a la IA**, ponle nombre al marcador, y el modelo lee `{{nombre}}` en su lugar. (Markdown arma la opción con el interruptor de ojo tachado de su cinta; la de HTML vive en el panel de código.)
- El archivo conserva el texto real — guardar, exportar e imprimir quedan intactos, y la marca sobrevive a reabrir. La misma opción deshace el ocultamiento (Markdown tiene además **Volver a mostrar la selección a la IA**).
- HTML oculta contenidos de elementos, valores de atributos y literales de cadena de los scripts; la página renderizada nunca cambia.
- Slides también oculta imágenes, vídeos y audios enteros, y una diapositiva con contenido oculto nunca se envía como captura: la revisión automática de diseño se salta la página y lo avisa.
- Esto vale solo para la IA de la aplicación — la CLI, las herramientas MCP y la exportación sin interfaz leen el archivo directamente y siguen viendo el texto.

## Privacidad

- Las instrucciones y el contenido pertinente del documento van a la **IA que esté usando**: a Anthropic u OpenAI con su propia cuenta cuando usa una suscripción, o al proveedor cuya clave introdujo. Si no hay ninguna IA conectada, no se envía nada.
- Que el contenido de una suscripción se use para entrenar IA depende de los ajustes de su propia cuenta en esa empresa.
- Los archivos locales no se suben a ningún otro sitio; las claves de API se guardan en el archivo de ajustes de la aplicación en este equipo y se envían solo en las cabeceras de la petición.
