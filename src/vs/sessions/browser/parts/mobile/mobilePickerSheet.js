import "./media/mobilePickerSheet.css";
import * as DOM from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Gesture, EventType as TouchEventType } from "../../../../base/browser/touch.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
const $ = DOM.$;
function isMobilePickerSheetTarget(target) {
  return !!target.closest(".mobile-picker-sheet");
}
const MOBILE_PICKER_SHEET_HEADER_ACTION_PREFIX = "headerAction:";
const MOBILE_PICKER_SHEET_CONFIRM = /* @__PURE__ */ Symbol("mobilePickerSheetConfirm");
function showMobilePickerSheet(workbenchContainer, title, items, options) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (id) => {
      if (resolved) {
        return;
      }
      resolved = true;
      shell.close(() => resolve(id));
    };
    const shell = buildMobileSheetShell(workbenchContainer, title, {
      caption: options?.caption,
      headerActions: options?.headerActions,
      doneLabel: options?.doneLabel,
      onDismiss: () => finish(void 0),
      onHeaderAction: (actionId) => finish(`${MOBILE_PICKER_SHEET_HEADER_ACTION_PREFIX}${actionId}`)
    });
    const { sheet, disposables } = shell;
    let searchInput;
    if (options?.search) {
      const searchRow = DOM.append(sheet, $("div.mobile-picker-sheet-search"));
      const iconHost = DOM.append(searchRow, $("span.mobile-picker-sheet-search-icon"));
      const iconEl = DOM.append(iconHost, $("span.mobile-picker-sheet-search-icon-glyph"));
      iconEl.classList.add(...ThemeIcon.asClassNameArray(Codicon.search));
      searchInput = DOM.append(searchRow, $("input.mobile-picker-sheet-search-input", { type: "search", autocomplete: "off", autocorrect: "off", autocapitalize: "off", spellcheck: "false" }));
      searchInput.placeholder = options.search.placeholder;
      searchInput.setAttribute("aria-label", options.search.ariaLabel ?? options.search.placeholder);
    }
    const pinnedContainer = DOM.append(sheet, $("div.mobile-picker-sheet-pinned"));
    pinnedContainer.style.display = "none";
    const pinnedStore = disposables.add(new DisposableStore());
    const setPrimaryAction = (action) => {
      pinnedStore.clear();
      DOM.clearNode(pinnedContainer);
      if (!action) {
        pinnedContainer.style.display = "none";
        return;
      }
      pinnedContainer.style.display = "";
      const btn = DOM.append(pinnedContainer, $("button.mobile-picker-sheet-primary-action", { type: "button" }));
      btn.setAttribute("aria-label", action.label);
      if (action.icon) {
        const iconSlot = DOM.append(btn, $("span.mobile-picker-sheet-primary-action-icon"));
        const iconGlyph = DOM.append(iconSlot, $("span.mobile-picker-sheet-primary-action-icon-glyph"));
        iconGlyph.classList.add(...ThemeIcon.asClassNameArray(action.icon));
      }
      const textCol = DOM.append(btn, $("span.mobile-picker-sheet-primary-action-text"));
      DOM.append(textCol, $("span.mobile-picker-sheet-primary-action-label")).textContent = action.label;
      pinnedStore.add(DOM.addDisposableListener(btn, DOM.EventType.CLICK, (e) => {
        e.preventDefault();
        action.run();
        finish(void 0);
      }));
    };
    const list = DOM.append(sheet, $("div.mobile-picker-sheet-list"));
    list.setAttribute("role", "list");
    const rowsBySection = /* @__PURE__ */ new Map();
    let setSearchQuery;
    const handleRowTap = options?.stayOpenOnSelect && options.onDidSelect ? (id, _row, sectionIndex) => {
      const sectionRows = rowsBySection.get(sectionIndex);
      const targetEntry = sectionRows?.find((entry) => entry.id === id);
      if (sectionRows && !targetEntry?.navigates) {
        for (const entry of sectionRows) {
          if (!entry.checkSlot) {
            continue;
          }
          const isTarget = entry.id === id;
          entry.row.classList.toggle("checked", isTarget);
          entry.row.setAttribute("aria-current", isTarget ? "true" : "false");
          DOM.clearNode(entry.checkSlot);
          if (isTarget) {
            const checkGlyph = DOM.append(entry.checkSlot, $("span.mobile-picker-sheet-check-glyph"));
            checkGlyph.classList.add(...ThemeIcon.asClassNameArray(Codicon.check));
          }
        }
      }
      const selectResult = options.onDidSelect(id);
      if (selectResult === MOBILE_PICKER_SHEET_CONFIRM) {
        finish(id);
      } else if (typeof selectResult === "string" && searchInput && setSearchQuery) {
        searchInput.value = selectResult;
        setSearchQuery(selectResult);
      }
    } : (id, _row, _sectionIndex) => {
      finish(id);
    };
    const staticContainer = DOM.append(list, $("div.mobile-picker-sheet-static"));
    const renderState = { firstRow: void 0, firstCheckedRow: void 0, sectionCount: 0 };
    for (const item of items) {
      renderRow(staticContainer, item, renderState, handleRowTap, disposables, rowsBySection);
    }
    const search = options?.search;
    if (search && searchInput) {
      const resultsContainer = DOM.append(list, $("div.mobile-picker-sheet-search-results"));
      let currentQueryTokens;
      let debounceTimer;
      const searchSectionBase = renderState.sectionCount + 1;
      const pruneSearchRows = () => {
        for (const key of [...rowsBySection.keys()]) {
          if (key >= searchSectionBase) {
            rowsBySection.delete(key);
          }
        }
      };
      const searchRowsStore = disposables.add(new DisposableStore());
      const cancelInflight = () => {
        currentQueryTokens?.cancel();
        currentQueryTokens?.dispose();
        currentQueryTokens = void 0;
        if (debounceTimer !== void 0) {
          clearTimeout(debounceTimer);
          debounceTimer = void 0;
        }
      };
      disposables.add(toDisposable(cancelInflight));
      const renderResults = async (query) => {
        cancelInflight();
        staticContainer.style.display = query ? "none" : "";
        const tokens = new CancellationTokenSource();
        currentQueryTokens = tokens;
        DOM.clearNode(resultsContainer);
        pruneSearchRows();
        searchRowsStore.clear();
        const status = DOM.append(resultsContainer, $("div.mobile-picker-sheet-search-status"));
        status.textContent = localize("mobilePickerSheet.searching", "Searching\u2026");
        let results;
        try {
          results = await search.loadItems(query, tokens.token);
        } catch {
          results = [];
        }
        if (tokens.token.isCancellationRequested || resolved) {
          return;
        }
        setPrimaryAction(search.getPrimaryAction?.(query));
        DOM.clearNode(resultsContainer);
        const localState = { firstRow: void 0, firstCheckedRow: void 0, sectionCount: searchSectionBase };
        if (search.resultsSectionTitle) {
          const sectionTitle = DOM.append(resultsContainer, $("div.mobile-picker-sheet-section-title"));
          sectionTitle.textContent = search.resultsSectionTitle;
        }
        if (results.length === 0) {
          const empty = DOM.append(resultsContainer, $("div.mobile-picker-sheet-search-empty"));
          empty.textContent = search.emptyMessage ?? localize("mobilePickerSheet.noResults", "No results");
          return;
        }
        for (const item of results) {
          renderRow(resultsContainer, item, localState, handleRowTap, searchRowsStore, rowsBySection);
        }
      };
      const onInput = () => {
        if (debounceTimer !== void 0) {
          clearTimeout(debounceTimer);
        }
        const value = searchInput.value;
        debounceTimer = setTimeout(() => {
          debounceTimer = void 0;
          renderResults(value);
        }, 150);
      };
      const inputListener = DOM.addDisposableListener(searchInput, "input", onInput);
      disposables.add(inputListener);
      renderResults("");
      setSearchQuery = (query) => renderResults(query);
    }
    if (searchInput) {
      searchInput.focus();
    } else {
      (renderState.firstCheckedRow ?? renderState.firstRow)?.focus();
    }
  });
}
function showMobileContentSheet(workbenchContainer, title, renderBody, options) {
  return new Promise((resolve) => {
    let resolved = false;
    const close = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      shell.close(() => resolve());
    };
    const shell = buildMobileSheetShell(workbenchContainer, title, {
      caption: options?.caption,
      headerActions: options?.headerActions,
      doneLabel: options?.doneLabel,
      hideDoneButton: options?.hideDoneButton,
      onDismiss: close,
      onHeaderAction: () => close()
    });
    const bodyContainer = DOM.append(shell.sheet, $("div.mobile-content-sheet-body"));
    const api = { bodyContainer, close };
    const bodyDisposable = renderBody(bodyContainer, api);
    if (bodyDisposable) {
      shell.disposables.add(bodyDisposable);
    }
  });
}
function buildMobileSheetShell(workbenchContainer, title, options) {
  const disposables = new DisposableStore();
  let closed = false;
  const overlay = DOM.append(workbenchContainer, $("div.mobile-picker-sheet-overlay"));
  const backdrop = DOM.append(overlay, $("div.mobile-picker-sheet-backdrop"));
  const sheet = DOM.append(overlay, $("div.mobile-picker-sheet"));
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", title);
  DOM.append(sheet, $("div.mobile-picker-sheet-handle"));
  const titleRow = DOM.append(sheet, $("div.mobile-picker-sheet-title-row"));
  const titleEl = DOM.append(titleRow, $("div.mobile-picker-sheet-title"));
  titleEl.textContent = title;
  if (options.headerActions) {
    for (const action of options.headerActions) {
      const btn = DOM.append(titleRow, $("button.mobile-picker-sheet-header-action", { type: "button" }));
      btn.setAttribute("aria-label", action.label);
      btn.title = action.label;
      const iconHost = DOM.append(btn, $("span.mobile-picker-sheet-header-action-icon"));
      const iconEl = DOM.append(iconHost, $("span.mobile-picker-sheet-header-action-icon-glyph"));
      iconEl.classList.add(...ThemeIcon.asClassNameArray(action.icon));
      const btnGesture = Gesture.addTarget(btn);
      disposables.add(btnGesture);
      const onActivate = () => {
        if (options.onHeaderAction) {
          options.onHeaderAction(action.id);
        } else {
          options.onDismiss();
        }
      };
      const btnClick = DOM.addDisposableListener(btn, DOM.EventType.CLICK, (e) => {
        e.preventDefault();
        onActivate();
      });
      disposables.add(btnClick);
      const btnTap = DOM.addDisposableListener(btn, TouchEventType.Tap, onActivate);
      disposables.add(btnTap);
    }
  }
  if (!options.hideDoneButton) {
    const doneBtn = DOM.append(titleRow, $("button.mobile-picker-sheet-done", { type: "button" }));
    doneBtn.textContent = options.doneLabel ?? localize("mobilePickerSheet.done", "Done");
    doneBtn.setAttribute("aria-label", localize("mobilePickerSheet.doneAriaLabel", "Close {0}", title));
    const doneGesture = Gesture.addTarget(doneBtn);
    disposables.add(doneGesture);
    const doneClick = DOM.addDisposableListener(doneBtn, DOM.EventType.CLICK, (e) => {
      e.preventDefault();
      options.onDismiss();
    });
    disposables.add(doneClick);
    const doneTap = DOM.addDisposableListener(doneBtn, TouchEventType.Tap, () => options.onDismiss());
    disposables.add(doneTap);
  }
  if (options.caption) {
    const caption = DOM.append(sheet, $("div.mobile-picker-sheet-caption"));
    caption.textContent = options.caption;
  }
  const backdropClick = DOM.addDisposableListener(backdrop, DOM.EventType.CLICK, () => options.onDismiss());
  disposables.add(backdropClick);
  const backdropGesture = Gesture.addTarget(backdrop);
  disposables.add(backdropGesture);
  const backdropTap = DOM.addDisposableListener(backdrop, TouchEventType.Tap, () => options.onDismiss());
  disposables.add(backdropTap);
  const keyHandler = DOM.addDisposableListener(DOM.getWindow(workbenchContainer), DOM.EventType.KEY_DOWN, (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      options.onDismiss();
    }
  }, true);
  disposables.add(keyHandler);
  const win = DOM.getWindow(workbenchContainer);
  const vv = win.visualViewport;
  if (vv) {
    const adjustForKeyboard = () => {
      const keyboardHeight = win.innerHeight - vv.height;
      overlay.style.bottom = `${Math.max(0, keyboardHeight)}px`;
      overlay.style.height = `${vv.height}px`;
    };
    vv.addEventListener("resize", adjustForKeyboard);
    vv.addEventListener("scroll", adjustForKeyboard);
    disposables.add(toDisposable(() => {
      vv.removeEventListener("resize", adjustForKeyboard);
      vv.removeEventListener("scroll", adjustForKeyboard);
      overlay.style.bottom = "";
      overlay.style.height = "";
    }));
    adjustForKeyboard();
  }
  const close = (onAnimationEnd) => {
    if (closed) {
      return;
    }
    closed = true;
    sheet.classList.add("closing");
    backdrop.classList.add("closing");
    disposables.dispose();
    DOM.getWindow(workbenchContainer).setTimeout(() => {
      overlay.remove();
      onAnimationEnd?.();
    }, 180);
  };
  return { overlay, backdrop, sheet, disposables, close };
}
function renderRow(list, item, state, onTap, disposables, rowsBySection) {
  if (item.sectionTitle !== void 0) {
    if (state.sectionCount > 0) {
      DOM.append(list, $("div.mobile-picker-sheet-divider"));
    }
    if (item.sectionTitle) {
      const sectionTitle = DOM.append(list, $("div.mobile-picker-sheet-section-title"));
      sectionTitle.textContent = item.sectionTitle;
    }
    state.sectionCount++;
  }
  const row = DOM.append(list, $("button.mobile-picker-sheet-item", { type: "button" }));
  row.setAttribute("role", "listitem");
  row.setAttribute("aria-current", item.checked ? "true" : "false");
  if (item.checked) {
    row.classList.add("checked");
  }
  if (item.disabled) {
    row.classList.add("disabled");
    row.disabled = true;
    row.setAttribute("aria-disabled", "true");
  }
  state.firstRow ??= row;
  if (item.checked && !state.firstCheckedRow) {
    state.firstCheckedRow = row;
  }
  if (item.icon) {
    const iconSlot = DOM.append(row, $("span.mobile-picker-sheet-icon"));
    const iconGlyph = DOM.append(iconSlot, $("span.mobile-picker-sheet-icon-glyph"));
    iconGlyph.classList.add(...ThemeIcon.asClassNameArray(item.icon));
  }
  const textCol = DOM.append(row, $("span.mobile-picker-sheet-text"));
  DOM.append(textCol, $("span.mobile-picker-sheet-label")).textContent = item.label;
  if (item.description) {
    DOM.append(textCol, $("span.mobile-picker-sheet-description")).textContent = item.description;
  }
  let checkSlot;
  if (item.navigates && !item.checked) {
    const chevronSlot = DOM.append(row, $("span.mobile-picker-sheet-chevron"));
    const chevronGlyph = DOM.append(chevronSlot, $("span.mobile-picker-sheet-chevron-glyph"));
    chevronGlyph.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));
  } else {
    checkSlot = DOM.append(row, $("span.mobile-picker-sheet-check"));
    if (item.checked) {
      const checkGlyph = DOM.append(checkSlot, $("span.mobile-picker-sheet-check-glyph"));
      checkGlyph.classList.add(...ThemeIcon.asClassNameArray(Codicon.check));
    }
  }
  if (rowsBySection) {
    const entry = { row, checkSlot, id: item.id, navigates: item.navigates };
    const sectionRows = rowsBySection.get(state.sectionCount);
    if (sectionRows) {
      sectionRows.push(entry);
    } else {
      rowsBySection.set(state.sectionCount, [entry]);
    }
  }
  const currentSectionIndex = state.sectionCount;
  if (!item.disabled) {
    const rowClick = DOM.addDisposableListener(row, DOM.EventType.CLICK, (e) => {
      e.preventDefault();
      onTap(item.id, row, currentSectionIndex);
    });
    disposables.add(rowClick);
  }
}
export {
  MOBILE_PICKER_SHEET_CONFIRM,
  MOBILE_PICKER_SHEET_HEADER_ACTION_PREFIX,
  isMobilePickerSheetTarget,
  showMobileContentSheet,
  showMobilePickerSheet
};
