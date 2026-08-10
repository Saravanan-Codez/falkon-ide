import "./media/githubReferenceList.css";
import { $, append } from "../../../../base/browser/dom.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { asCssVariable } from "../../../../platform/theme/common/colorUtils.js";
class GitHubReferenceList {
  constructor(entries, _onDidSelect) {
    this._onDidSelect = _onDidSelect;
    this.element = $(".sessions-github-reference-list", { role: "list" });
    this._rows = [];
    this.update(entries);
  }
  update(entries) {
    const numberDigits = entries.reduce((max, entry) => Math.max(max, entry.number.toString().length), 0);
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      const row = this._rows[index] ?? this._createRow(entry);
      row.entry = entry;
      this._updateRow(row, numberDigits);
    }
    for (let index = this._rows.length - 1; index >= entries.length; index--) {
      this._rows[index].item.remove();
      this._rows.splice(index, 1);
    }
  }
  _createRow(entry) {
    const item = append(this.element, $(".sessions-github-reference-list-item", { role: "listitem" }));
    const button = append(item, document.createElement("button"));
    button.className = "sessions-github-reference-list-entry";
    button.type = "button";
    const row = {
      entry,
      item,
      button,
      icon: append(button, $("span.sessions-github-reference-list-entry-icon", { "aria-hidden": "true" })),
      number: append(button, $("span.sessions-github-reference-list-entry-number")),
      title: append(button, $("span.sessions-github-reference-list-entry-title"))
    };
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._onDidSelect(row.entry);
    };
    this._rows.push(row);
    return row;
  }
  _updateRow(row, numberDigits) {
    const entry = row.entry;
    if (entry.ariaLabel) {
      row.button.setAttribute("aria-label", entry.ariaLabel);
    } else {
      row.button.removeAttribute("aria-label");
    }
    row.icon.className = `sessions-github-reference-list-entry-icon ${ThemeIcon.asClassName(entry.icon)}`;
    if (entry.icon.color) {
      row.icon.style.color = asCssVariable(entry.icon.color.id);
    } else {
      row.icon.style.removeProperty("color");
    }
    row.number.textContent = `#${entry.number}`;
    row.number.style.width = `calc(${numberDigits}ch + 1em)`;
    row.title.textContent = entry.title ?? "";
    row.title.title = entry.title ?? "";
    row.title.hidden = !entry.title;
  }
}
function createGitHubReferenceListElement(entries, onDidSelect) {
  return new GitHubReferenceList(entries, onDidSelect).element;
}
export {
  GitHubReferenceList,
  createGitHubReferenceListElement
};
