# TODO — Cumplimiento legal y Política de Familias de Google Play

## Estado actual

Las páginas legales (`/legal/privacidad`, `/legal/cookies`, `/legal/condiciones`) ya incluyen:

- [x] Política de Privacidad con sección de menores (RGPD art.7, LOPDGDD art.7)
- [x] Condiciones de Uso con cláusula de registro para menores (<14 con consentimiento parental)
- [x] Política de Cookies con sección sobre analítica y menores
- [x] Email de contacto: `rgpd@globalemergency.online`
- [x] `noindex, nofollow` en las tres páginas legales
- [x] Propiedad de datos: los datos de DEAs son del usuario, DeaMap tiene licencia de uso
- [x] Cláusula de datos restringidos (no todos los DEAs son públicos)
- [x] Declaración en Play Console: **No** se usa ID de publicidad

---

## Pendiente — Cumplimiento legal

### Prioridad alta (necesario antes de producción)

- [ ] **Constituir entidad legal** — El RGPD exige identificar al responsable del tratamiento con nombre legal, CIF/NIF y domicilio social. Cuando Global Emergency tenga personalidad jurídica, actualizar la sección 1 de la Política de Privacidad con estos datos.

- [ ] **Evaluar necesidad de DPO** — Dependiendo del volumen de datos de ubicación procesados, puede ser obligatorio designar un Delegado de Protección de Datos. Consultar con un abogado especializado.

- [ ] **Desactivar Google Analytics en páginas públicas** — La Política de Familias de Google Play exige que los SDKs de analítica en contenido accesible por menores estén autocertificados. Google Analytics en la parte pública puede suponer incumplimiento. Opciones:
  - Cargar GA solo cuando el usuario está autenticado (recomendado)
  - Usar Vercel Analytics (que no usa cookies de terceros) en la parte pública y GA solo en el panel de administración
  - Eliminar GA completamente y usar solo Vercel Analytics

- [ ] **Implementar consentimiento parental verificable** — El registro de menores de 14 años requiere un mecanismo real de verificación del consentimiento parental. Opciones:
  - Campo de fecha de nacimiento en el registro
  - Si <14 años, solicitar email del padre/madre/tutor y enviar enlace de confirmación
  - Bloquear registro directo para <14 y requerir que el tutor cree la cuenta

- [ ] **Banner de cookies / consentimiento** — La normativa española (LSSI) y la Directiva ePrivacy exigen informar y obtener consentimiento antes de instalar cookies no esenciales (como GA). Implementar un banner de cookies con opción de aceptar/rechazar cookies de analítica.

### Prioridad media

- [ ] **Registro de actividades de tratamiento (RAT)** — El RGPD (art. 30) exige mantener un registro interno de las actividades de tratamiento de datos. No es una página pública, pero debe existir como documento interno.

- [ ] **Mecanismo de eliminación de cuenta** — Las páginas legales mencionan el derecho de supresión. Implementar un flujo real en la plataforma para que los usuarios puedan solicitar/ejecutar la eliminación de su cuenta y datos.

- [ ] **Mecanismo de exportación de datos** — El derecho de portabilidad (RGPD art. 20) requiere que los usuarios puedan descargar sus datos en un formato estructurado (JSON/CSV).

- [ ] **Política de Familias de Play — Requisitos adicionales de la app Android**:
  - La app no debe contener contenido inapropiado para menores
  - Los anuncios (si los hubiera en el futuro) deben ser aptos para menores
  - No recopilar IDFA/GAID (ya declarado como "No" en Play Console)
  - Revisar que ningún SDK de terceros incluido en la app recopile datos de menores sin consentimiento

### Prioridad baja

- [ ] **Enlazar páginas legales desde el footer de la app** — Asegurar que las tres páginas legales son accesibles desde la app Android y la web (footer, registro, etc.)

- [ ] **Actualizar textos legales cuando haya cambios** — Mantener la fecha de "Última actualización" sincronizada con los cambios reales en las políticas.

---

## Notas

- La declaración de Play Console sobre ID de publicidad se ha respondido con **"No"**, lo cual es correcto siempre que se elimine o restrinja Google Analytics en la app Android (ya que el SDK de GA puede acceder al advertising ID).
- Las páginas legales están en `/src/app/legal/{privacidad,cookies,condiciones}/page.tsx`.
- El email de protección de datos es `rgpd@globalemergency.online`.
