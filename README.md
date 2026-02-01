# Presupuestos – Excel a PDF

Web para subir un Excel con el presupuesto (formato hoja "Table 1": Repuestos y Mano de Obra) y descargar un PDF con la tabla en el formato del ejemplo.

## Formato del Excel

- Hoja **"Table 1"** (o la primera hoja).
- Bloque **Repuestos**: fila con cabecera "REPUESTOS", "CANTIDAD", "PRECIO", "TOTAL"; luego filas con descripción (columna A), cantidad, precio, total; luego fila con "TOTAL REPUESTOS $ XXX".
- Bloque **Mano de Obra**: igual con "MANO DE OBRA" y "TOTAL MANO DE OBRA $ XXX".

## Cómo probar en local

1. Instalar dependencias (ya hecho): `npm install`
2. Probar solo el PDF desde el Excel de ejemplo:
   ```bash
   node scripts/test-pdf.js
   ```
   Se genera `salida-test.pdf`.
3. Probar la web con Netlify CLI (recomendado para probar la función):
   ```bash
   npx netlify dev
   ```
   Abre el navegador en la URL que indique (por ejemplo `http://localhost:8888`) y sube un Excel para generar el PDF.

## Desplegar en Netlify

1. Sube el proyecto a un repositorio Git (GitHub, GitLab, etc.).
2. En [Netlify](https://app.netlify.com) crea un sitio nuevo y conéctalo al repositorio.
3. Build settings: no hace falta comando de build; **Publish directory**: `public`.
4. Deploy. La función `generate-pdf` estará en `/.netlify/functions/generate-pdf` y la página en `/`.

## Estructura del proyecto

- `public/index.html` – Página para subir Excel y descargar PDF.
- `netlify/functions/generate-pdf.js` – Función que recibe el Excel en base64 y devuelve el PDF.
- `src/parseExcel.js` – Parsea la hoja "Table 1" y extrae repuestos, mano de obra y totales.
- `src/generatePdf.js` – Genera el PDF con la tabla (Descripción | Valor Total) en el formato del ejemplo.
- `ejemplo_xlsx.xlsx` – Excel de ejemplo.
- `ejemplo_pdf.pdf` – PDF de referencia del formato esperado.
