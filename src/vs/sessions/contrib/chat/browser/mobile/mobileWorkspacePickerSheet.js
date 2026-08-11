import { ActionListItemKind } from "../../../../../platform/actionWidget/browser/actionList.js";
import { isPhoneLayout } from "../../../../browser/parts/mobile/mobileLayout.js";
import { MOBILE_PICKER_SHEET_CONFIRM, MOBILE_PICKER_SHEET_HEADER_ACTION_PREFIX, showMobilePickerSheet } from "../../../../browser/parts/mobile/mobilePickerSheet.js";
import { localize } from "../../../../../nls.js";
import { SubmenuAction } from "../../../../../base/common/actions.js";
import { isString } from "../../../../../base/common/types.js";
import { Codicon } from "../../../../../base/common/codicons.js";
const SEARCH_RESULT_ID_PREFIX = "searchResult:";
function buildMobileWorkspacePickerRows(items, dispatch) {
  const rows = [];
  let pendingSeparator = false;
  for (const item of items) {
    if (item.kind === ActionListItemKind.Separator) {
      pendingSeparator = rows.length > 0;
      continue;
    }
    const sectionTitle = pendingSeparator ? "" : void 0;
    pendingSeparator = false;
    if (item.submenuActions && item.submenuActions.length > 0) {
      let isFirst = true;
      const childActions = collectSubmenuActions(item.submenuActions);
      if (childActions.length === 0) {
        continue;
      }
      for (const child of childActions) {
        const id2 = `submenu:${rows.length}`;
        const childIcon = child.icon ?? item.group?.icon;
        rows.push({
          sheetItem: {
            id: id2,
            label: child.label,
            icon: childIcon,
            disabled: !child.enabled,
            sectionTitle: isFirst ? sectionTitle ?? item.label ?? "" : void 0
          },
          run: () => child.run()
        });
        isFirst = false;
      }
      continue;
    }
    const id = `item:${rows.length}`;
    const data = item.item;
    const isWorkspaceRow = !!data?.folderUri;
    const icon = isWorkspaceRow ? Codicon.folder : item.group?.icon;
    rows.push({
      sheetItem: {
        id,
        label: item.label ?? "",
        description: descriptionToString(item.description),
        icon,
        checked: !!data?.checked,
        disabled: item.disabled,
        sectionTitle
      },
      run: () => {
        if (data) {
          dispatch(data);
        }
      }
    });
  }
  return rows;
}
function collectSubmenuActions(actions) {
  const out = [];
  for (const a of actions) {
    if (a instanceof SubmenuAction) {
      for (const inner of a.actions) {
        out.push(inner);
      }
    } else {
      out.push(a);
    }
  }
  return out;
}
function descriptionToString(value) {
  if (value === void 0) {
    return void 0;
  }
  if (isString(value)) {
    return value;
  }
  return value.value;
}
async function showMobileWorkspacePickerSheet(layoutService, triggerElement, items, dispatch, browseActions) {
  const { rowItems, headerBrowseActions } = partitionItems(items, dispatch, browseActions);
  const surfacedProviderIds = collectSurfacedBrowseProviderIds(items, browseActions);
  const inlineFolderActions = browseActions.filter(
    (b) => typeof b.listFolders === "function" && surfacedProviderIds.has(b.providerId)
  );
  if (rowItems.length === 0 && inlineFolderActions.length === 0 && headerBrowseActions.length === 1) {
    headerBrowseActions[0].invoke();
    return;
  }
  if (rowItems.length === 0 && inlineFolderActions.length === 0 && headerBrowseActions.length === 0) {
    return;
  }
  const rows = buildMobileWorkspacePickerRows(rowItems, dispatch);
  const headerActions = headerBrowseActions.map((b, i) => ({
    id: String(i),
    label: b.label,
    icon: b.icon
  }));
  const folderRunById = /* @__PURE__ */ new Map();
  const folderLabelById = /* @__PURE__ */ new Map();
  let currentFolder;
  let currentSearchQuery = "";
  const search = inlineFolderActions.length > 0 ? {
    placeholder: localize("mobileWorkspacePicker.searchFolders", "Search folders\u2026"),
    resultsSectionTitle: localize("mobileWorkspacePicker.foldersSection", "Folders"),
    emptyMessage: localize("mobileWorkspacePicker.noFolders", "No folders match"),
    loadItems: async (query, token) => {
      currentSearchQuery = query;
      folderRunById.clear();
      folderLabelById.clear();
      const results = await Promise.all(
        inlineFolderActions.map(async (action) => {
          try {
            const folders = await action.listFolders(query, token);
            return folders.map((workspace) => ({ workspace, providerId: action.providerId }));
          } catch {
            return [];
          }
        })
      );
      if (token.isCancellationRequested) {
        return [];
      }
      const flattened = results.flat();
      const sheetItems = [];
      flattened.forEach((entry, idx) => {
        const id = `${SEARCH_RESULT_ID_PREFIX}${idx}`;
        const folderUri = entry.workspace.folders[0]?.root;
        if (!folderUri) {
          return;
        }
        folderRunById.set(id, () => dispatch({ folderUri, providerId: entry.providerId }));
        folderLabelById.set(id, entry.workspace.label);
        sheetItems.push({
          id,
          label: entry.workspace.label,
          description: entry.workspace.description,
          icon: entry.workspace.icon,
          navigates: true
        });
      });
      return sheetItems;
    },
    // The pinned "Select this folder" action follows the folder
    // we drilled into (when the live query still matches it),
    // instead of mixing a confirm row into the navigable list.
    getPrimaryAction: (query) => {
      if (currentFolder?.query !== query) {
        return void 0;
      }
      const folder = currentFolder;
      return {
        label: localize("mobileWorkspacePicker.selectCurrentFolder", "Select '{0}'", folder.label),
        icon: Codicon.arrowRight,
        run: folder.run
      };
    }
  } : void 0;
  triggerElement.setAttribute("aria-expanded", "true");
  let result;
  try {
    result = await showMobilePickerSheet(
      layoutService.mainContainer,
      localize("mobileWorkspacePicker.title", "Choose Workspace"),
      rows.map((r) => r.sheetItem),
      {
        headerActions,
        search,
        caption: localize("mobileWorkspacePicker.caption", "Search to browse folders on the host"),
        stayOpenOnSelect: true,
        doneLabel: localize("mobileWorkspacePicker.cancel", "Cancel"),
        onDidSelect: (id) => {
          if (id.startsWith(SEARCH_RESULT_ID_PREFIX)) {
            const run = folderRunById.get(id);
            const folderName = folderLabelById.get(id);
            if (folderName) {
              const lastSlash = currentSearchQuery.lastIndexOf("/");
              const prefix = lastSlash >= 0 ? currentSearchQuery.slice(0, lastSlash + 1) : "";
              const query = `${prefix}${folderName}/`;
              if (run) {
                currentFolder = { query, label: folderName, run };
              }
              return query;
            }
            return;
          }
          const row = rows.find((r) => r.sheetItem.id === id);
          if (row) {
            row.run();
            currentFolder = void 0;
            return MOBILE_PICKER_SHEET_CONFIRM;
          }
          return;
        }
      }
    );
  } finally {
    triggerElement.setAttribute("aria-expanded", "false");
    triggerElement.focus();
  }
  if (result?.startsWith(MOBILE_PICKER_SHEET_HEADER_ACTION_PREFIX)) {
    const index = Number(result.slice(MOBILE_PICKER_SHEET_HEADER_ACTION_PREFIX.length));
    headerBrowseActions[index]?.invoke();
  }
}
function partitionItems(items, dispatch, browseActions) {
  const rowItems = [];
  const headerBrowseActions = [];
  const hasInlineSearch = (index) => index !== void 0 && typeof browseActions[index]?.listFolders === "function";
  for (const item of items) {
    if (item.kind === ActionListItemKind.Separator) {
      rowItems.push(item);
      continue;
    }
    if (item.submenuActions?.length) {
      let promoted = false;
      for (const child of collectSubmenuActions(item.submenuActions)) {
        if (!child.enabled) {
          continue;
        }
        headerBrowseActions.push({
          label: child.label || item.label || "",
          icon: child.icon ?? item.group?.icon ?? Codicon.folderOpened,
          invoke: () => child.run()
        });
        promoted = true;
      }
      if (!promoted) {
        rowItems.push(item);
      }
      continue;
    }
    if (item.item?.browseActionIndex !== void 0 && !item.disabled) {
      if (hasInlineSearch(item.item.browseActionIndex)) {
        continue;
      }
      const data = item.item;
      headerBrowseActions.push({
        label: item.label ?? "",
        icon: item.group?.icon ?? Codicon.folderOpened,
        invoke: () => dispatch(data)
      });
      continue;
    }
    rowItems.push(item);
  }
  while (rowItems.length && rowItems[0].kind === ActionListItemKind.Separator) {
    rowItems.shift();
  }
  while (rowItems.length && rowItems[rowItems.length - 1].kind === ActionListItemKind.Separator) {
    rowItems.pop();
  }
  return { rowItems, headerBrowseActions };
}
function shouldUseMobileWorkspacePickerSheet(layoutService) {
  return isPhoneLayout(layoutService);
}
function collectSurfacedBrowseProviderIds(items, browseActions) {
  const ids = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (item.kind === ActionListItemKind.Separator) {
      continue;
    }
    const idx = item.item?.browseActionIndex;
    if (idx !== void 0) {
      const action = browseActions[idx];
      if (action) {
        ids.add(action.providerId);
      }
      continue;
    }
    if (item.submenuActions?.length) {
      for (const ba of browseActions) {
        ids.add(ba.providerId);
      }
    }
  }
  return ids;
}
export {
  buildMobileWorkspacePickerRows,
  shouldUseMobileWorkspacePickerSheet,
  showMobileWorkspacePickerSheet
};
