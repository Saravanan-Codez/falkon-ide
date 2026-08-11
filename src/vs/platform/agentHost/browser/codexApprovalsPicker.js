import "./media/codexApprovalsPicker.css";
const CODEX_APPROVALS_PICKER_CLASS = "codex-approvals-picker";
const CODEX_APPROVALS_PICKER_WIDTH = 340;
const CODEX_APPROVALS_PICKER_DETAIL_ITEM_HEIGHT = 76;
function getCodexApprovalsPickerListOptions() {
  return {
    className: CODEX_APPROVALS_PICKER_CLASS,
    minWidth: CODEX_APPROVALS_PICKER_WIDTH,
    maxWidth: CODEX_APPROVALS_PICKER_WIDTH,
    detailItemHeight: CODEX_APPROVALS_PICKER_DETAIL_ITEM_HEIGHT
  };
}
export {
  getCodexApprovalsPickerListOptions
};
