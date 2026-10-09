/** 1 件の支払いの画面上の段階。 */
export type Phase =
  | "idle"
  | "depositing"
  | "judging"
  | "holding"
  | "releasing"
  | "refunding"
  | "stopped"
  | "released"
  | "refunded"
  | "error";
