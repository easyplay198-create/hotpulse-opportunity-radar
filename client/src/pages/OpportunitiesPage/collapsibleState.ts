export interface BriefCollapsibleState {
  knowledgeExpanded: boolean;
  dataNotesExpanded: boolean;
  riskReferenceExpanded: boolean;
}

export function createInitialBriefCollapsibleState(): BriefCollapsibleState {
  return {
    knowledgeExpanded: false,
    dataNotesExpanded: false,
    riskReferenceExpanded: false,
  };
}

export function toggleBriefCollapsibleState(
  state: BriefCollapsibleState,
  key: keyof BriefCollapsibleState,
): BriefCollapsibleState {
  return {
    ...state,
    [key]: !state[key],
  };
}

export function shouldRenderCollapsibleContent(expanded: boolean): boolean {
  return expanded;
}

export function collapsibleContentMarkup(expanded: boolean, content: string): string | null {
  return expanded ? content : null;
}
