export const APPLY_RULES_MESSAGE = 'cleanheader:apply-rules';
export const OPEN_OPTIONS_MESSAGE = 'cleanheader:open-options';

export interface ApplyRulesMessage {
  type: typeof APPLY_RULES_MESSAGE;
}

export interface OpenOptionsMessage {
  type: typeof OPEN_OPTIONS_MESSAGE;
}

export type CleanHeaderMessage = ApplyRulesMessage | OpenOptionsMessage;
