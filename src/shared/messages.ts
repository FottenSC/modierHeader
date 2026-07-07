export const APPLY_RULES_MESSAGE = 'modierheaders:apply-rules';
export const OPEN_OPTIONS_MESSAGE = 'modierheaders:open-options';

export interface ApplyRulesMessage {
  type: typeof APPLY_RULES_MESSAGE;
}

export interface OpenOptionsMessage {
  type: typeof OPEN_OPTIONS_MESSAGE;
}

export type ModierHeadersMessage = ApplyRulesMessage | OpenOptionsMessage;
