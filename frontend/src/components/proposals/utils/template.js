/**
 * Substitutes `{name}` placeholders in an editable contract sentence.
 *
 * A deliberate twin of fillTemplate() in backend/src/config/pdfDefinitions.js.
 * The preview and the PDF have to resolve the same sentence the same way, and a
 * four-line function is a smaller risk than an API round trip on every keystroke
 * of the wizard.
 *
 * Unknown placeholders render as empty rather than printing braces: these
 * strings are typed by a user, and a typo must not reach the customer as
 * `{contracter}`.
 */
export function fillTemplate(text, vars = {}) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (_match, key) =>
    vars[key] === undefined || vars[key] === null ? '' : String(vars[key])
  );
}
