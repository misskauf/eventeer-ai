// Bilingual (English / German) support for client-facing surfaces.
// Manager UI, staff notifications, and internal labels stay in English.

export type Lang = "en" | "de";

export function normalizeLang(x: unknown): Lang {
  return x === "de" ? "de" : "en";
}

/** Return the German field when lang='de' and it's non-empty, otherwise the default. */
export function pickLocalized<T extends Record<string, any>>(
  item: T | null | undefined,
  lang: Lang,
  field: string,
): string {
  if (!item) return "";
  const en = (item[field] ?? "") as string;
  if (lang !== "de") return en;
  const de = (item[`${field}_de`] ?? "") as string;
  const deTrim = typeof de === "string" ? de.trim() : de;
  return deTrim ? de : en;
}

type StringKey =
  // section titles on the client proposal
  | "section_space"
  | "section_food"
  | "section_beverages"
  | "section_extras"
  | "choose_one"
  | "included_in_proposal"
  | "your_total"
  | "grand_total"
  | "net"
  | "tax"
  | "gross"
  | "discount"
  | "message_to_manager"
  | "message_placeholder"
  | "add_note"
  | "edit_note"
  | "hide_note"
  | "leave_note_placeholder"
  | "guests"
  | "event_hours"
  | "standard_hours"
  | "extra_hours_suffix"
  | "per_guest_hour"
  // totals card CTAs
  | "confirm_selection"
  | "request_changes"
  | "decline_offer"
  | "cancel_change_request"
  | "cancel_decline"
  | "send_change_request"
  | "send_decline"
  | "preview_suffix"
  | "confirm_preview"
  | "send_change_request_preview"
  | "send_decline_preview"
  | "change_request_prompt"
  | "decline_prompt"
  | "change_request_placeholder"
  | "decline_placeholder"
  | "selection_confirmed"
  | "change_request_sent"
  | "response_recorded"
  | "confirmed_follow_up"
  | "changes_follow_up"
  | "declined_follow_up"
  | "min_shortfall"
  // print / misc
  | "download_pdf"
  | "loading"
  | "not_found_title"
  | "not_found_body"
  | "expired_title"
  | "expired_body"
  // contract page chrome
  | "event_agreement"
  | "event_agreement_for"
  | "contract_title"
  | "sign_contract"
  | "full_legal_name"
  | "full_legal_name_placeholder"
  | "sign_agreement_text"
  | "contract_signed"
  | "signed_by_on"
  | "signing_now"
  | "client"
  | "company"
  | "event_date"
  | "guest_count"
  // reminder email
  | "reminder_subject"
  | "reminder_greeting"
  | "reminder_body_line"
  | "reminder_view_here"
  | "reminder_reply_note"
  | "reminder_thanks";

const STRINGS: Record<Lang, Record<StringKey, string>> = {
  en: {
    section_space: "Space",
    section_food: "Food",
    section_beverages: "Beverages",
    section_extras: "Extras",
    choose_one: "Choose one",
    included_in_proposal: "Included in your proposal",
    your_total: "Your total",
    grand_total: "Grand total",
    net: "Net",
    tax: "Tax",
    gross: "Gross",
    discount: "Discount",
    message_to_manager: "Message to the event manager",
    message_placeholder: "Anything you'd like to request, change, or ask about?",
    add_note: "Add a note",
    edit_note: "Edit note",
    hide_note: "Hide note",
    leave_note_placeholder: "Leave a note about this item",
    guests: "Guests",
    event_hours: "Event hours",
    standard_hours: "standard",
    extra_hours_suffix: "h extra",
    per_guest_hour: "/guest/h",
    confirm_selection: "Confirm my selection",
    request_changes: "Request changes",
    decline_offer: "Decline offer",
    cancel_change_request: "Cancel change request",
    cancel_decline: "Cancel decline",
    send_change_request: "Send change request",
    send_decline: "Send decline",
    preview_suffix: "(preview)",
    confirm_preview: "Confirm (preview)",
    send_change_request_preview: "Send change request (preview)",
    send_decline_preview: "Send decline (preview)",
    change_request_prompt: "What would you like to change? (required)",
    decline_prompt: "Reason for declining (optional)",
    change_request_placeholder: "e.g. Please swap the beverage package…",
    decline_placeholder: "e.g. We chose another venue",
    selection_confirmed: "Selection confirmed",
    change_request_sent: "Change request sent",
    response_recorded: "Response recorded",
    confirmed_follow_up: "The event manager has been notified and will follow up shortly.",
    changes_follow_up: "The event manager will review your notes and send an updated proposal.",
    declined_follow_up: "Thanks for letting us know.",
    min_shortfall: "more to meet the venue minimum.",
    download_pdf: "Download PDF",
    loading: "Loading proposal…",
    not_found_title: "Proposal not found",
    not_found_body: "This link is invalid or has been revoked.",
    expired_title: "This link has expired",
    expired_body: "Please ask your event manager for a fresh link.",
    event_agreement: "Event Agreement",
    event_agreement_for: "Event Agreement",
    contract_title: "Contract",
    sign_contract: "Sign contract",
    full_legal_name: "Full legal name",
    full_legal_name_placeholder: "Type your full name to sign",
    sign_agreement_text:
      "I have read the contract above and agree to be legally bound by its terms. Typing my name and clicking Sign constitutes my electronic signature.",
    contract_signed: "Contract signed",
    signed_by_on: "Signed by",
    signing_now: "Signing…",
    client: "Client",
    company: "Company",
    event_date: "Event date",
    guest_count: "Guests",
    reminder_subject: "Following up on your event proposal",
    reminder_greeting: "Hi",
    reminder_body_line: "Just checking in on the event proposal we shared with you",
    reminder_view_here: "You can review it here:",
    reminder_reply_note:
      "If you have any questions or would like adjustments, just reply to this email — happy to help.",
    reminder_thanks: "Thanks!",
  },
  de: {
    section_space: "Räumlichkeit",
    section_food: "Speisen",
    section_beverages: "Getränke",
    section_extras: "Zusatzleistungen",
    choose_one: "Bitte eine Option wählen",
    included_in_proposal: "In Ihrem Angebot enthalten",
    your_total: "Ihre Gesamtsumme",
    grand_total: "Gesamtsumme",
    net: "Netto",
    tax: "MwSt.",
    gross: "Brutto",
    discount: "Rabatt",
    message_to_manager: "Nachricht an den Event-Manager",
    message_placeholder: "Gibt es Wünsche, Änderungen oder Fragen?",
    add_note: "Notiz hinzufügen",
    edit_note: "Notiz bearbeiten",
    hide_note: "Notiz ausblenden",
    leave_note_placeholder: "Notiz zu diesem Punkt hinterlassen",
    guests: "Gäste",
    event_hours: "Veranstaltungsdauer (Std.)",
    standard_hours: "Standard",
    extra_hours_suffix: "h zusätzlich",
    per_guest_hour: "/Gast/Std.",
    confirm_selection: "Auswahl bestätigen",
    request_changes: "Änderungen anfragen",
    decline_offer: "Angebot ablehnen",
    cancel_change_request: "Änderungsanfrage abbrechen",
    cancel_decline: "Ablehnung abbrechen",
    send_change_request: "Änderungsanfrage senden",
    send_decline: "Ablehnung senden",
    preview_suffix: "(Vorschau)",
    confirm_preview: "Bestätigen (Vorschau)",
    send_change_request_preview: "Änderungsanfrage senden (Vorschau)",
    send_decline_preview: "Ablehnung senden (Vorschau)",
    change_request_prompt: "Was möchten Sie ändern? (erforderlich)",
    decline_prompt: "Grund für die Ablehnung (optional)",
    change_request_placeholder: "z. B. Bitte das Getränkepaket austauschen…",
    decline_placeholder: "z. B. Wir haben eine andere Location gewählt",
    selection_confirmed: "Auswahl bestätigt",
    change_request_sent: "Änderungsanfrage gesendet",
    response_recorded: "Antwort gespeichert",
    confirmed_follow_up:
      "Der Event-Manager wurde benachrichtigt und meldet sich in Kürze bei Ihnen.",
    changes_follow_up:
      "Der Event-Manager prüft Ihre Anmerkungen und sendet ein aktualisiertes Angebot.",
    declined_follow_up: "Danke für Ihre Rückmeldung.",
    min_shortfall: "mehr, um das Mindestumsatz-Ziel zu erreichen.",
    download_pdf: "PDF herunterladen",
    loading: "Angebot wird geladen…",
    not_found_title: "Angebot nicht gefunden",
    not_found_body: "Dieser Link ist ungültig oder wurde widerrufen.",
    expired_title: "Dieser Link ist abgelaufen",
    expired_body: "Bitte fragen Sie beim Event-Manager nach einem neuen Link.",
    event_agreement: "Veranstaltungsvertrag",
    event_agreement_for: "Veranstaltungsvertrag",
    contract_title: "Vertrag",
    sign_contract: "Vertrag unterschreiben",
    full_legal_name: "Vollständiger Name",
    full_legal_name_placeholder: "Bitte vollständigen Namen zur Unterschrift eingeben",
    sign_agreement_text:
      "Ich habe den obigen Vertrag gelesen und stimme dessen Bedingungen rechtsverbindlich zu. Die Eingabe meines Namens und das Anklicken von „Unterschreiben“ gilt als elektronische Unterschrift.",
    contract_signed: "Vertrag unterschrieben",
    signed_by_on: "Unterschrieben von",
    signing_now: "Wird unterschrieben…",
    client: "Kunde",
    company: "Firma",
    event_date: "Veranstaltungsdatum",
    guest_count: "Gäste",
    reminder_subject: "Rückfrage zu Ihrem Event-Angebot",
    reminder_greeting: "Hallo",
    reminder_body_line: "Kurze Rückfrage zu dem Event-Angebot, das wir Ihnen geschickt haben",
    reminder_view_here: "Sie können es hier einsehen:",
    reminder_reply_note:
      "Bei Fragen oder Änderungswünschen antworten Sie einfach auf diese E-Mail — gerne helfen wir weiter.",
    reminder_thanks: "Vielen Dank!",
  },
};

export function t(lang: Lang | string | null | undefined, key: StringKey): string {
  const L = normalizeLang(lang);
  return STRINGS[L][key] ?? STRINGS.en[key] ?? key;
}
