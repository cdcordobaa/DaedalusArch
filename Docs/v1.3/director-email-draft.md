# Director email: draft (Spanish and English)

**2026-10-15. Draft for the author to edit and send.** The placeholders in square brackets are to be filled in. Nothing here has been sent.

---

## Español

**Asunto:** Núcleo de la tesis, calendario del Estudio 2 y una solicitud de evaluación

Estimado/a [Nombre]:

Le escribo para proponerle un núcleo más acotado para la tesis y pedirle dos decisiones.

**El núcleo que propongo:**
1. Un *firewall* arquitectónico guiado por especificaciones, validado sobre código TypeScript *greenfield*.
2. El grafo de arquitectura (APG) capta lo que un grafo de importaciones no ve: roles, declaraciones y contextos delimitados.
3. Un diseño neuro-simbólico por capas, con evidencia honesta para cada capa: lo que cada una aporta y dónde falla.
4. El Estudio 1 queda como estudio piloto, y el Estudio 2 es la prueba que decide la pregunta principal.
5. El método de validación: manifiestos ciegos, un conjunto *hold-out* sellado que se ejecuta una sola vez y sin ajustes, una pre-especificación con *hash* antes de la ejecución, y un etiquetado humano ciego con dos evaluadores.

**Primera decisión: el calendario del Estudio 2.** Le pido una decisión por escrito (basta un correo) entre dos opciones:
- **A.** El Estudio 2 se ejecuta y se analiza antes del [fecha].
- **B.** La tesis se evalúa con el Estudio 1, la validación, el piloto y el diseño pre-registrado del Estudio 2, sin sus resultados.

Puedo trabajar con cualquiera de las dos. Lo que necesito es saber cuál, para planificar las próximas semanas.

**Segunda solicitud: el segundo evaluador.** El etiquetado humano necesita un evaluador independiente, que será la referencia humana principal. Yo seré un evaluador secundario y no resolveré los desacuerdos. ¿Estaría dispuesto/a a hacerlo? El perfil es el de un desarrollador TypeScript profesional con código en producción en al menos dos de los cinco estilos (Clean, Layered, NestJS, Hexagonal, DDD). Si prefiere no hacerlo, le agradecería que me sugiriera a alguien. El tiempo estimado es:
- calibración: unos 60 minutos (10 ítems y una discusión breve);
- etiquetado: 60 ítems, unas 2–3 horas, o 120 ítems, unas 5–10 horas;
- además, una revisión corta de 20 casos completos.

**Reunión.** ¿Le vendría bien reunirnos el viernes 16 de octubre, a la hora que le convenga? Le adjunto el protocolo de etiquetado y la pre-especificación del *hold-out*, por si quiere verlos antes.

Muchas gracias por su tiempo.

Un cordial saludo,
Cristian Cordoba

---

## English

**Subject:** Thesis core, Study 2 timing, and a rating request

Dear [Name],

I am writing to propose a narrower core for the thesis, and to ask you for two decisions.

**The core I propose:**
1. A spec-driven architectural firewall, validated on greenfield TypeScript code.
2. The architecture graph (APG) captures what an import graph cannot see: roles, declarations and bounded contexts.
3. A layered neuro-symbolic design, with honest evidence for each layer: what each one adds, and where it fails.
4. Study 1 becomes the pilot, and Study 2 is the test that decides the main question.
5. The validation method: blind manifests, a sealed hold-out set run once with no tuning, a pre-specification hashed before the run, and blind human labelling by two raters.

**First decision: Study 2 timing.** I would like a written decision (an email is enough) between two options:
- **A.** Study 2 is run and analysed by [date].
- **B.** The thesis is examined on Study 1, the validation, the pilot and the pre-registered Study 2 design, without its results.

I can work with either. What I need is to know which, so I can plan the coming weeks.

**Second request: the second rater.** The human labelling needs an independent rater, who will be the primary human reference. I will be a secondary rater and will not resolve disagreements. Would you be willing to do it? The profile is a professional TypeScript developer with shipped code in at least two of the five styles (Clean, Layered, NestJS, Hexagonal, DDD). If you would rather not, I would be grateful if you could suggest someone. The time involved is about:
- calibration: about 60 minutes (10 items and a short discussion);
- labelling: 60 items, about 2–3 hours, or 120 items, about 5–10 hours;
- plus a short review of 20 whole cases.

**Meeting.** Would Friday 16 October work for you, at a time that suits you? I attach the labelling protocol and the hold-out pre-specification in case you would like to see them first.

Thank you very much for your time.

Kind regards,
Cristian Cordoba

---

**Attachments to send:** `Docs/v1.3/human-labelling-protocol.md`, `Docs/v1.3/holdout-prespec.md`. Optionally also `Docs/v1.3/pilot-outcome-memo.md`.
