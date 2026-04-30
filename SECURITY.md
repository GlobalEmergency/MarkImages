# Política de Seguridad de DeaMap

En **Global Emergency**, nos tomamos muy en serio la seguridad de los datos de nuestra plataforma y de nuestros usuarios. Agradecemos a la comunidad de seguridad que nos ayude a mantener DeaMap seguro.

## Versiones Soportadas

Actualmente, solo la versión más reciente en producción recibe actualizaciones de seguridad.

| Versión / Rama                      | Soportada |
| :---------------------------------- | :-------- |
| `main` (Producción)                 | ✅ Sí     |
| Ramas de características (`feat/*`) | ❌ No     |
| Versiones antiguas                  | ❌ No     |

## Reporte de Vulnerabilidades

⚠️ **IMPORTANTE: NUNCA reportes vulnerabilidades de seguridad mediante un Issue público en GitHub.** Esto podría exponer los datos de los desfibriladores y poner en riesgo la plataforma antes de que podamos solucionarlo.

Si crees que has encontrado una vulnerabilidad de seguridad, por favor, repórtala enviando un correo electrónico directamente a:

📧 **[info@globalemergency.online](mailto:info@globalemergency.online)**

### ¿Qué incluir en el reporte?

- Tipo de vulnerabilidad (ej. XSS, SQLi, Bypass de Autenticación).
- Pasos detallados para reproducir el problema.
- El impacto potencial de la vulnerabilidad.
- (Opcional) Una prueba de concepto (PoC) en formato texto o video.

### Proceso de Respuesta

1. Acusaremos recibo de tu correo en un plazo de **48 a 72 horas**.
2. Evaluaremos la vulnerabilidad y te mantendremos informado sobre el progreso.
3. Una vez solucionado, te avisaremos antes de publicar el parche.

## Alcance (Scope)

### Dentro del alcance (In-scope)

- Fugas de datos sensibles de la base de datos (PostgreSQL/PostGIS).
- Bypass de autenticación o escalada de privilegios.
- Inyección de código (SQLi, XSS severo).
- Vulnerabilidades críticas en la API.

### Fuera del alcance (Out-of-scope)

- Ataques de Ingeniería Social (Phishing, Vishing) hacia nuestros voluntarios.
- Ataques físicos a la infraestructura o a los DEAs reales.
- Ataques de Denegación de Servicio (DDoS).
- Problemas menores de UI/UX sin impacto en la seguridad de los datos.
