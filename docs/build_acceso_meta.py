from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# Márgenes razonables para imprimir
for section in doc.sections:
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)

# Estilo base
normal = doc.styles["Normal"]
normal.font.name = "Calibri"
normal.font.size = Pt(11)

# ── Portada / cabecera ────────────────────────────────────────────────
t = doc.add_heading("Acceso de Ceosiana a Meta Ads", level=0)

p = doc.add_paragraph()
r = p.add_run("Guía para el responsable de Meta · Siana Digital")
r.italic = True
r.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

doc.add_paragraph()
intro = doc.add_paragraph(
    "El objetivo es crear una app de Meta y un token permanente para que Ceosiana "
    "pueda leer campañas y creatividades de todas las cuentas del Business Manager, "
    "sin que nadie tenga que volver a iniciar sesión."
)
intro.runs[0].font.size = Pt(11)

# ── Requisitos ────────────────────────────────────────────────────────
doc.add_heading("Requisitos previos", level=1)
doc.add_paragraph("Ser administrador del Business Manager de Siana.", style="List Bullet")
doc.add_paragraph(
    "Las cuentas publicitarias deben ser de Siana o estar compartidas como socio con Siana. "
    "Si una cuenta no está compartida, el token no la verá.",
    style="List Bullet",
)

# ── Pasos ─────────────────────────────────────────────────────────────
steps = [
    (
        "Paso 1 · Crear la app",
        [
            "Entrar en developers.facebook.com con la cuenta de administrador.",
            "Mis apps → Crear app.",
            "Tipo de uso: Otro. Tipo de app: Business.",
            "Nombre: Siana Digital. Email de contacto: el de Siana.",
            "Si pregunta por el portafolio comercial, vincular Siana Digital.",
        ],
    ),
    (
        "Paso 2 · Añadir el producto Marketing API",
        [
            "En el panel de la app: Añadir producto → Marketing API → Configurar.",
            "No hace falta publicar la app ni pedir revisión: se usa en modo desarrollo con cuentas propias.",
        ],
    ),
    (
        "Paso 3 · Crear el usuario del sistema",
        [
            "Ir a business.facebook.com/settings.",
            "Usuarios → Usuarios del sistema → Añadir.",
            "Nombre: ceosiana-hub. Rol: Empleado (suficiente para leer).",
            "Crear.",
        ],
    ),
    (
        "Paso 4 · Darle acceso a las cuentas publicitarias",
        [
            "Usuario ceosiana-hub → Añadir activos → Cuentas publicitarias.",
            "Seleccionar todas las cuentas de clientes.",
            "Permiso: Ver rendimiento (lectura).",
            "Confirmar.",
        ],
    ),
    (
        "Paso 5 · Darle acceso a la app",
        [
            "En el mismo usuario → pestaña Apps → Añadir.",
            "Seleccionar Siana Digital. Rol: Desarrollador o Administrador.",
        ],
    ),
    (
        "Paso 6 · Generar el token",
        [
            "Usuario ceosiana-hub → Generar token.",
            "App: Siana Digital.",
            "Permisos: ads_read.",
            "Caducidad: Nunca.",
            "Generar y copiar el token.",
        ],
    ),
]

for titulo, items in steps:
    doc.add_heading(titulo, level=1)
    for item in items:
        doc.add_paragraph(item, style="List Number")

# ── Aviso ─────────────────────────────────────────────────────────────
doc.add_paragraph()
aviso = doc.add_paragraph()
ra = aviso.add_run("Importante: ")
ra.bold = True
ra.font.color.rgb = RGBColor(0xC0, 0x00, 0x00)
aviso.add_run(
    "el token es una credencial. No debe enviarse por correo ni por chat. "
    "Hay que pasarlo por un medio seguro y tratarlo como una contraseña: "
    "se guarda únicamente en el servidor de Ceosiana, nunca en el navegador ni en el repositorio."
)

# ── Paso 7 ────────────────────────────────────────────────────────────
doc.add_heading("Paso 7 · Entregar el token", level=1)
doc.add_paragraph(
    "El token se configura en el servidor de Ceosiana como variable META_SYSTEM_USER_TOKEN. "
    "Con eso queda activa la lectura de todas las cuentas para todo el equipo, sin más inicios de sesión."
)

# ── Checklist ─────────────────────────────────────────────────────────
doc.add_heading("Checklist", level=1)
checks = [
    "App Siana Digital creada y vinculada al portafolio",
    "Producto Marketing API añadido",
    "Usuario del sistema ceosiana-hub creado",
    "Cuentas publicitarias asignadas con permiso de lectura",
    "App asignada al usuario del sistema",
    "Token generado con ads_read y caducidad Nunca",
    "Token entregado por un canal seguro",
]
for c in checks:
    doc.add_paragraph("☐  " + c)

doc.add_paragraph()
nota = doc.add_paragraph()
nota.add_run(
    "Cuando el token esté configurado, se comprueba en Ceosiana abriendo /api/hub/meta/estado: "
    "debe devolver las cuentas publicitarias accesibles."
).italic = True

doc.save("Acceso-Meta-Ceosiana.docx")
print("ok")
