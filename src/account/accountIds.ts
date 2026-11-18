/**
 * Account identifiers.
 *
 * One place that decides how an account is named, so the same account cannot be
 * described two different ways on two different screens. Every customer-facing
 * reference — account cards, activity rows, the Send and Move selectors, the
 * statement pages and the PDF statement itself — goes through here.
 *
 * The identifier is the masked four digits the cards already carry (`•••• 4218`
 * for Checking, `•••• 1147` for Fixed savings). These are the account's
 * existing assigned identifiers: nothing here invents a number, and nothing
 * here changes an account record. It is a display concern only.
 */

import type { AccountKind } from "./types";

/**
 * The masked identifier printed alongside an account's name.
 *
 * Kept as a plain lookup rather than derived from `bank_accounts`, because the
 * schema stores no account-number column — the digits belong to the card the
 * account is issued with, and that is where they already come from.
 */
export const ACCOUNT_IDENTIFIER: Record<AccountKind, string> = {
  checking: "•••• 4218",
  savings: "•••• 1147",
};

/** Human name of an account, matching the labels used on the account cards. */
export function accountName(kind: AccountKind): string {
  return kind === "savings" ? "Fixed savings" : "Checking";
}

/**
 * An account as the customer should read it: `Checking •••• 4218`.
 *
 * `label` lets a caller pass the admin-editable label when it has one, so a
 * renamed account keeps its custom name and still gains its identifier.
 */
export function accountTitle(kind: AccountKind, label?: string): string {
  return `${label ?? accountName(kind)} ${ACCOUNT_IDENTIFIER[kind]}`;
}
