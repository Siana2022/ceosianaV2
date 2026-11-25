from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

doc = Document()

for section in doc.sections:
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)

normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(11)

doc.add_heading("Puntos abiertos de ceosiana", level=0)
p = doc.add_paragraph()
r = p.add_run("Documento para reunión · 24/11/2026")
r.italic = True
r.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

doc.add_paragraph(
    "Cada punto indica qué piden, qué hay hoy, qué hay que decidir y la recomendación. "
    "De los 65 puntos de los dos documentos originales, estos 14 son los que quedan abiertos."
)

GRIS = RGBColor(0x6F, 0x6A, 0x62)


def bloque(numero, titulo, tipo, piden, hoy, decidir, cierre, etiqueta_cierre="Recomiendo"):
    doc.add_heading(f"{numero}. {titulo}", level=2)
    p = doc.add_paragraph()
    r = p.add_run(tipo)
    r.italic = True
    r.font.size = Pt(9)
    r.font.color.rgb = GRIS

    for etiqueta, texto in [("Piden:", piden), ("Hoy:", hoy), ("Decidir:", decidir), (f"{etiqueta_cierre}:", cierre)]:
        par = doc.add_paragraph()
        par.paragraph_format.space_after = Pt(2)
        neg = par.add_run(etiqueta + " ")
        neg.bold = True
        par.add_run(texto)


doc.add_heading("A. Fichaje y tiempo", level=1)

bloque(1, "Reparto del tiempo entre varios responsables", "Decisión",
       "que el tiempo de una tarea con varias personas quede bien repartido.",
       "cada uno ficha lo suyo y el total se suma en la tarea; el desglose por persona ya se ve. En reuniones se ficha a todos.",
       "reparto automático entre responsables o que fiche cada uno.",
       "que fiche cada uno. El reparto automático diría que todos trabajaron lo mismo y falsearía las horas.")

bloque(2, "El enlace de Slack no se guarda", "Verificar",
       "que el enlace de la tarea se guarde.",
       "la columna existe y el formulario lo envía, pero no se ha verificado que persista.",
       "nada; hay que comprobarlo.",
       "una tarea creada con enlace para revisarla en la base.", "Necesito")

bloque(3, "El cronómetro duplica la tarea", "Reproducir",
       "que mida bien y no genere tareas duplicadas.",
       "no está reproducido. La sospecha es que quedan fichajes abiertos sin hora de fin.",
       "nada hasta reproducirlo.",
       "los pasos exactos de Carlos.", "Necesito")

bloque(4, "La tarea creada desde fichajes nace en terminadas", "Decisión",
       "que el servicio no quede vacío al crearla desde fichar.",
       "el servicio ya se rellena solo (arreglado), pero la tarea sigue naciendo en terminadas.",
       "¿debe nacer terminada, porque el trabajo ya se hizo, o en proceso?",
       "terminada, pero avisando en la ficha de que se creó desde el fichaje.")

bloque(5, "Fichajes de Meta Ads que no se imputan", "Datos",
       "que ese tiempo aparezca en su servicio (Verde Esmeralda, Prolaboral).",
       "si el fichaje no lleva servicio, cae en «Sin asignar» y no entra en la rentabilidad.",
       "corregir caso a caso o hacer una limpieza por departamento.",
       "contar cuántos son y de qué meses; si son pocos, caso a caso.")

bloque(6, "Tareas de ejemplo que siguen fichadas", "Datos",
       "que no cuenten como fichaje.",
       "se borraron 4 fichajes de prueba, pero no se puede garantizar que no quede ninguno.",
       "borrar los que queden y fijar la regla al borrar una tarea.",
       "conservar el tiempo (es historial) y marcar la tarea como eliminada.")

bloque(7, "El 3h45 al 100 % de rentabilidad", "Reproducir",
       "explicar por qué sale 100 %.",
       "pasa cuando el coste sale 0: o no hay sueldo registrado ese mes, o las horas no están imputadas al servicio.",
       "nada; hace falta reproducirlo.",
       "cliente, mes y servicio concretos.", "Necesito")

doc.add_heading("B. Servicios y rentabilidad", level=1)

bloque(8, "Quitar responsables y el bloque «Proyectos y servicios»", "Estructural · la decisión de la reunión",
       "quitar los responsables y ese bloque de la ficha del cliente.",
       "ese bloque es la tabla de servicios, y de ella cuelgan la facturación por servicio, el coste imputado, los márgenes, el convertidor del 10 % y el servicio REUNIONES.",
       "A) quitar solo responsables · B) eliminar la tabla y facturar por cliente · C) mover la tabla a una pantalla propia.",
       "A o C. La B rompe la rentabilidad por servicio.")

bloque(9, "Agrupar Meta Ads en Verde Esmeralda", "Producto",
       "una sola línea de Meta Ads, o ver el desglose por mercado.",
       "Meta España, Meta USA y Meta Italia salen como tres líneas distintas.",
       "A) agrupar por tipo de servicio · B) una línea con desplegable por mercado · C) unir solo ese cliente.",
       "B: sirve para todos los clientes sin perder el detalle.")

bloque(10, "Servicios que no están en el cliente no salen en el fichaje", "Decisión",
       "que aparezcan todos y que, si no está en el cliente, se cree la fila en su ficha.",
       "solo salen los servicios de ese cliente; se pueden crear desde el propio fichaje.",
       "A) seguir como ahora · B) mostrar servicios de otros clientes · C) mostrar el catálogo de tipos y crear el servicio del cliente al elegirlo.",
       "C. La B imputaría costes a servicios de otro cliente.")

bloque(11, "Recuadro de % de rentabilidad en el panel de clientes", "Cosmético",
       "el recuadro que ya existe en la ficha, también en el listado general.",
       "el porcentaje aparece dentro de la columna Margen.",
       "añadir una columna propia o dejarlo como está.",
       "columna propia y ordenable; en la reunión se compara mejor cliente por cliente.")

doc.add_heading("C. Interfaz", level=1)

bloque(12, "Botón lateral de notificaciones", "Decisión + reproducir",
       "que funcione.",
       "hay campana con contador y un panel de notificaciones; el fallo no está reproducido.",
       "qué debe mostrar: menciones, asignaciones o ambas.",
       "ambas, con lo no leído primero.")

bloque(13, "Que al entrar en tareas salga filtrado por mi persona", "Decisión",
       "entrar en tareas y ver directamente las suyas.",
       "el filtro por persona existe, pero hay que elegirlo a mano.",
       "aplicarlo por defecto y si dirección también lo quiere.",
       "sí para el equipo; dirección entra sin filtro.")

doc.add_heading("D. Datos a revisar", level=1)

bloque(14, "Interna de HOSTING", "Sin definir",
       "revisarla.",
       "no hay detalle del problema; el resto de internas funcionan.",
       "nada hasta saber qué falla.",
       "el caso concreto: un cliente que no aparece, un importe mal o una suma que no cuadra.", "Necesito")

doc.add_heading("Resumen", level=1)

tabla = doc.add_table(rows=1, cols=3)
tabla.style = "Light Grid Accent 1"
tabla.alignment = WD_TABLE_ALIGNMENT.CENTER
encabezados = tabla.rows[0].cells
for i, texto in enumerate(["Punto", "Tipo", "Decisión necesaria"]):
    encabezados[i].text = texto
    for par in encabezados[i].paragraphs:
        for run in par.runs:
            run.bold = True

filas = [
    ("1. Reparto del tiempo", "Decisión", "Automático o cada uno ficha"),
    ("2. Enlace de Slack", "Verificar", "Comprobar una tarea con enlace"),
    ("3. Cronómetro duplica", "Reproducir", "Pasos de Carlos"),
    ("4. Tarea desde fichajes", "Decisión", "Terminada o en proceso"),
    ("5. Fichajes sin imputar", "Datos", "Caso a caso o limpieza"),
    ("6. Tareas de ejemplo", "Datos", "Borrar y fijar regla"),
    ("7. 3h45 al 100 %", "Reproducir", "Cliente, mes y servicio"),
    ("8. Quitar servicios", "Estructural", "A, B o C"),
    ("9. Agrupar Meta Ads", "Producto", "A, B o C"),
    ("10. Servicios en el fichaje", "Decisión", "A, B o C"),
    ("11. Recuadro de %", "Cosmético", "Columna o dejarlo"),
    ("12. Notificaciones", "Decisión", "Qué muestra"),
    ("13. Filtro por persona", "Decisión", "Por defecto o no"),
    ("14. HOSTING", "Sin definir", "Qué revisar"),
]

for punto, tipo, decision in filas:
    celdas = tabla.add_row().cells
    celdas[0].text = punto
    celdas[1].text = tipo
    celdas[2].text = decision

for fila in tabla.rows:
    for celda in fila.cells:
        for par in celda.paragraphs:
            for run in par.runs:
                run.font.size = Pt(10)

doc.add_paragraph()
nota = doc.add_paragraph()
nr = nota.add_run("Nota: ")
nr.bold = True
nota.add_run(
    "de los 65 puntos de los dos documentos originales, 51 están cerrados. "
    "Solo el punto 8 es estructural; el resto son ajustes, comprobaciones o datos que faltan."
)

doc.save("Puntos-abiertos-ceosiana.docx")
print("ok")
