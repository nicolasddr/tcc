// Limites de tamanho para campos de texto livre — usados no `maxLength` dos forms, na
// validação das actions e (com os mesmos valores, hardcoded — ver comentário em
// lib/db/schema.ts) nas CHECK constraints do banco. As três camadas têm que concordar:
// o form é só UX, a action é quem decide, e o banco é o backstop final.
export const PROJECT_NAME_MAX = 200
export const PROJECT_DESCRIPTION_MAX = 2000
export const PROFILE_NAME_MAX = 200
export const EMAIL_MAX = 254 // RFC 5321 §4.5.3.1.3
export const QUESTION_TEXT_MAX = 500
export const QUESTION_OPTION_MAX = 200
export const QUESTION_OPTIONS_COUNT_MAX = 20
export const ANSWER_MAX = 5000
