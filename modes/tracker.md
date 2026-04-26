# Modo: tracker — Tracker de Aplicaciones

Lee y muestra `data/applications.md`.

**Formato del tracker (Bijan extended):**
```markdown
| # | Fecha | Empresa | Rol | Score | Triage | Estado | PDF | Report |
```

The new **Triage** column captures the user's pre-application decision and is set exactly once. Values: `Approve` | `Reject` | `Manual` | (empty if not yet triaged). Triage and Estado are independent dimensions:
- `Triage = Approve` + `Estado = Evaluada` → ready to be staged for submission
- `Triage = Approve` + `Estado = Aplicado` → user clicked Submit in the staged form
- `Triage = Reject` + `Estado = Descartada` → job dismissed before applying (typical pairing)
- `Triage = Manual` + `Estado = Aplicado` → user applied outside the portal

Estados posibles: `Evaluada` → `Aplicado` → `Respondido` → `Contacto` → `Entrevista` → `Oferta` / `Rechazada` / `Descartada` / `NO APLICAR`

- `Aplicado` = el candidato envió su candidatura
- `Respondido` = Un recruiter/empresa contactó y el candidato respondió (inbound)
- `Contacto` = El candidato contactó proactivamente a alguien de la empresa (outbound, ej: LinkedIn power move)

Si el usuario pide actualizar un estado, editar la fila correspondiente.

Mostrar también estadísticas:
- Total de aplicaciones
- Por triage (Approve / Reject / Manual / pending)
- Por estado
- Score promedio
- % con PDF generado
- % con report generado

**Bijan portal (Supabase):** The portal reads/writes `applications.triage` and `applications.status` columns directly. The legacy markdown tracker stays in sync via `scripts/migrate-applications-to-supabase.mjs` (one-shot import) and the portal's row-update API routes (ongoing).
